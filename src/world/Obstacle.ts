/** Static battlefield obstacles: rocks and futuristic military structures. */

export type ObstacleKind = 'rock' | 'pyramid' | 'block' | 'bunker' | 'tower' | 'wall' | 'pylon';

export interface CircleShape {
  readonly type: 'circle';
  readonly radius: number;
}

export interface BoxShape {
  readonly type: 'box';
  readonly halfX: number;
  readonly halfZ: number;
}

export type ObstacleShape = CircleShape | BoxShape;

export interface Obstacle {
  readonly id: number;
  readonly kind: ObstacleKind;
  readonly x: number;
  readonly z: number;
  /** Compass heading of the obstacle's local -Z axis. */
  readonly yaw: number;
  readonly shape: ObstacleShape;
  readonly baseY: number;
  readonly height: number;
  /** Radius of a circle enclosing the footprint, used for broad-phase queries. */
  readonly boundRadius: number;
  /** Per-obstacle seed for deterministic visual variation. */
  readonly seed: number;
}

/**
 * Fraction of the footprint occupied at normalised height t in [0, 1].
 * Lets pyramids and domed rocks narrow towards the top for shell collisions.
 */
export function profileScale(kind: ObstacleKind, t: number): number {
  switch (kind) {
    case 'pyramid':
      return 1 - t;
    case 'rock':
      return Math.sqrt(Math.max(0, 1 - t * t * 0.85));
    case 'tower':
      return 1 - 0.35 * t;
    default:
      return 1;
  }
}

export function hasTaperedProfile(kind: ObstacleKind): boolean {
  return kind === 'pyramid' || kind === 'rock' || kind === 'tower';
}

export function boundRadiusOf(shape: ObstacleShape): number {
  return shape.type === 'circle' ? shape.radius : Math.hypot(shape.halfX, shape.halfZ);
}

/** Converts a world offset into the obstacle's local frame (x right, z back). */
export function toLocalX(dx: number, dz: number, yaw: number): number {
  return dx * Math.cos(yaw) + dz * Math.sin(yaw);
}

export function toLocalZ(dx: number, dz: number, yaw: number): number {
  return -dx * Math.sin(yaw) + dz * Math.cos(yaw);
}

/** Converts a local offset back to world space. */
export function toWorldX(lx: number, lz: number, yaw: number): number {
  return lx * Math.cos(yaw) - lz * Math.sin(yaw);
}

export function toWorldZ(lx: number, lz: number, yaw: number): number {
  return lx * Math.sin(yaw) + lz * Math.cos(yaw);
}

/** True when the world point lies inside the obstacle's solid volume. */
export function pointInsideObstacle(ob: Obstacle, x: number, y: number, z: number): boolean {
  if (y < ob.baseY || y > ob.baseY + ob.height) return false;
  const scale = profileScale(ob.kind, (y - ob.baseY) / ob.height);
  const dx = x - ob.x;
  const dz = z - ob.z;
  if (ob.shape.type === 'circle') {
    const r = ob.shape.radius * scale;
    return dx * dx + dz * dz <= r * r;
  }
  const lx = toLocalX(dx, dz, ob.yaw);
  const lz = toLocalZ(dx, dz, ob.yaw);
  return Math.abs(lx) <= ob.shape.halfX * scale && Math.abs(lz) <= ob.shape.halfZ * scale;
}
