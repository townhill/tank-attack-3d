/**
 * Allocation-free geometric collision tests used by movement, projectiles,
 * line-of-sight checks and camera collision.
 *
 * Segment tests return the parametric distance t in [0, 1] of the first
 * contact along A->B, or `NO_HIT` when the segment misses.
 */
import type { Obstacle } from './Obstacle';
import { hasTaperedProfile, pointInsideObstacle, toLocalX, toLocalZ, toWorldX, toWorldZ } from './Obstacle';
import type { Terrain } from './Terrain';
import type { WaterMap } from './Water';

export const NO_HIT = Number.POSITIVE_INFINITY;

export interface PushResult {
  /** Unit normal pointing away from the obstacle on the XZ plane. */
  nx: number;
  nz: number;
  depth: number;
}

export function createPushResult(): PushResult {
  return { nx: 0, nz: 0, depth: 0 };
}

/** Circle (tank footprint) against an obstacle footprint on the XZ plane. */
export function circleVsObstacle(px: number, pz: number, radius: number, ob: Obstacle, out: PushResult): boolean {
  const dx = px - ob.x;
  const dz = pz - ob.z;
  if (ob.shape.type === 'circle') {
    const minDist = radius + ob.shape.radius;
    const distSq = dx * dx + dz * dz;
    if (distSq >= minDist * minDist) return false;
    const dist = Math.sqrt(distSq);
    if (dist < 1e-6) {
      out.nx = 1;
      out.nz = 0;
    } else {
      out.nx = dx / dist;
      out.nz = dz / dist;
    }
    out.depth = minDist - dist;
    return true;
  }
  const { halfX, halfZ } = ob.shape;
  const lx = toLocalX(dx, dz, ob.yaw);
  const lz = toLocalZ(dx, dz, ob.yaw);
  const cx = lx < -halfX ? -halfX : lx > halfX ? halfX : lx;
  const cz = lz < -halfZ ? -halfZ : lz > halfZ ? halfZ : lz;
  const ox = lx - cx;
  const oz = lz - cz;
  const distSq = ox * ox + oz * oz;
  let lnx: number;
  let lnz: number;
  let depth: number;
  if (distSq > 1e-12) {
    if (distSq >= radius * radius) return false;
    const dist = Math.sqrt(distSq);
    lnx = ox / dist;
    lnz = oz / dist;
    depth = radius - dist;
  } else {
    // Centre inside the box: push out through the nearest face.
    const penX = halfX - Math.abs(lx);
    const penZ = halfZ - Math.abs(lz);
    if (penX < penZ) {
      lnx = lx >= 0 ? 1 : -1;
      lnz = 0;
      depth = penX + radius;
    } else {
      lnx = 0;
      lnz = lz >= 0 ? 1 : -1;
      depth = penZ + radius;
    }
  }
  out.nx = toWorldX(lnx, lnz, ob.yaw);
  out.nz = toWorldZ(lnx, lnz, ob.yaw);
  out.depth = depth;
  return true;
}

/** Updates [tMin, tMax] with one slab; returns false when the interval empties. */
function clipSlab(start: number, delta: number, min: number, max: number, range: { t0: number; t1: number }): boolean {
  if (Math.abs(delta) < 1e-12) return start >= min && start <= max;
  let ta = (min - start) / delta;
  let tb = (max - start) / delta;
  if (ta > tb) {
    const tmp = ta;
    ta = tb;
    tb = tmp;
  }
  if (ta > range.t0) range.t0 = ta;
  if (tb < range.t1) range.t1 = tb;
  return range.t0 <= range.t1;
}

const range = { t0: 0, t1: 1 };

/** Segment against an axis-aligned box centred on the origin; returns entry t and writes exit t into `exit`. */
export function segmentVsAabb(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  hx: number, hy: number, hz: number,
  exit?: { t: number },
): number {
  range.t0 = 0;
  range.t1 = 1;
  if (!clipSlab(ax, bx - ax, -hx, hx, range)) return NO_HIT;
  if (!clipSlab(ay, by - ay, -hy, hy, range)) return NO_HIT;
  if (!clipSlab(az, bz - az, -hz, hz, range)) return NO_HIT;
  if (exit) exit.t = range.t1;
  return range.t0;
}

/** Step length when marching through a shape's bounding interval (metres). */
const SURFACE_MARCH_STEP = 0.4;

/**
 * Walks A->B through [tEnter, tExit], a stretch known to bound `shape`, and
 * returns the first t inside it (refined by bisection), or NO_HIT.
 */
