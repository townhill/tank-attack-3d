/**
 * DOM-free data preparation for the tactical map: shaded-relief terrain
 * pixels and the last-known contact memory used by radar intel.
 */
import type { EnemyKind } from '../config/settings';
import type { Tank } from '../entities/Tank';
import type { Simulation } from '../game/Simulation';
import { WATER } from '../config/settings';
import { clamp } from '../utils/math';
import type { World } from '../world/World';
import type { TacticalTheme } from './tacticalTheme';

/** Metres between contour lines. */
export const CONTOUR_INTERVAL = 5;
/** Every Nth contour is a brighter index contour (and the only one drawn in the mountains). */
const INDEX_CONTOUR_EVERY = 5;
const MINOR_CONTOUR_MIX = 0.22;
const INDEX_CONTOUR_MIX = 0.45;
/** Index contours over the out-of-bounds mountains are kept faint to avoid clutter. */
const MOUNTAIN_CONTOUR_MIX = 0.2;
/** Pixel spacing of the diagonal hatching over out-of-bounds mountains. */
const HATCH_SPACING = 7;
const HATCH_DARKEN = 0.5;
/** Brightness of everything beyond the playable square, the water there included. */
export const MOUNTAIN_DIM = 0.75;
// Hill-shading light from the north-west, about 50 degrees above the horizon.
const LIGHT_LENGTH = Math.hypot(1, 1.6, 1);
const LIGHT_X = -1 / LIGHT_LENGTH;
const LIGHT_Y = 1.6 / LIGHT_LENGTH;
const LIGHT_Z = -1 / LIGHT_LENGTH;
/** Water this deep or deeper takes the full deep-water colour (metres). */
export const WATER_SHADE_DEPTH = 4;
/** Pixel rows between the hatch lines drawn over water, so it reads without colour. */
const WATER_HATCH_SPACING = 4;
const WATER_HATCH_MIX = 0.16;
/** How far the shore colour is mixed in along the shoreline and along the edge of water too deep to wade. */
const SHORELINE_MIX = 0.7;
const DEEP_EDGE_MIX = 0.3;

interface HeightSamples {
  readonly heights: Float32Array;
  /** Height range inside the playable square, used for the colour ramp. */
  readonly min: number;
  readonly max: number;
}

/** Samples terrain heights at pixel centres over the full terrain square. */
function sampleHeights(world: World, size: number): HeightSamples {
  const terrain = world.terrain;
  const half = terrain.halfSize;
  const step = (2 * half) / size;
  const limit = world.playableHalfSize;
  const heights = new Float32Array(size * size);
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < size; j++) {
    const z = -half + (j + 0.5) * step;
    for (let i = 0; i < size; i++) {
      const x = -half + (i + 0.5) * step;
      const h = terrain.heightAt(x, z);
      heights[j * size + i] = h;
      if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }
  if (!(max > min)) {
    min = 0;
    max = 1;
  }
  return { heights, min, max };
}

/**
 * Shaded-relief RGBA pixels (size x size, row-major, north row first) covering
 * the full terrain square: height tint, hill shading, contours every
 * CONTOUR_INTERVAL metres and darker, hatched mountains outside the playable
 * square.
 */
