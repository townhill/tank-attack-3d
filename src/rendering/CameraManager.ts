/**
 * Turns CameraState + AimState into a camera pose for the gunner, chase and
 * tactical views, with smooth transitions, collision-aware chase distance and
 * impact shake. Exposes the logical aim ray used for targeting.
 */
import type { PerspectiveCamera } from 'three';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Tank } from '../entities/Tank';
import { damp, lerp } from '../utils/math';
import type { Random } from '../utils/random';
import { NO_HIT } from '../world/Collision';
import type { World } from '../world/World';
import { createStaticHit } from '../world/World';
import type { AimState, CameraMode, CameraState } from './CameraState';

const CHASE_PIVOT_HEIGHT = 3.1;
const CHASE_LIFT = 1.4;
const CHASE_LIFT_PER_METRE = 0.1;
const CAMERA_GROUND_CLEARANCE = 1.1;
const COLLISION_MARGIN = 0.8;
const OVERHEAD_TILT = 0.32;
const OVERHEAD_LOOK_AHEAD = 0.35;
const SHAKE_DECAY = 1.5;
const SHAKE_OFFSET = 0.55;
const SHAKE_ROTATION = 0.025;
const CHASE_SMOOTHING = 18;

export class CameraManager {
  /** Logical aim ray (unshaken, post-transition) for first/third person targeting. */
  readonly aimOrigin = new Vector3();
  readonly aimDirection = new Vector3(0, 0, -1);
  private readonly targetPos = new Vector3();
  private readonly targetQuat = new Quaternion();
  private readonly fromPos = new Vector3();
  private readonly fromQuat = new Quaternion();
  private readonly chasePos = new Vector3();
  private chaseInitialised = false;
  private lastMode: CameraMode | null = null;
  private readonly pivot = new Vector3();
  private readonly tmp = new Vector3();
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private readonly lookMatrix = new Matrix4();
  private readonly up = new Vector3(0, 1, 0);
  private readonly hit = createStaticHit();
  private readonly shakeQuat = new Quaternion();
  private readonly shakeEuler = new Euler();

  constructor(
    private readonly camera: PerspectiveCamera,
    private world: World,
    private readonly rng: Random,
  ) {}

  setWorld(world: World): void {
    this.world = world;
    this.chaseInitialised = false;
    this.lastMode = null;
  }