export function marchToSurface<T>(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  tEnter: number, tExit: number,
  shape: T,
  inside: (shape: T, x: number, y: number, z: number) => boolean,
): number {
  const len = Math.hypot(bx - ax, by - ay, bz - az) * (tExit - tEnter);
  const steps = Math.max(2, Math.ceil(len / SURFACE_MARCH_STEP));
  let prevT = tEnter;
  for (let s = 0; s <= steps; s++) {
    const t = tEnter + ((tExit - tEnter) * s) / steps;
    if (inside(shape, ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t)) {
      if (s === 0) return t;
      let lo = prevT;
      let hi = t;
      for (let k = 0; k < 6; k++) {
        const mid = (lo + hi) / 2;
        if (inside(shape, ax + (bx - ax) * mid, ay + (by - ay) * mid, az + (bz - az) * mid)) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    prevT = t;
  }
  return NO_HIT;
}

/** Segment against an upright cylinder; returns entry t and writes exit t into `exit`. */
export function segmentVsCylinder(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cz: number, radius: number, y0: number, y1: number,
  exit?: { t: number },
): number {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dz = bz - az;
  const fx = ax - cx;
  const fz = az - cz;
  const a = dx * dx + dz * dz;
  const c = fx * fx + fz * fz - radius * radius;
  if (a < 1e-12) {
    if (c > 0) return NO_HIT;
  } else {
    const b = 2 * (fx * dx + fz * dz);
    const disc = b * b - 4 * a * c;
    if (disc < 0) return NO_HIT;
    const sq = Math.sqrt(disc);
    const e0 = (-b - sq) / (2 * a);
    const e1 = (-b + sq) / (2 * a);
    if (e0 > t0) t0 = e0;
    if (e1 < t1) t1 = e1;
    if (t0 > t1) return NO_HIT;
  }
  range.t0 = t0;
  range.t1 = t1;
  if (!clipSlab(ay, by - ay, y0, y1, range)) return NO_HIT;
  if (exit) exit.t = range.t1;
  return range.t0;
}

const exitScratch = { t: 1 };

/** Segment against an obstacle's solid volume, honouring tapered profiles. */
export function segmentVsObstacle(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  ob: Obstacle,
): number {
  const y0 = ob.baseY;
  const y1 = ob.baseY + ob.height;
  let tEnter: number;
  let tExit: number;
  if (ob.shape.type === 'circle') {
    tEnter = segmentVsCylinder(ax, ay, az, bx, by, bz, ob.x, ob.z, ob.shape.radius, y0, y1, exitScratch);
    tExit = exitScratch.t;
  } else {
    const lax = toLocalX(ax - ob.x, az - ob.z, ob.yaw);
    const laz = toLocalZ(ax - ob.x, az - ob.z, ob.yaw);
    const lbx = toLocalX(bx - ob.x, bz - ob.z, ob.yaw);
    const lbz = toLocalZ(bx - ob.x, bz - ob.z, ob.yaw);
    const midY = (y0 + y1) / 2;
    tEnter = segmentVsAabb(lax, ay - midY, laz, lbx, by - midY, lbz, ob.shape.halfX, ob.height / 2, ob.shape.halfZ);
    tExit = range.t1;
  }
  if (tEnter === NO_HIT || !hasTaperedProfile(ob.kind)) return tEnter;
  // Tapered shapes: march through the bounding interval to find the true surface.
  return marchToSurface(ax, ay, az, bx, by, bz, tEnter, tExit, ob, pointInsideObstacle);
}

/**
 * First t along A->B, sampled every `step` metres and refined by bisection,
 * at which `below` holds; 0 when it already holds at A.
 */
function marchBelow<T>(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  surface: T, step: number,
  below: (surface: T, x: number, y: number, z: number) => boolean,
): number {
  if (below(surface, ax, ay, az)) return 0;
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  const steps = Math.max(1, Math.ceil(len / step));
  let prevT = 0;
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    if (below(surface, ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t)) {
      let lo = prevT;
      let hi = t;
      for (let k = 0; k < 8; k++) {
        const mid = (lo + hi) / 2;
        if (below(surface, ax + (bx - ax) * mid, ay + (by - ay) * mid, az + (bz - az) * mid)) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    prevT = t;
  }
  return NO_HIT;
}

function belowTerrain(terrain: Terrain, x: number, y: number, z: number): boolean {
  return y <= terrain.heightAt(x, z);
}

function belowWater(water: WaterMap, x: number, y: number, z: number): boolean {
  return y <= water.surfaceAt(x, z);
}

/** First point where the segment passes below the terrain surface. */
export function segmentVsTerrain(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  terrain: Terrain, step: number,
): number {
  return marchBelow(ax, ay, az, bx, by, bz, terrain, step, belowTerrain);
}

/** First point where the segment passes below a water surface. */
export function segmentVsWater(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  water: WaterMap, step: number,
): number {
  if (ay > water.maxLevel && by > water.maxLevel) return NO_HIT;
  return marchBelow(ax, ay, az, bx, by, bz, water, step, belowWater);
}
