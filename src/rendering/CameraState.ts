/**
 * Pure camera-mode and aim state, independent of Three.js so it can be unit
 * tested. CameraManager turns this state into an actual camera pose.
 */
import { clamp, damp, headingOf, wrapAngle } from '../utils/math';

export type CameraMode = 'first' | 'third' | 'overhead';

export const CAMERA_MODES: readonly CameraMode[] = ['first', 'third', 'overhead'];

export const CAMERA_LABELS: Readonly<Record<CameraMode, string>> = {
  first: 'GUNNER VIEW',
  third: 'CHASE VIEW',
  overhead: 'TACTICAL VIEW',
};

export const CAMERA_LIMITS = {
  thirdMin: 9,
  thirdMax: 42,
  thirdDefault: 17,
  overheadMin: 60,
  overheadMax: 380,
  overheadDefault: 150,
  transitionTime: 0.55,
  /** FOV multiplier when fully zoomed (right mouse). */
  zoomFovFactor: 0.38,
  zoomRate: 10,
  /** Wheel pixels to logarithmic zoom factor. */
  wheelSensitivity: 0.0012,
  overheadFovBonus: 5,
} as const;

export class CameraState {
  mode: CameraMode;
  previousMode: CameraMode;
  /** Transition progress from previousMode to mode; 1 = complete. */
  transition = 1;
  thirdDistance: number = CAMERA_LIMITS.thirdDefault;
  overheadHeight: number = CAMERA_LIMITS.overheadDefault;
  zoomHeld = false;
  zoomBlend = 0;

  constructor(mode: CameraMode = 'third') {
    this.mode = mode;
    this.previousMode = mode;
  }

  /** Advances to the next camera mode (first -> third -> overhead -> first). */
  cycle(): CameraMode {
    const index = CAMERA_MODES.indexOf(this.mode);
    this.setMode(CAMERA_MODES[(index + 1) % CAMERA_MODES.length]!);
    return this.mode;
  }

  /** Switches mode and starts a smooth transition. Returns false if unchanged. */
  setMode(mode: CameraMode): boolean {
    if (mode === this.mode) return false;
    this.previousMode = this.mode;
    this.mode = mode;
    this.transition = 0;
    return true;
  }

  /** Mouse-wheel zoom: chase distance in third person, altitude in overhead. */
  adjustZoom(wheelPixels: number): void {
    const factor = Math.exp(wheelPixels * CAMERA_LIMITS.wheelSensitivity);
    if (this.mode === 'third') {
      this.thirdDistance = clamp(this.thirdDistance * factor, CAMERA_LIMITS.thirdMin, CAMERA_LIMITS.thirdMax);
    } else if (this.mode === 'overhead') {
      this.overheadHeight = clamp(this.overheadHeight * factor, CAMERA_LIMITS.overheadMin, CAMERA_LIMITS.overheadMax);
    }
  }

  update(dt: number): void {
    if (this.transition < 1) this.transition = Math.min(1, this.transition + dt / CAMERA_LIMITS.transitionTime);
    const target = this.zoomHeld && this.mode !== 'overhead' ? 1 : 0;
    this.zoomBlend = damp(this.zoomBlend, target, CAMERA_LIMITS.zoomRate, dt);
    if (Math.abs(this.zoomBlend - target) < 1e-3) this.zoomBlend = target;
  }

  get isTransitioning(): boolean {
    return this.transition < 1;
  }

  /** Eased transition weight towards the current mode (smootherstep). */
  get transitionBlend(): number {
    const t = this.transition;
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  fieldOfView(baseFov: number): number {
    if (this.mode === 'overhead') return baseFov + CAMERA_LIMITS.overheadFovBonus;
    const zoomFactor = 1 + (CAMERA_LIMITS.zoomFovFactor - 1) * this.zoomBlend;
    return baseFov * zoomFactor;
  }
}

export const AIM_LIMITS = {
  pitchMin: -0.45,
  pitchMax: 0.6,
  /** Radians of yaw per pixel of mouse movement at sensitivity 1. */
  radiansPerPixel: 0.0022,
  overheadCursorDistance: 80,
  overheadCursorMax: 420,
} as const;

/** World-space aim direction plus the overhead-view ground cursor. */
export class AimState {
  /** Compass heading of the aim direction. */
  yaw = 0;
  /** Elevation of the aim direction (positive = up). */
  pitch = 0;
  /** Overhead ground cursor relative to the player's tank (metres). */
  groundOffsetX = 0;
  groundOffsetZ = -AIM_LIMITS.overheadCursorDistance;

  reset(heading: number): void {
    this.yaw = wrapAngle(heading);
    this.pitch = 0;
    this.syncGroundFromAim();
  }

  /** Mouse look in first/third person. `scale` folds in sensitivity and zoom. */
  applyLook(dx: number, dy: number, scale: number, invertY: boolean): void {
    const k = AIM_LIMITS.radiansPerPixel * scale;
    this.yaw = wrapAngle(this.yaw + dx * k);
    this.pitch = clamp(this.pitch + (invertY ? dy : -dy) * k, AIM_LIMITS.pitchMin, AIM_LIMITS.pitchMax);
  }

  /** Moves the overhead ground cursor; screen right = east (+X), screen down = south (+Z). */
  applyGroundCursor(dx: number, dy: number, metresPerPixel: number): void {
    this.groundOffsetX += dx * metresPerPixel;
    this.groundOffsetZ += dy * metresPerPixel;
    const len = Math.hypot(this.groundOffsetX, this.groundOffsetZ);
    if (len > AIM_LIMITS.overheadCursorMax) {
      this.groundOffsetX *= AIM_LIMITS.overheadCursorMax / len;
      this.groundOffsetZ *= AIM_LIMITS.overheadCursorMax / len;
    }
    if (len > 1e-3) this.yaw = headingOf(this.groundOffsetX, this.groundOffsetZ);
  }

  syncGroundFromAim(): void {
    this.groundOffsetX = Math.sin(this.yaw) * AIM_LIMITS.overheadCursorDistance;
    this.groundOffsetZ = -Math.cos(this.yaw) * AIM_LIMITS.overheadCursorDistance;
  }

  syncAimFromGround(): void {
    if (Math.hypot(this.groundOffsetX, this.groundOffsetZ) > 1e-3) {
      this.yaw = headingOf(this.groundOffsetX, this.groundOffsetZ);
    }
    this.pitch = 0;
  }
}
