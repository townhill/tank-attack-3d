/**
 * Simulation state and physics for a tracked vehicle. Player and enemy tanks
 * share this class; only the source of their controls differs.
 */
import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Faction, TankSpec } from '../config/settings';
import { WORLD } from '../config/settings';
import { angleDiff, clamp, moveTowards, moveTowardsAngle, wrapAngle } from '../utils/math';
import type { HeightField } from '../world/Terrain';

export interface TankControls {
  /** -1 (full reverse) .. 1 (full ahead). */
  throttle: number;
  /** -1 (rotate left/anticlockwise) .. 1 (rotate right/clockwise). */
  turn: number;
  fire: boolean;
}

export interface TankSnapshot {
  x: number;
  y: number;
  z: number;
  turretYaw: number;
  gunPitch: number;
  readonly orientation: Quaternion;
}

/** How strongly gravity along the slope affects speed (0..1). */
const SLOPE_EFFECT = 0.55;
/** Fraction of top speed lost per unit of uphill gradient. */
const CLIMB_PENALTY = 1.2;
const MIN_CLIMB_SPEED = 0.35;
/** Fractional top-speed gain per unit of downhill gradient (capped at 0.3 gradient). */
const DESCENT_BONUS = 0.5;
/** Responsiveness of the hull's alignment to the ground (per second). */
const GROUND_ALIGN_RATE = 10;
const RECOIL_RECOVERY = 2.2;
const DAMAGE_FLASH_DECAY = 3.5;
/** Gunner's sight offset from the gun pivot (turret frame, metres). */
const GUNNER_SIGHT_SIDE = 0;
const GUNNER_SIGHT_HEIGHT = 1.25;
const GUNNER_SIGHT_BACK = 0.55;
const NO_CONTROLS: TankControls = { throttle: 0, turn: 0, fire: false };

const scratchMatrix = new Matrix4();
const scratchRight = new Vector3();
const scratchForward = new Vector3();
const scratchBack = new Vector3();
const scratchUp = new Vector3();
const scratchQuat = new Quaternion();
const scratchLocal = new Vector3();

export class Tank {
  x = 0;
  y = 0;
  z = 0;
  heading = 0;
  /** Signed speed along the hull's forward axis (m/s). */
  speed = 0;
  angularVelocity = 0;
  vx = 0;
  vz = 0;

  readonly up = new Vector3(0, 1, 0);
  readonly orientation = new Quaternion();

  /** Turret yaw relative to the hull, compass convention (positive = right). */
  turretYaw = 0;
  /** Gun elevation relative to the turret ring (positive = up). */
  gunPitch = 0;
  turretYawRate = 0;
  /** Desired world-space gun direction (unit vector). */
  readonly aimDirection = new Vector3(0, 0, -1);

  health: number;
  alive = true;
  /** Simulation time at which the tank was destroyed. */
  destroyedAt = -1;
  reload = 0;
  recoil = 0;
  damageFlash = 0;
  trackPhaseLeft = 0;
  trackPhaseRight = 0;
  /** Index of the bridge the tank is crossing, or -1; kept up to date by the simulation. */
  bridgeId = -1;

  readonly controls: TankControls = { throttle: 0, turn: 0, fire: false };
  readonly prev: TankSnapshot = { x: 0, y: 0, z: 0, turretYaw: 0, gunPitch: 0, orientation: new Quaternion() };

  constructor(
    readonly id: number,
    readonly spec: TankSpec,
    readonly faction: Faction,
  ) {
    this.health = spec.maxHealth;
  }

  get healthFraction(): number {
    return clamp(this.health / this.spec.maxHealth, 0, 1);
  }

  get reloadFraction(): number {
    return 1 - clamp(this.reload / this.spec.weapon.reloadTime, 0, 1);
  }

  placeAt(x: number, z: number, heading: number, ground: HeightField): void {
    this.x = x;
    this.z = z;
    this.heading = wrapAngle(heading);
    this.speed = 0;
    this.angularVelocity = 0;
    this.bridgeId = -1;
    this.settleOnGround(ground, 0);
    this.aimDirection.set(Math.sin(heading), 0, -Math.cos(heading));
    this.saveSnapshot();
  }

  saveSnapshot(): void {
    const p = this.prev;
    p.x = this.x;
    p.y = this.y;
    p.z = this.z;
    p.turretYaw = this.turretYaw;
    p.gunPitch = this.gunPitch;
    p.orientation.copy(this.orientation);
  }

