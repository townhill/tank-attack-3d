/**
 * Player targeting. The crosshair ray (from whichever camera is active) is
 * cast into the world to find the aim point; the gun is then laid with a
 * ballistic solution from the real muzzle, so camera/muzzle offset and shell
 * drop are both compensated. Also predicts where the barrel is actually
 * pointing for the HUD gun marker.
 */
import { Vector3 } from 'three';
import { ballisticDirection } from '../combat/Ballistics';
import { segmentVsTank } from '../combat/WeaponSystem';
import { WORLD } from '../config/settings';
import type { Tank } from '../entities/Tank';
import { NO_HIT } from '../world/Collision';
import type { World } from '../world/World';
import { createStaticHit } from '../world/World';

const MAX_AIM_DISTANCE = 1500;
const MIN_BALLISTIC_DISTANCE = 8;
const PREDICT_STEP = 1 / 30;
const PREDICT_TIME = 3;
/** Overhead cursor snaps to enemies within this many metres. */
const OVERHEAD_SNAP = 9;

export class AimSolver {
  readonly aimPoint = new Vector3();
  /** Tank under the crosshair, if any. */
  aimTarget: Tank | null = null;
  readonly gunImpact = new Vector3();
  gunImpactValid = false;
  /** Tank the barrel's current trajectory would hit. */
  gunTarget: Tank | null = null;
  private readonly hit = createStaticHit();
  private readonly muzzle = new Vector3();
  private readonly barrel = new Vector3();
  private readonly end = new Vector3();
  private readonly centre = new Vector3();

  /** Casts the crosshair ray against terrain, obstacles and other tanks. */
  castRay(origin: Vector3, direction: Vector3, world: World, tanks: readonly Tank[], player: Tank): Vector3 {
    this.end.copy(origin).addScaledVector(direction, MAX_AIM_DISTANCE);
    world.raycastStatic(origin.x, origin.y, origin.z, this.end.x, this.end.y, this.end.z, this.hit, 2);
    let best = this.hit.t;
    this.aimTarget = null;
    for (const t of tanks) {
      if (t === player) continue;
      const tt = segmentVsTank(origin.x, origin.y, origin.z, this.end.x, this.end.y, this.end.z, t);
      if (tt < best) {
        best = tt;
        this.aimTarget = t;
      }
    }
    if (best === NO_HIT) return this.aimPoint.copy(this.end);
    return this.aimPoint.lerpVectors(origin, this.end, best);
  }

  /** Overhead view: aim at the ground cursor, snapping onto nearby enemies. */
  groundCursor(x: number, z: number, world: World, tanks: readonly Tank[], player: Tank): Vector3 {
    this.aimTarget = null;
    let bestDist: number = OVERHEAD_SNAP;
    for (const t of tanks) {
      if (t === player || !t.alive) continue;
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < bestDist) {
        bestDist = d;
        this.aimTarget = t;
      }
    }
    if (this.aimTarget) return this.aimTarget.getCentre(this.aimPoint);
    return this.aimPoint.set(x, world.surfaceHeightAt(x, z) + 1.4, z);
  }

  /** Gun direction that lands a shell on the current aim point. */
  gunDirection(player: Tank, fallback: Vector3, out: Vector3): Vector3 {
    player.getMuzzle(this.muzzle, this.barrel);
    if (this.muzzle.distanceTo(this.aimPoint) < MIN_BALLISTIC_DISTANCE) return out.copy(fallback);
    ballisticDirection(this.muzzle, this.aimPoint, player.spec.weapon.muzzleSpeed, WORLD.gravity, out);
    return out.normalize();
  }

  /** Traces the barrel's current trajectory to find where a shell would land. */
  predictImpact(player: Tank, world: World, tanks: readonly Tank[]): void {
    player.getMuzzle(this.muzzle, this.barrel);
    const v = player.spec.weapon.muzzleSpeed;
    let x = this.muzzle.x;
    let y = this.muzzle.y;
    let z = this.muzzle.z;
    const vx = this.barrel.x * v;
    let vy = this.barrel.y * v;
    const vz = this.barrel.z * v;
    const dt = PREDICT_STEP;
    this.gunImpactValid = false;
    this.gunTarget = null;
    for (let t = 0; t < PREDICT_TIME; t += dt) {
      const nx = x + vx * dt;
      const ny = y + vy * dt - 0.5 * WORLD.gravity * dt * dt;
      const nz = z + vz * dt;
      vy -= WORLD.gravity * dt;
      world.raycastStatic(x, y, z, nx, ny, nz, this.hit, 1.5);
      let best = this.hit.t;
      let bestTank: Tank | null = null;
      for (const tank of tanks) {
        if (tank === player) continue;
        const tt = segmentVsTank(x, y, z, nx, ny, nz, tank);
        if (tt < best) {
          best = tt;
          bestTank = tank;
        }
      }
      if (best !== NO_HIT) {
        this.gunImpact.set(x + (nx - x) * best, y + (ny - y) * best, z + (nz - z) * best);
        this.gunImpactValid = true;
        this.gunTarget = bestTank;
        return;
      }
      x = nx;
      y = ny;
      z = nz;
    }
    this.gunImpact.set(x, y, z);
  }

  /** Distance from the player's turret to the aim point. */
  aimRange(player: Tank): number {
    return player.getCentre(this.centre).distanceTo(this.aimPoint);
  }
}
