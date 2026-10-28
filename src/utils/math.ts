/**
 * Scalar and angle helpers shared by simulation, rendering and UI.
 *
 * Heading convention: compass headings in radians, 0 = north (-Z), increasing
 * clockwise when viewed from above, so PI/2 = east (+X).
 */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
  return a === b ? 0 : (value - a) / (b - a);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Wraps an angle into the range [-PI, PI). */
export function wrapAngle(angle: number): number {
  let a = (angle + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Shortest signed difference `to - from`, in [-PI, PI). */
export function angleDiff(from: number, to: number): number {
  return wrapAngle(to - from);
}

/** Rotates `current` towards `target` by at most `maxDelta`, taking the short way round. */
export function moveTowardsAngle(current: number, target: number, maxDelta: number): number {
  const diff = angleDiff(current, target);
  if (Math.abs(diff) <= maxDelta) return wrapAngle(target);
  return wrapAngle(current + Math.sign(diff) * maxDelta);
}

export function moveTowards(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

/** Frame-rate independent exponential smoothing. */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return wrapAngle(current + angleDiff(current, target) * (1 - Math.exp(-lambda * dt)));
}

export function lerpAngle(a: number, b: number, t: number): number {
  return wrapAngle(a + angleDiff(a, b) * t);
}

export function forwardX(heading: number): number {
  return Math.sin(heading);
}

export function forwardZ(heading: number): number {
  return -Math.cos(heading);
}

/** Compass heading of a direction vector on the XZ plane. */
export function headingOf(dx: number, dz: number): number {
  return Math.atan2(dx, -dz);
}

/** Heading in whole degrees in [0, 360). */
export function toCompassDegrees(heading: number): number {
  const deg = Math.round(wrapAngle(heading) / DEG);
  return ((deg % 360) + 360) % 360;
}

export function distance2D(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  return Math.sqrt(dx * dx + dz * dz);
}

export function distanceSq2D(ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  return dx * dx + dz * dz;
}
