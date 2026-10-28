/** Projectile flight maths: elevation solutions and target leading. */

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Low-arc launch elevation (radians above horizontal) that lands a shell of
 * speed `speed` at horizontal distance `distance` and height difference
 * `heightDelta` under gravity `gravity`. Returns null when out of range.
 */
export function solveElevation(distance: number, heightDelta: number, speed: number, gravity: number): number | null {
  if (distance < 1e-6) return heightDelta >= 0 ? Math.PI / 2 : -Math.PI / 2;
  if (gravity <= 0) return Math.atan2(heightDelta, distance);
  const v2 = speed * speed;
  const disc = v2 * v2 - gravity * (gravity * distance * distance + 2 * heightDelta * v2);
  if (disc < 0) return null;
  return Math.atan((v2 - Math.sqrt(disc)) / (gravity * distance));
}

/**
 * World direction for a shell from `from` to land on `to`. Falls back to the
 * 45 degree maximum-range elevation when the target is out of reach.
 */
export function ballisticDirection(from: Vec3Like, to: Vec3Like, speed: number, gravity: number, out: Vec3Like): Vec3Like {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const horizontal = Math.hypot(dx, dz);
  if (horizontal < 1e-6) {
    out.x = 0;
    out.z = 0;
    out.y = Math.sign(to.y - from.y) || 1;
    return out;
  }
  const elevation = solveElevation(horizontal, to.y - from.y, speed, gravity) ?? Math.PI / 4;
  const ce = Math.cos(elevation);
  out.x = (dx / horizontal) * ce;
  out.y = Math.sin(elevation);
  out.z = (dz / horizontal) * ce;
  return out;
}

/** Approximate time of flight for a near-flat shot. */
export function timeOfFlight(distance: number, speed: number): number {
  return distance / Math.max(speed, 1e-6);
}

/**
 * Predicts where a moving target will be when a shell arrives. `leadFactor`
 * scales the correction (0 = none, 1 = full), so lower difficulties can
 * under-lead. Writes the predicted point into `out`.
 */
export function leadTarget(
  shooter: Vec3Like,
  target: Vec3Like,
  targetVx: number,
  targetVz: number,
  speed: number,
  leadFactor: number,
  out: Vec3Like,
): Vec3Like {
  let px = target.x;
  let pz = target.z;
  // Two fixed-point iterations converge well for target speeds far below shell speed.
  for (let i = 0; i < 2; i++) {
    const t = timeOfFlight(Math.hypot(px - shooter.x, pz - shooter.z), speed);
    px = target.x + targetVx * t * leadFactor;
    pz = target.z + targetVz * t * leadFactor;
  }
  out.x = px;
  out.y = target.y;
  out.z = pz;
  return out;
}

/** Position of a shell after time t from launch. */
export function shellPositionAt(origin: Vec3Like, velocity: Vec3Like, gravity: number, t: number, out: Vec3Like): Vec3Like {
  out.x = origin.x + velocity.x * t;
  out.y = origin.y + velocity.y * t - 0.5 * gravity * t * t;
  out.z = origin.z + velocity.z * t;
  return out;
}
