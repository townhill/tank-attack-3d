/**
 * Surface flow of the rivers, rasterised on the terrain's vertex grid for the
 * water shader: fastest on the centreline, slowing to a standstill at the
 * banks. Lakes and ponds have no flow, so their ripples only drift in place.
 */
import { clamp } from '../utils/math';
import type { Terrain } from './Terrain';
import type { River } from './Water';

/** Surface speed on a river's centreline (metres per second). */
export const FLOW_PEAK_SPEED = 1.6;

/**
 * Flow velocity per terrain vertex as flat [vx, vz, ...] pairs. Vertices that
 * no river's water reaches, including every dry vertex, are left at zero.
 */
export function riverFlowField(terrain: Terrain, level: Float32Array, rivers: readonly River[]): Float32Array {
  const res = terrain.resolution;
  const flow = new Float32Array(res * res * 2);
  if (rivers.length === 0) return flow;
  const nearest = new Float32Array(res * res).fill(Infinity);
  for (const river of rivers) {
    const samples = river.samples;
    for (let k = 0; k + 1 < samples.length; k++) {
      const a = samples[k]!;
      const b = samples[k + 1]!;
      const sx = b.x - a.x;
      const sz = b.z - a.z;
      const lenSq = sx * sx + sz * sz || 1;
      const reach = Math.max(a.halfWidth, b.halfWidth);
      const [i0, i1] = vertexRange(terrain, Math.min(a.x, b.x) - reach, Math.max(a.x, b.x) + reach);
      const [j0, j1] = vertexRange(terrain, Math.min(a.z, b.z) - reach, Math.max(a.z, b.z) + reach);
      for (let j = j0; j <= j1; j++) {
        const z = terrain.vertexZ(j);
        for (let i = i0; i <= i1; i++) {
          const v = j * res + i;
          if (Number.isNaN(level[v]!)) continue;
          const x = terrain.vertexX(i);
          const t = clamp(((x - a.x) * sx + (z - a.z) * sz) / lenSq, 0, 1);
          const d = Math.hypot(x - a.x - sx * t, z - a.z - sz * t);
          if (d >= nearest[v]!) continue;
          nearest[v] = d;
          const halfWidth = a.halfWidth + (b.halfWidth - a.halfWidth) * t;
          const across = d / halfWidth;
          const speed = across >= 1 ? 0 : FLOW_PEAK_SPEED * (1 - across * across);
          const tx = a.tx + (b.tx - a.tx) * t;
          const tz = a.tz + (b.tz - a.tz) * t;
          const len = Math.hypot(tx, tz) || 1;
          flow[2 * v] = (tx / len) * speed;
          flow[2 * v + 1] = (tz / len) * speed;
        }
      }
    }
  }
  return flow;
}

/** Inclusive range of vertex indices whose coordinates fall within [min, max]. */
function vertexRange(terrain: Terrain, min: number, max: number): [number, number] {
  const last = terrain.resolution - 1;
  return [
    clamp(Math.floor((min + terrain.halfSize) / terrain.cellSize), 0, last),
    clamp(Math.ceil((max + terrain.halfSize) / terrain.cellSize), 0, last),
  ];
}