  /** Applies throttle/turn input with inertia, friction and slope effects. */
  integrateMotion(dt: number, ground: HeightField, speedMultiplier: number): void {
    const s = this.spec;
    const c = this.alive ? this.controls : NO_CONTROLS;
    const maxForward = s.maxSpeed * speedMultiplier;
    const maxReverse = s.reverseSpeed * speedMultiplier;
    const throttle = clamp(c.throttle, -1, 1);

    // Gradient along the hull's forward axis (positive = nose up).
    const fx = Math.sin(this.heading);
    const fz = -Math.cos(this.heading);
    const probe = 2.5 * s.scale;
    const rise =
      (ground.heightAt(this.x + fx * probe, this.z + fz * probe) - ground.heightAt(this.x - fx * probe, this.z - fz * probe)) /
      (2 * probe);
    // The engine can't hold top speed up a hill; going down it runs a little faster.
    const climb = rise * Math.sign(throttle);
    const slopeFactor = climb > 0 ? clamp(1 - climb * CLIMB_PENALTY, MIN_CLIMB_SPEED, 1) : 1 + Math.min(-climb, 0.3) * DESCENT_BONUS;
    const target = (throttle >= 0 ? throttle * maxForward : throttle * maxReverse) * slopeFactor;

    let rate: number;
    if (throttle === 0) rate = s.coastDeceleration;
    else if (Math.sign(target) !== Math.sign(this.speed) && Math.abs(this.speed) > 0.05) rate = s.braking;
    else if (Math.abs(target) > Math.abs(this.speed)) rate = s.acceleration;
    else rate = s.coastDeceleration;
    this.speed = moveTowards(this.speed, target, rate * dt);
    // Gravity along the slope slows climbs and lets a coasting tank roll.
    this.speed -= WORLD.gravity * (rise / Math.sqrt(1 + rise * rise)) * SLOPE_EFFECT * dt;
    if (throttle === 0 && Math.abs(this.speed) < 0.05) this.speed = 0;

    const speedFraction = Math.min(1, Math.abs(this.speed) / Math.max(maxForward, 0.01));
    const targetTurn = clamp(c.turn, -1, 1) * s.turnRate * (1 - 0.3 * speedFraction);
    this.angularVelocity = moveTowards(this.angularVelocity, targetTurn, s.turnAcceleration * dt);
    this.heading = wrapAngle(this.heading + this.angularVelocity * dt);

    this.vx = Math.sin(this.heading) * this.speed;
    this.vz = -Math.cos(this.heading) * this.speed;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // Track surface speed differs per side while turning.
    const halfTrack = s.hitHalfExtents.x * 0.8;
    this.trackPhaseLeft += (this.speed + this.angularVelocity * halfTrack) * dt;
    this.trackPhaseRight += (this.speed - this.angularVelocity * halfTrack) * dt;
  }

  /** Places the hull on the ground and aligns it with the local slope. */
  settleOnGround(ground: HeightField, dt: number): void {
    const s = this.spec;
    const halfLength = s.hitHalfExtents.z * 0.85;
    const halfWidth = s.hitHalfExtents.x * 0.85;
    const fx = Math.sin(this.heading);
    const fz = -Math.cos(this.heading);
    const rx = Math.cos(this.heading);
    const rz = Math.sin(this.heading);
    const fl = ground.heightAt(this.x + fx * halfLength - rx * halfWidth, this.z + fz * halfLength - rz * halfWidth);
    const fr = ground.heightAt(this.x + fx * halfLength + rx * halfWidth, this.z + fz * halfLength + rz * halfWidth);
    const bl = ground.heightAt(this.x - fx * halfLength - rx * halfWidth, this.z - fz * halfLength - rz * halfWidth);
    const br = ground.heightAt(this.x - fx * halfLength + rx * halfWidth, this.z - fz * halfLength + rz * halfWidth);
    const centre = ground.heightAt(this.x, this.z);
    this.y = Math.max(centre, (fl + fr + bl + br) / 4);

    scratchForward.set(fx * 2 * halfLength, (fl + fr) / 2 - (bl + br) / 2, fz * 2 * halfLength);
    scratchRight.set(rx * 2 * halfWidth, (fr + br) / 2 - (fl + bl) / 2, rz * 2 * halfWidth);
    scratchUp.crossVectors(scratchRight, scratchForward).normalize();
    if (dt <= 0) this.up.copy(scratchUp);
    else this.up.lerp(scratchUp, 1 - Math.exp(-GROUND_ALIGN_RATE * dt)).normalize();
    this.updateOrientation();
  }

