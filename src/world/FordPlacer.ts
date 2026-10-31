/**
 * Rare shallow fords, when a battlefield asks for them: on each river, the
 * straight reach furthest from its bridges and from the edge of the
 * battlefield has its bed raised so tanks can wade across, slowed by the
 * water but not stopped. The water level stays where it was; only the ground
 * beneath it rises. Fords are off by default (a user setting), so a seed
 * keeps its layout.
 */
import { clamp, DEG, lerp, smoothstep } from '../utils/math';
import type { Bridge } from './Bridge';
import type { Terrain } from './Terrain';
import type { Ford, River } from './Water';

/** Water depth over the middle of a ford (metres): half what stops a tank. */
export const FORD_DEPTH = 0.6;
/** Half the length along the river of the level, shallow stretch (metres)... */
export const FORD_HALF_LENGTH = 10;
/** ...and of the slope back down to the natural bed beyond each end (metres). */
export const FORD_TAPER = 14;
/** Fords keep at least this far from every bridge (metres). */
export const FORD_BRIDGE_CLEARANCE = 100;
/** Fords keep this far inside the playable square (metres). */
const FORD_EDGE_MARGIN = 60;
/** The river may turn by at most MAX_FORD_BEND between this far above and below a ford (metres). */
const STRAIGHT_REACH = 30;
const MAX_FORD_BEND = 20 * DEG;

/** Fords every river once where a reach qualifies, raising the bed there. Returns the fords made. */
export function placeFords(terrain: Terrain, rivers: readonly River[], bridges: readonly Bridge[], playableHalfSize: number): Ford[] {
  const fords: Ford[] = [];
  for (const river of rivers) {
    const k = fordSite(river, bridges, playableHalfSize);
    if (k < 0) continue;
    const p = river.samples[k]!;
    raiseBed(terrain, river, k);
    fords.push({
      id: fords.length,
      riverId: river.id,
      x: p.x,
      z: p.z,
      s: p.s,
      tx: p.tx,
      tz: p.tz,
      halfWidth: p.halfWidth,
      halfLength: FORD_HALF_LENGTH,
      depth: FORD_DEPTH,
    });
  }
  return fords;
}

/**
 * Sample index of the best place to ford `river`: of the straight reaches
 * inside the battlefield and clear of every bridge, the one furthest from
 * the nearest bridge and from both ends of the river's stretch inside it.
 * The first of equals wins. Returns -1 when no reach qualifies.
 */
function fordSite(river: River, bridges: readonly Bridge[], playableHalfSize: number): number {
  const samples = river.samples;
  const limit = playableHalfSize - FORD_EDGE_MARGIN;
  const inside = (k: number): boolean => Math.max(Math.abs(samples[k]!.x), Math.abs(samples[k]!.z)) <= limit;
  let first = -1;
  let last = -1;
  for (let k = 0; k < samples.length; k++) {
    if (!inside(k)) continue;
    if (first < 0) first = k;
    last = k;
  }
  if (first < 0) return -1;
  const minTurn = Math.cos(MAX_FORD_BEND);
  let best = -1;
  let bestScore = -Infinity;
  for (let k = first; k <= last; k++) {
    if (!inside(k)) continue;
    const p = samples[k]!;
    let clearance = Infinity;
    for (const b of bridges) clearance = Math.min(clearance, Math.hypot(b.x - p.x, b.z - p.z));
    if (clearance < FORD_BRIDGE_CLEARANCE) continue;
    const above = sampleAt(river, p.s - STRAIGHT_REACH, k);
    const below = sampleAt(river, p.s + STRAIGHT_REACH, k);
    if (above.tx * below.tx + above.tz * below.tz < minTurn) continue;
    const score = Math.min(clearance, p.s - samples[first]!.s, samples[last]!.s - p.s);
    if (score > bestScore) {
      best = k;
      bestScore = score;
    }
  }
  return best;
}

/** The sample nearest arc length `s`, searching outwards from sample `k`. */
function sampleAt(river: River, s: number, k: number): River['samples'][number] {
  const samples = river.samples;
  let i = k;
  while (i > 0 && samples[i]!.s > s) i--;
  while (i < samples.length - 1 && samples[i]!.s < s) i++;
  return samples[i]!;
}

/**
 * Raises the bed of `river` around sample `k` to the ford's depth, sloping
 * back down to the natural bed over FORD_TAPER beyond each end. The channel
 * keeps its rounded cross-section, so the water still meets the banks where
 * it did. Ground already higher than the ford's bed is left alone.
 */
function raiseBed(terrain: Terrain, river: River, k: number): void {
  const samples = river.samples;
  const centre = samples[k]!;
  const extent = FORD_HALF_LENGTH + FORD_TAPER;
  let lo = k;
  let hi = k;
  let widest = 0;
  while (lo > 0 && centre.s - samples[lo - 1]!.s <= extent + centre.halfWidth) lo--;
  while (hi < samples.length - 1 && samples[hi + 1]!.s - centre.s <= extent + centre.halfWidth) hi++;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = lo; i <= hi; i++) {
    const p = samples[i]!;
    widest = Math.max(widest, p.halfWidth);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const res = terrain.resolution;
  const toIndex = (v: number): number => clamp(Math.round((v + terrain.halfSize) / terrain.cellSize), 0, res - 1);
  const heights = terrain.heights;
  for (let j = toIndex(minZ - widest); j <= toIndex(maxZ + widest); j++) {
    const z = terrain.vertexZ(j);
    for (let i = toIndex(minX - widest); i <= toIndex(maxX + widest); i++) {
      const x = terrain.vertexX(i);
      // Nearest point on the centreline between samples lo and hi.
      let nearest = Infinity;
      let seg = lo;
      let along = 0;
      for (let n = lo; n < hi; n++) {
        const a = samples[n]!;
        const b = samples[n + 1]!;
        const sx = b.x - a.x;
        const sz = b.z - a.z;
        const t = clamp(((x - a.x) * sx + (z - a.z) * sz) / (sx * sx + sz * sz || 1), 0, 1);
        const d = Math.hypot(x - a.x - sx * t, z - a.z - sz * t);
        if (d < nearest) {
          nearest = d;
          seg = n;
          along = t;
        }
      }
      const a = samples[seg]!;
      const b = samples[Math.min(seg + 1, hi)]!;
      const halfWidth = lerp(a.halfWidth, b.halfWidth, along);
      const offset = Math.abs(lerp(a.s, b.s, along) - centre.s);
      if (nearest > halfWidth || offset >= extent) continue;
      const depth = lerp(FORD_DEPTH, lerp(a.depth, b.depth, along), smoothstep(FORD_HALF_LENGTH, extent, offset));
      const bed = lerp(a.surfaceY, b.surfaceY, along) - depth * 0.5 * (1 + Math.cos((Math.PI * nearest) / halfWidth));
      const v = j * res + i;
      if (bed > heights[v]!) heights[v] = bed;
    }
  }
}
