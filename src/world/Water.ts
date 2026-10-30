/**
 * Rivers, lakes and ponds: their generated layout, and the water level
 * rasterised on the terrain's vertex grid that tanks, shells, sight lines and
 * the renderer all share. Depth uses the terrain's own triangles, so the
 * shoreline is exactly where the drawn water meets the drawn ground.
 */
import { WATER } from '../config/settings';
import { TAU } from '../utils/math';
import type { Bridge, BridgeLocal } from './Bridge';
import { createBridgeLocal, PARAPET_THICKNESS, toBridgeLocal } from './Bridge';
import type { PushResult } from './Collision';
import type { PlanarVector } from './distanceField';
import { DistanceField } from './distanceField';
import type { Terrain } from './Terrain';

/** Ground beyond the parapets beside a bridge span that is closed to tanks (metres). */
const UNDERPASS_MARGIN = 1;

export interface RiverSample {
  readonly x: number;
  readonly z: number;
  /** Distance along the river from its source (metres). */
  readonly s: number;
  /** Unit direction of flow. */
  readonly tx: number;
  readonly tz: number;
  /** Half the width of the water surface. */
  readonly halfWidth: number;
  /** Water depth on the centreline. */
  readonly depth: number;
  /** Height of the water surface; never rises downstream. */
  readonly surfaceY: number;
}

export interface River {
  readonly id: number;
  /** Evenly spaced centreline from source to mouth. */
  readonly samples: readonly RiverSample[];
}

export type LakeKind = 'lake' | 'pond';

export interface Lake {
  readonly id: number;
  readonly kind: LakeKind;
  readonly x: number;
  readonly z: number;
  readonly surfaceY: number;
  /** Mean shoreline radius. */
  readonly radius: number;
  readonly maxDepth: number;
  /** Shoreline radius multipliers at evenly spaced angles, starting at +X and turning towards +Z. */
  readonly shape: readonly number[];
}

/** Shoreline radius of a lake in the direction `angle` (radians from +X towards +Z). */
export function lakeRadiusAt(lake: Lake, angle: number): number {
  const n = lake.shape.length;
  const u = (((angle / TAU) * n) % n + n) % n;
  const i = Math.floor(u);
  const a = lake.shape[i % n]!;
  const b = lake.shape[(i + 1) % n]!;
  return lake.radius * (a + (b - a) * (u - i));
}

/** Water depth at (x, z) for per-vertex water levels over the terrain; 0 on dry ground. */
export function waterDepthAt(terrain: Terrain, level: Float32Array, x: number, z: number): number {
  const depth = terrain.sampleField(level, x, z) - terrain.heightAt(x, z);
  return depth > 0 ? depth : 0;
}

const gradient: PlanarVector = { x: 0, z: 0 };

export class WaterMap {
  /** Highest water surface anywhere; -Infinity when there is no water. */
  readonly maxLevel: number;

  constructor(
    readonly terrain: Terrain,
    /** Water surface height per terrain vertex: set on wet vertices and their neighbours, NaN elsewhere. */
    readonly level: Float32Array,
    /** Signed distance to water a tank cannot enter (negative inside). */
    readonly blocked: DistanceField,
  ) {
    if (level.length !== terrain.heights.length) {
      throw new Error(`Water level length ${level.length} does not match ${terrain.heights.length}`);
    }
    let max = -Infinity;
    for (const v of level) if (v > max) max = v;
    this.maxLevel = max;
  }

  /** A water map with no water at all. */
  static dry(terrain: Terrain): WaterMap {
    return new WaterMap(terrain, new Float32Array(terrain.heights.length).fill(Number.NaN), DistanceField.empty());
  }

  /** Height of the water surface at (x, z), or NaN where the ground is dry. */
  surfaceAt(x: number, z: number): number {
    if (this.maxLevel === -Infinity) return Number.NaN;
    const level = this.terrain.sampleField(this.level, x, z);
    return level > this.terrain.heightAt(x, z) ? level : Number.NaN;
  }

  /** Water depth at (x, z); 0 on dry ground. */
  depthAt(x: number, z: number): number {
    return this.maxLevel === -Infinity ? 0 : waterDepthAt(this.terrain, this.level, x, z);
  }

  /** Signed distance to water a tank cannot enter: negative inside it. */
  blockedDistance(x: number, z: number): number {
    return this.blocked.sample(x, z);
  }

  isBlocked(x: number, z: number): boolean {
    return this.blocked.sample(x, z) < 0;
  }

  /**
   * Pushes a tank centre of `radius` out of blocked water. Writes the push and
   * returns true when the centre has to move.
   */
  pushOut(x: number, z: number, radius: number, out: PushResult): boolean {
    const distance = this.blocked.sample(x, z);
    if (distance >= radius) return false;
    this.blocked.gradient(x, z, gradient);
    out.nx = gradient.x;
    out.nz = gradient.z;
    out.depth = radius - distance;
    return true;
  }

  /** Top-speed multiplier for a tank wading at (x, z): 1 on dry ground. */
  wadingFactor(x: number, z: number): number {
    const depth = this.depthAt(x, z);
    if (depth <= 0) return 1;
    const t = Math.min(1, depth / WATER.impassableDepth);
    return 1 + (WATER.wadingSpeedFactor - 1) * t;
  }
}

/**
 * Builds the water map for final ground heights and water levels. The
 * blocked-water field covers the square of half size `halfExtent` and marks
 * water too deep to wade plus the ground under every bridge span.
 */
export function createWaterMap(
  terrain: Terrain,
  level: Float32Array,
  bridges: readonly Bridge[],
  halfExtent: number,
  cellSize: number = WATER.fieldCellSize,
): WaterMap {
  const cols = Math.ceil((2 * halfExtent) / cellSize);
  const mask = new Uint8Array(cols * cols);
  for (let j = 0; j < cols; j++) {
    const z = -halfExtent + (j + 0.5) * cellSize;
    for (let i = 0; i < cols; i++) {
      const x = -halfExtent + (i + 0.5) * cellSize;
      // Most of the map is dry; skip the ground height unless there is water here.
      const surface = terrain.sampleField(level, x, z);
      if (Number.isNaN(surface)) continue;
      if (surface - terrain.heightAt(x, z) > WATER.impassableDepth) mask[j * cols + i] = 1;
    }
  }
  const local = createBridgeLocal();
  for (const b of bridges) markUnderSpan(mask, cols, halfExtent, cellSize, b, local);
  return new WaterMap(terrain, level, DistanceField.fromMask(mask, cols, cols, -halfExtent, -halfExtent, cellSize));
}

/** Marks the field cells under a bridge span, searching only its bounding box. */
function markUnderSpan(mask: Uint8Array, cols: number, halfExtent: number, cellSize: number, b: Bridge, local: BridgeLocal): void {
  const halfWide = b.halfWidth + PARAPET_THICKNESS + UNDERPASS_MARGIN;
  const reach = Math.hypot(b.halfSpan, halfWide);
  const first = (v: number): number => Math.max(0, Math.floor((v - reach + halfExtent) / cellSize));
  const last = (v: number): number => Math.min(cols - 1, Math.ceil((v + reach + halfExtent) / cellSize));
  for (let j = first(b.z); j <= last(b.z); j++) {
    const z = -halfExtent + (j + 0.5) * cellSize;
    for (let i = first(b.x); i <= last(b.x); i++) {
      toBridgeLocal(b, -halfExtent + (i + 0.5) * cellSize, z, local);
      if (Math.abs(local.along) <= b.halfSpan && Math.abs(local.lateral) <= halfWide) mask[j * cols + i] = 1;
    }
  }
}