export function shadeRelief(world: World, theme: TacticalTheme, size: number): Uint8ClampedArray<ArrayBuffer> {
  const n = Math.max(2, Math.floor(size));
  const { heights, min, max } = sampleHeights(world, n);
  const half = world.terrain.halfSize;
  const step = (2 * half) / n;
  const limit = world.playableHalfSize;
  const span = max - min;
  const low = theme.terrainLow;
  const high = theme.terrainHigh;
  const mountain = theme.mountain;
  const line = theme.contour;
  const out = new Uint8ClampedArray(n * n * 4);
  const depths = sampleDepths(world, n);
  for (let j = 0; j < n; j++) {
    const z = -half + (j + 0.5) * step;
    const up = j > 0 ? j - 1 : j;
    const down = j < n - 1 ? j + 1 : j;
    for (let i = 0; i < n; i++) {
      const x = -half + (i + 0.5) * step;
      const left = i > 0 ? i - 1 : i;
      const right = i < n - 1 ? i + 1 : i;
      const k = j * n + i;
      const outside = Math.abs(x) > limit || Math.abs(z) > limit;
      if (depths && depths[k]! > 0) {
        shadeWater(out, depths, n, i, j, theme, outside);
        continue;
      }
      const h = heights[k]!;
      const hRight = heights[j * n + right]!;
      const hDown = heights[down * n + i]!;
      const dhdx = (hRight - heights[j * n + left]!) / ((right - left) * step);
      const dhdz = (hDown - heights[up * n + i]!) / ((down - up) * step);
      const lambert = (-dhdx * LIGHT_X + LIGHT_Y - dhdz * LIGHT_Z) / Math.sqrt(dhdx * dhdx + 1 + dhdz * dhdz);
      let light = clamp(0.35 + (0.65 * lambert) / LIGHT_Y, 0.25, 1.45);
      let r: number;
      let g: number;
      let b: number;
      if (outside) {
        light *= MOUNTAIN_DIM;
        r = mountain[0];
        g = mountain[1];
        b = mountain[2];
      } else {
        const t = clamp((h - min) / span, 0, 1);
        r = low[0] + (high[0] - low[0]) * t;
        g = low[1] + (high[1] - low[1]) * t;
        b = low[2] + (high[2] - low[2]) * t;
      }
      r *= light;
      g *= light;
      b *= light;

      const level = Math.floor(h / CONTOUR_INTERVAL);
      const levelRight = Math.floor(hRight / CONTOUR_INTERVAL);
      const levelDown = Math.floor(hDown / CONTOUR_INTERVAL);
      if (level !== levelRight || level !== levelDown) {
        const isIndex = Math.max(level, levelRight, levelDown) % INDEX_CONTOUR_EVERY === 0;
        if (isIndex || !outside) {
          const mix = outside ? MOUNTAIN_CONTOUR_MIX : isIndex ? INDEX_CONTOUR_MIX : MINOR_CONTOUR_MIX;
          r += (line[0] - r) * mix;
          g += (line[1] - g) * mix;
          b += (line[2] - b) * mix;
        }
      }
      if (outside && (i + j) % HATCH_SPACING === 0) {
        r *= HATCH_DARKEN;
        g *= HATCH_DARKEN;
        b *= HATCH_DARKEN;
      }
      const o = k * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Water depth at pixel centres over the full terrain square, or null when there is no water at all. */
function sampleDepths(world: World, size: number): Float32Array | null {
  const water = world.water;
  if (water.maxLevel === -Infinity) return null;
  const half = world.terrain.halfSize;
  const step = (2 * half) / size;
  const depths = new Float32Array(size * size);
  for (let j = 0; j < size; j++) {
    const z = -half + (j + 0.5) * step;
    for (let i = 0; i < size; i++) depths[j * size + i] = water.depthAt(-half + (i + 0.5) * step, z);
  }
  return depths;
}

/**
 * One water pixel: shallow-to-deep fill without hill shading or contours,
 * with the shoreline, the limit of wading and a hatch picked out in the
 * shore colour. Water beyond the playable square is dimmed like the
 * mountains around it.
 */
function shadeWater(out: Uint8ClampedArray, depths: Float32Array, n: number, i: number, j: number, theme: TacticalTheme, outside: boolean): void {
  const d = depths[j * n + i]!;
  const t = clamp(d / WATER_SHADE_DEPTH, 0, 1);
  const lo = theme.waterShallow;
  const hi = theme.waterDeep;
  const line = theme.shore;
  let r = lo[0] + (hi[0] - lo[0]) * t;
  let g = lo[1] + (hi[1] - lo[1]) * t;
  let b = lo[2] + (hi[2] - lo[2]) * t;
  const left = i > 0 ? depths[j * n + i - 1]! : d;
  const right = i < n - 1 ? depths[j * n + i + 1]! : d;
  const up = j > 0 ? depths[(j - 1) * n + i]! : d;
  const down = j < n - 1 ? depths[(j + 1) * n + i]! : d;
  const deep = WATER.impassableDepth;
  let mix = 0;
  if (left <= 0 || right <= 0 || up <= 0 || down <= 0) mix = SHORELINE_MIX;
  else if (d > deep !== right > deep || d > deep !== down > deep) mix = DEEP_EDGE_MIX;
  else if (j % WATER_HATCH_SPACING === 0) mix = WATER_HATCH_MIX;
  r += (line[0] - r) * mix;
  g += (line[1] - g) * mix;
  b += (line[2] - b) * mix;
  if (outside) {
    r *= MOUNTAIN_DIM;
    g *= MOUNTAIN_DIM;
    b *= MOUNTAIN_DIM;
  }
  const o = (j * n + i) * 4;
  out[o] = r;
  out[o + 1] = g;
  out[o + 2] = b;
  out[o + 3] = 255;
}

/** Last-known state of an enemy under radar intel. */
export interface Contact {
  readonly kind: EnemyKind;
  x: number;
  z: number;
  heading: number;
  /** Simulation time of the last detection; -Infinity when never detected. */
  seenAt: number;
  /** Currently detected (within radar range or in line of sight). */
  live: boolean;
  visible: boolean;
  losCheckedAt: number;
  stamp: number;
}

/** Seconds between line-of-sight checks per contact. */
const LOS_INTERVAL = 0.25;
/** Line-of-sight detection only applies within this distance (m). */
export const VISUAL_RANGE = 900;
const EYE_HEIGHT = 3.2;
const TARGET_HEIGHT = 2;

/**
 * Remembers where each enemy was last detected. An enemy is detected when it
 * is within radar range of the player or the living player has line of sight
 * to it; otherwise its last-known position is kept until it leaves the sim.
 */
export class ContactTracker {
  private readonly contacts = new Map<number, Contact>();
  private stamp = 0;

  get(tankId: number): Contact | undefined {
    return this.contacts.get(tankId);
  }

  get size(): number {
    return this.contacts.size;
  }

  clear(): void {
    this.contacts.clear();
  }

  update(sim: Simulation, radarRange: number): void {
    const stamp = ++this.stamp;
    const rangeSq = radarRange > 0 ? radarRange * radarRange : 0;
    for (const entry of sim.enemies) {
      const t = entry.tank;
      let c = this.contacts.get(t.id);
      if (!c) {
        c = { kind: entry.kind, x: t.x, z: t.z, heading: t.heading, seenAt: -Infinity, live: false, visible: false, losCheckedAt: -Infinity, stamp };
        this.contacts.set(t.id, c);
      }
      c.stamp = stamp;
      c.live = t.alive && this.isDetected(sim, t, c, rangeSq);
      if (!c.live) continue;
      c.x = t.x;
      c.z = t.z;
      c.heading = t.heading;
      c.seenAt = sim.time;
    }
    for (const [id, c] of this.contacts) if (c.stamp !== stamp) this.contacts.delete(id);
  }

  private isDetected(sim: Simulation, t: Tank, c: Contact, rangeSq: number): boolean {
    const p = sim.player;
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const distSq = dx * dx + dz * dz;
    if (distSq <= rangeSq) return true;
    if (!p.alive || distSq > VISUAL_RANGE * VISUAL_RANGE) return false;
    if (sim.time - c.losCheckedAt >= LOS_INTERVAL || sim.time < c.losCheckedAt) {
      c.visible = sim.world.hasLineOfSight(p.x, p.y + EYE_HEIGHT, p.z, t.x, t.y + TARGET_HEIGHT, t.z);
      c.losCheckedAt = sim.time;
    }
    return c.visible;
  }
}