  update(dt: number, state: CameraState, aim: AimState, player: Tank, alpha: number, baseFov: number, trauma: number): void {
    // Interpolated player position.
    const px = lerp(player.prev.x, player.x, alpha);
    const py = lerp(player.prev.y, player.y, alpha);
    const pz = lerp(player.prev.z, player.z, alpha);

    if (this.lastMode !== state.mode) {
      if (this.lastMode !== null) {
        this.fromPos.copy(this.camera.position);
        this.fromQuat.copy(this.camera.quaternion);
      }
      this.chaseInitialised = false;
    }

    const cp = Math.cos(aim.pitch);
    this.aimDirection.set(Math.sin(aim.yaw) * cp, Math.sin(aim.pitch), -Math.cos(aim.yaw) * cp);
    this.euler.set(aim.pitch, -aim.yaw, 0, 'YXZ');

    switch (state.mode) {
      case 'first': {
        player.getGunnerView(this.targetPos);
        this.targetPos.x += px - player.x;
        this.targetPos.y += py - player.y;
        this.targetPos.z += pz - player.z;
        this.targetQuat.setFromEuler(this.euler);
        break;
      }
      case 'third':
        this.computeChase(dt, state, px, py, pz, player.spec.scale);
        this.targetQuat.setFromEuler(this.euler);
        break;
      case 'overhead': {
        const h = state.overheadHeight;
        const cx = px + aim.groundOffsetX * OVERHEAD_LOOK_AHEAD;
        const cz = pz + aim.groundOffsetZ * OVERHEAD_LOOK_AHEAD;
        this.targetPos.set(cx, py + h, cz + h * OVERHEAD_TILT);
        this.tmp.set(cx, py, cz);
        this.lookMatrix.lookAt(this.targetPos, this.tmp, this.up);
        this.targetQuat.setFromRotationMatrix(this.lookMatrix);
        break;
      }
    }
    this.aimOrigin.copy(this.targetPos);

    if (this.lastMode === null) {
      this.fromPos.copy(this.targetPos);
      this.fromQuat.copy(this.targetQuat);
    }
    this.lastMode = state.mode;

    const blend = state.transitionBlend;
    if (blend < 1) {
      this.camera.position.lerpVectors(this.fromPos, this.targetPos, blend);
      this.camera.quaternion.slerpQuaternions(this.fromQuat, this.targetQuat, blend);
    } else {
      this.camera.position.copy(this.targetPos);
      this.camera.quaternion.copy(this.targetQuat);
    }

    if (trauma > 0) {
      const s = trauma * trauma;
      this.camera.position.x += this.rng.signed() * s * SHAKE_OFFSET;
      this.camera.position.y += this.rng.signed() * s * SHAKE_OFFSET;
      this.camera.position.z += this.rng.signed() * s * SHAKE_OFFSET;
      this.shakeEuler.set(this.rng.signed() * s * SHAKE_ROTATION, this.rng.signed() * s * SHAKE_ROTATION, this.rng.signed() * s * SHAKE_ROTATION);
      this.camera.quaternion.multiply(this.shakeQuat.setFromEuler(this.shakeEuler));
    }

    const fov = state.fieldOfView(baseFov);
    if (Math.abs(this.camera.fov - fov) > 1e-3) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Decays shake energy; returns the new trauma value. */
  decayTrauma(trauma: number, dt: number): number {
    return Math.max(0, trauma - SHAKE_DECAY * dt);
  }

  private computeChase(dt: number, state: CameraState, px: number, py: number, pz: number, scale: number): void {
    const d = state.thirdDistance;
    this.pivot.set(px, py + CHASE_PIVOT_HEIGHT * scale, pz);
    const f = this.aimDirection;
    this.tmp.set(
      this.pivot.x - f.x * d,
      this.pivot.y - f.y * d + CHASE_LIFT + d * CHASE_LIFT_PER_METRE,
      this.pivot.z - f.z * d,
    );
    // Pull the camera in front of terrain or obstacles between it and the tank.
    this.world.raycastStatic(this.pivot.x, this.pivot.y, this.pivot.z, this.tmp.x, this.tmp.y, this.tmp.z, this.hit, 1.5);
    if (this.hit.t !== NO_HIT) {
      const len = this.pivot.distanceTo(this.tmp);
      const t = Math.max(0, this.hit.t - COLLISION_MARGIN / Math.max(len, 1e-3));
      this.tmp.lerpVectors(this.pivot, this.tmp, t);
    }
    const ground = this.world.surfaceHeightAt(this.tmp.x, this.tmp.z) + CAMERA_GROUND_CLEARANCE;
    if (this.tmp.y < ground) this.tmp.y = ground;

    if (!this.chaseInitialised) {
      this.chasePos.copy(this.tmp);
      this.chaseInitialised = true;
    } else {
      // Smooth only when moving outwards; snap inwards so we never clip.
      const currentDist = this.chasePos.distanceTo(this.pivot);
      const targetDist = this.tmp.distanceTo(this.pivot);
      if (targetDist < currentDist) this.chasePos.copy(this.tmp);
      else {
        this.chasePos.x = damp(this.chasePos.x, this.tmp.x, CHASE_SMOOTHING, dt);
        this.chasePos.y = damp(this.chasePos.y, this.tmp.y, CHASE_SMOOTHING, dt);
        this.chasePos.z = damp(this.chasePos.z, this.tmp.z, CHASE_SMOOTHING, dt);
      }
    }
    this.targetPos.copy(this.chasePos);
  }
}
