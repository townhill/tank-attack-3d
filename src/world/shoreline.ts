/**
 * Shorelines: where the water level meets the ground, traced over the
 * terrain's own triangles. Depth varies linearly across each triangle, so
 * the traced line lies exactly where the drawn water meets the drawn ground.
 */
import type { Terrain } from './Terrain';

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