  /** Rebuilds the hull quaternion from heading and the smoothed up vector. */
  updateOrientation(): void {
    scratchForward.set(Math.sin(this.heading), 0, -Math.cos(this.heading));
    scratchForward.addScaledVector(this.up, -scratchForward.dot(this.up)).normalize();
    scratchRight.crossVectors(scratchForward, this.up).normalize();
    scratchBack.copy(scratchForward).negate();
    scratchMatrix.makeBasis(scratchRight, this.up, scratchBack);
    this.orientation.setFromRotationMatrix(scratchMatrix);
  }

  /** Traverses the turret and elevates the gun towards `aimDirection`. */
  updateTurret(dt: number): void {
    const s = this.spec;
    scratchQuat.copy(this.orientation).invert();
    scratchLocal.copy(this.aimDirection).applyQuaternion(scratchQuat);
    const desiredYaw = Math.atan2(scratchLocal.x, -scratchLocal.z);
    const horizontal = Math.hypot(scratchLocal.x, scratchLocal.z);
    const desiredPitch = clamp(Math.atan2(scratchLocal.y, horizontal), s.minElevation, s.maxElevation);
    const previousYaw = this.turretYaw;
    if (this.alive) {
      this.turretYaw = moveTowardsAngle(this.turretYaw, desiredYaw, s.turretTraverse * dt);
      this.gunPitch = moveTowards(this.gunPitch, desiredPitch, s.elevationRate * dt);
    }
    this.turretYawRate = dt > 0 ? angleDiff(previousYaw, this.turretYaw) / dt : 0;
  }

  /** Advances reload, recoil and damage-flash timers. */
  updateTimers(dt: number): void {
    if (this.reload > 0) this.reload = Math.max(0, this.reload - dt);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - RECOIL_RECOVERY * dt);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - DAMAGE_FLASH_DECAY * dt);
  }

  /** Gun direction in hull-local space. */
  localGunDirection(out: Vector3): Vector3 {
    const cp = Math.cos(this.gunPitch);
    return out.set(Math.sin(this.turretYaw) * cp, Math.sin(this.gunPitch), -Math.cos(this.turretYaw) * cp);
  }

  /** World-space muzzle position and firing direction of the actual barrel. */
  getMuzzle(outPosition: Vector3, outDirection: Vector3): void {
    const s = this.spec;
    const k = s.scale;
    this.localGunDirection(outDirection);
    // Gun pivot sits on the turret's centre line, `gunPivotZ` ahead of the turret ring.
    const sy = Math.sin(this.turretYaw);
    const cy = Math.cos(this.turretYaw);
    outPosition.set(-s.gunPivotZ * sy * k, (s.turretPivotY + s.gunPivotY) * k, (s.turretPivotZ + s.gunPivotZ * cy) * k);
    outPosition.addScaledVector(outDirection, s.barrelLength * k);
    outPosition.applyQuaternion(this.orientation);
    outPosition.x += this.x;
    outPosition.y += this.y;
    outPosition.z += this.z;
    outDirection.applyQuaternion(this.orientation);
  }

  /** World-space point above the turret centre, used for sight lines and the gunner camera. */
  getSightPoint(out: Vector3, heightAboveGun = 0.9): Vector3 {
    const s = this.spec;
    out.set(0, (s.turretPivotY + s.gunPivotY + heightAboveGun) * s.scale, s.turretPivotZ * s.scale);
    out.applyQuaternion(this.orientation);
    out.x += this.x;
    out.y += this.y;
    out.z += this.z;
    return out;
  }

  /** Gunner's sight: above and right of the gun mantlet, turning with the turret. */
  getGunnerView(out: Vector3): Vector3 {
    const s = this.spec;
    const k = s.scale;
    const side = GUNNER_SIGHT_SIDE;
    const forward = s.gunPivotZ + GUNNER_SIGHT_BACK;
    const cy = Math.cos(this.turretYaw);
    const sy = Math.sin(this.turretYaw);
    out.set(
      (side * cy - forward * sy) * k,
      (s.turretPivotY + s.gunPivotY + GUNNER_SIGHT_HEIGHT) * k,
      (s.turretPivotZ + side * sy + forward * cy) * k,
    );
    out.applyQuaternion(this.orientation);
    out.x += this.x;
    out.y += this.y;
    out.z += this.z;
    return out;
  }

  /** Centre of the hit box in world space. */
  getCentre(out: Vector3): Vector3 {
    out.set(0, this.spec.hitHalfExtents.y, 0).applyQuaternion(this.orientation);
    out.x += this.x;
    out.y += this.y;
    out.z += this.z;
    return out;
  }
}
