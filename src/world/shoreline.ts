/**
 * Shorelines: where the water level meets the ground, traced over the
 * terrain's own triangles. Depth varies linearly across each triangle, so
 * the traced line lies exactly where the drawn water meets the drawn ground.
 */
import { clamp } from '../utils/math';
import type { Terrain } from './Terrain';

/** Height above the water over which a bank dries out (metres): a little above the banks' freeboard, so bank tops stay damp. */
const WET_RISE = 3;
/** Depth below the water over which the bed loses its wet look (metres). */
const WET_DEPTH = 1.2;
/** Share of a bank vertex's wetness that soaks one vertex further inland. */
const WET_SPREAD = 0.5;

/**
 * Wetness of the ground at each terrain vertex, 0..1: 1 at the waterline,
 * falling to 0 over WET_RISE up the bank and WET_DEPTH down into the water,
 * with a little soaked one vertex beyond the ring the water level reaches.
 * The terrain draws it as a darker, glistening band along every shore.
 */
export function shoreWetness(terrain: Terrain, level: Float32Array): Float32Array {
  const heights = terrain.heights;
  const wet = new Float32Array(level.length);
  for (let k = 0; k < level.length; k++) {
    const l = level[k]!;
    if (Number.isNaN(l)) continue;
    const above = heights[k]! - l;
    wet[k] = above >= 0 ? clamp(1 - above / WET_RISE, 0, 1) : clamp(1 + above / WET_DEPTH, 0, 1);
  }
  const res = terrain.resolution;
  const soaked = wet.slice();
  for (let k = 0; k < level.length; k++) {
    if (!Number.isNaN(level[k]!)) continue;
    const i = k % res;
    let most = 0;
    if (i > 0 && !Number.isNaN(level[k - 1]!)) most = Math.max(most, wet[k - 1]!);
    if (i < res - 1 && !Number.isNaN(level[k + 1]!)) most = Math.max(most, wet[k + 1]!);
    if (k >= res && !Number.isNaN(level[k - res]!)) most = Math.max(most, wet[k - res]!);
    if (k + res < level.length && !Number.isNaN(level[k + res]!)) most = Math.max(most, wet[k + res]!);
    soaked[k] = most * WET_SPREAD;
  }
  return soaked;
}

/**
 * Shoreline segments as flat [x0, y0, z0, x1, y1, z1, ...] pairs at the water
 * level raised by `lift`, for every triangle the waterline crosses.
 */
export function shorelineSegments(terrain: Terrain, level: Float32Array, lift: number): number[] {
  const out: number[] = [];
  const res = terrain.resolution;
  for (let j = 0; j < res - 1; j++) {
    for (let i = 0; i < res - 1; i++) {
      const a = j * res + i;
      const b = a + 1;
      const d = a + res;
      const c = d + 1;
      // The same two triangles per cell as the terrain mesh, split along a -> c.
      crossTriangle(terrain, level, lift, a, c, b, out);
      crossTriangle(terrain, level, lift, a, d, c, out);
    }
  }
  return out;
}

const crossings: number[] = [];

function crossTriangle(terrain: Terrain, level: Float32Array, lift: number, p: number, q: number, r: number, out: number[]): void {
  const lp = level[p]!;
  const lq = level[q]!;
  const lr = level[r]!;
  if (Number.isNaN(lp) || Number.isNaN(lq) || Number.isNaN(lr)) return;
  crossings.length = 0;
  crossEdge(terrain, level, lift, p, q);
  crossEdge(terrain, level, lift, q, r);
  crossEdge(terrain, level, lift, r, p);
  if (crossings.length !== 6) return;
  if (Math.hypot(crossings[3]! - crossings[0]!, crossings[5]! - crossings[2]!) < 1e-6) return;
  for (const v of crossings) out.push(v);
}

/** Appends the point where depth falls to zero along edge u -> v, if the edge is wet at one end only. */
function crossEdge(terrain: Terrain, level: Float32Array, lift: number, u: number, v: number): void {
  const du = level[u]! - terrain.heights[u]!;
  const dv = level[v]! - terrain.heights[v]!;
  if (du > 0 === dv > 0) return;
  const t = du / (du - dv);
  const res = terrain.resolution;
  const ui = u % res;
  const vi = v % res;
  const x = terrain.vertexX(ui) + (terrain.vertexX(vi) - terrain.vertexX(ui)) * t;
  const z = terrain.vertexZ((u - ui) / res) + (terrain.vertexZ((v - vi) / res) - terrain.vertexZ((u - ui) / res)) * t;
  crossings.push(x, level[u]! + (level[v]! - level[u]!) * t + lift, z);
}
