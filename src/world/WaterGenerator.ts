/**
 * Seeded rivers, lakes and ponds. River courses follow the valleys of the raw
 * heightfield from one edge of the map to the other; lakes settle in its
 * hollows. Carving then cuts channels and bowls, shapes the banks, lowers the
 * valley sides and records the water level of every wet vertex.
 */
import type { RiverValley } from '../config/settings';
import { TERRAIN_TYPES } from '../config/settings';
import { MinHeap } from '../utils/heap';
import { clamp, lerp, smoothstep } from '../utils/math';
import { SimplexNoise2D } from '../utils/noise';
import { Random } from '../utils/random';
import type { Terrain } from './Terrain';
import type { Lake, LakeKind, River, RiverSample } from './Water';
import { lakeRadiusAt } from './Water';

/** Height of a bank above the water it holds (metres). */
export const BANK_FREEBOARD = 1.6;
/** Width over which a bank rises from the waterline to its full height (metres). */
export const BANK_WIDTH = 6;
/** Water keeps at least this far from the player's spawn point (metres). */
export const SPAWN_WATER_CLEARANCE = 160;

/** Steepest valley side cut down towards the water inside the playable square... */
const VALLEY_SLOPE = 0.4;
/** ...and the gorge walls where a river cuts through the boundary mountains. */
const GORGE_SLOPE = 1.2;
/** Ground further than this beyond a lake's bank top is never touched (metres); rivers take theirs from the valley. */
const LAKE_REACH = 80;

/** Spacing of the coarse grid river courses are planned on (metres). */
const COURSE_CELL = 20;
/** Extra course cost per metre above the lowest ground in the playable square. */
const COURSE_HEIGHT_COST = 0.08;
/** Band inside the boundary that courses cross rather than follow, and its cost. */
const COURSE_EDGE_BAND = 80;
const COURSE_EDGE_COST = 8;
const COURSE_SPAWN_RADIUS = SPAWN_WATER_CLEARANCE + 80;
const COURSE_SPAWN_COST = 500;
const COURSE_RIVER_COST = 200;
/** Rivers keep at least this far apart (metres). */
const RIVER_SPACING = 260;
const SAMPLE_SPACING = 4;
const MEANDER_AMPLITUDE = 18;
const MEANDER_WAVELENGTH = 220;
const HALF_WIDTH_RANGE: readonly [number, number] = [10, 16];
const DEPTH_RANGE: readonly [number, number] = [2.6, 4.2];
/** Depth never exceeds this fraction of the half width, so the channel sides stay gentle. */
const MAX_DEPTH_RATIO = 0.28;
/** The surface sits this much further below the banks to allow for small dips (metres). */
const SURFACE_MARGIN = 0.4;
/** Steepest fall of the water surface along a river; the river is cut lower upstream of a dip instead. */
const MAX_SURFACE_GRADIENT = 0.015;
/** A river must run at least this far (as a multiple of the playable half size) well inside the square. */
const MIN_INSIDE_LENGTH = 1.2;
/** Margin inside the playable square used for the length rule (metres). */
const INSIDE_MARGIN = 60;
/** Samples either side averaged when reading the ground along a course. */
const SURFACE_SMOOTHING = 8;
const RIVER_ATTEMPTS = 6;
/**
 * Where courses cross the boundary, measured from the middle: no nearer than
 * this to the spawn point (metres), so larger maps have room for several rivers...
 */
const CROSSING_INNER = 190;
/** ...and no further out than this fraction of the playable half size, leaving land to fight over beyond. */
const CROSSING_OUTER = 0.6;
/** Largest shift between where a course enters and leaves, as a fraction of the playable half size. */
const CROSSING_DRIFT = 0.25;
/** Arc length below which two samples of one river may lie close together (metres). */
const SELF_APPROACH_ARC = 120;
const SELF_APPROACH_GAP = 20;

const LAKE_RADIUS: readonly [number, number] = [45, 80];
const POND_RADIUS: readonly [number, number] = [14, 24];
const LAKE_DEPTH: readonly [number, number] = [3.5, 5.5];
const POND_DEPTH: readonly [number, number] = [2, 2.8];
const LAKE_SHAPE_POINTS = 12;
/** A shoreline never reaches beyond this multiple of the mean radius. */
const LAKE_SHAPE_MAX = 1.25;
const LAKE_CANDIDATES = 24;
const LAKE_RIVER_CLEARANCE = 100;
const LAKE_SPACING = 80;
const LAKE_EDGE_MARGIN = 70;
/** Sites whose shoreline heights differ by more than this are too steep for a lake (metres). */
const LAKE_MAX_RELIEF = 10;
const LAKE_RING_SAMPLES = 16;
/** Lake surface below the mean ground height around its shore (metres). */
const LAKE_SURFACE_DROP = 0.6;

const NEIGHBOURS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** Plans `count` rivers that cross the battlefield side by side. */
export function planRivers(seed: number, terrain: Terrain, playableHalfSize: number, count: number): River[] {
  const rivers: River[] = [];
  if (count <= 0) return rivers;
  const rng = new Random(seed ^ 0x2c1b3c6d);
  const noise = new SimplexNoise2D(seed ^ 0x7f4a7c15);
  const grid = new CourseGrid(terrain, playableHalfSize);
  // Every river flows across the same axis, so their courses never cross.
  const alongZ = rng.chance(0.5);
  for (let n = 0; n < count; n++) {
    for (let attempt = 0; attempt < RIVER_ATTEMPTS; attempt++) {
      const river = planRiver(rivers.length, rng, noise, grid, terrain, playableHalfSize, alongZ, rivers);
      if (!river) continue;
      rivers.push(river);
      grid.avoid(river);
      break;
    }
  }
  return rivers;
}

function planRiver(
  id: number, rng: Random, noise: SimplexNoise2D, grid: CourseGrid, terrain: Terrain,
  playableHalfSize: number, alongZ: boolean, others: readonly River[],
): River | null {
  const side = rng.chance(0.5) ? 1 : -1;
  const inner = Math.min(CROSSING_INNER / playableHalfSize, CROSSING_OUTER);
  const entry = rng.range(inner, CROSSING_OUTER);
  const exit = clamp(entry + rng.range(-CROSSING_DRIFT, CROSSING_DRIFT), inner, CROSSING_OUTER);
  const flow = rng.chance(0.5) ? 1 : -1;
  const phase = rng.range(0, 100);
  const u0 = side * entry * playableHalfSize;
  const u1 = side * exit * playableHalfSize;
  const edge = terrain.halfSize - COURSE_CELL;
  const course = alongZ
    ? grid.course(grid.nodeAt(u0, -edge * flow), grid.nodeAt(u1, edge * flow))
    : grid.course(grid.nodeAt(-edge * flow, u0), grid.nodeAt(edge * flow, u1));
  if (!course) return null;
  let points = resample(chaikin(course, 3), SAMPLE_SPACING);
  points = resample(movingAverage(meander(points, noise, phase), 3), SAMPLE_SPACING);
  const samples = describeRiver(points, terrain, playableHalfSize, noise, phase);
  if (!samples || !keepsClear(samples, others)) return null;
  return { id, samples };
}

/** Widths, depths, flow directions and a never-rising surface along a course. */
function describeRiver(
  points: readonly number[], terrain: Terrain, playableHalfSize: number, noise: SimplexNoise2D, phase: number,
): RiverSample[] | null {
  const count = points.length / 2;
  const ground = new Float64Array(count);
  const arc = new Float64Array(count);
  let first = -1;
  let last = -1;
  let wellInside = 0;
  for (let k = 0; k < count; k++) {
    const x = points[2 * k]!;
    const z = points[2 * k + 1]!;
    ground[k] = terrain.heightAt(x, z);
    if (k > 0) arc[k] = arc[k - 1]! + Math.hypot(x - points[2 * k - 2]!, z - points[2 * k - 1]!);
    const inset = playableHalfSize - Math.max(Math.abs(x), Math.abs(z));
    if (inset >= INSIDE_MARGIN) wellInside++;
    if (inset >= 0) {
      if (first < 0) first = k;
      last = k;
    }
  }
  // Courses that only clip a corner, or skirt the square outside it, are no use as a river.
  if (first < 0 || wellInside * SAMPLE_SPACING < MIN_INSIDE_LENGTH * playableHalfSize) return null;
  const smoothed = movingAverage1d(ground, SURFACE_SMOOTHING);
  const surface = new Float64Array(count);
  let running = Infinity;
  for (let k = first; k <= last; k++) {
    running = Math.min(running, smoothed[k]!);
    surface[k] = running - BANK_FREEBOARD - SURFACE_MARGIN;
  }
  // Ease the fall into each dip: lower the water upstream rather than let it run in rapids.
  for (let k = last - 1; k >= first; k--) {
    surface[k] = Math.min(surface[k]!, surface[k + 1]! + MAX_SURFACE_GRADIENT * (arc[k + 1]! - arc[k]!));
  }
  for (let k = 0; k < first; k++) surface[k] = surface[first]!;
  for (let k = last + 1; k < count; k++) surface[k] = surface[last]!;

  const samples: RiverSample[] = [];
  for (let k = 0; k < count; k++) {
    const x = points[2 * k]!;
    const z = points[2 * k + 1]!;
    const s = arc[k]!;
    const ahead = Math.min(count - 1, k + 1);
    const behind = Math.max(0, k - 1);
    const dx = points[2 * ahead]! - points[2 * behind]!;
    const dz = points[2 * ahead + 1]! - points[2 * behind + 1]!;
    const len = Math.hypot(dx, dz) || 1;
    const halfWidth = lerp(HALF_WIDTH_RANGE[0], HALF_WIDTH_RANGE[1], 0.5 + 0.5 * noise.noise(s / 300, phase + 41.3));
    const depth = Math.min(lerp(DEPTH_RANGE[0], DEPTH_RANGE[1], 0.5 + 0.5 * noise.noise(s / 260, phase + 77.7)), MAX_DEPTH_RATIO * halfWidth);
    samples.push({ x, z, s, tx: dx / len, tz: dz / len, halfWidth, depth, surfaceY: surface[k]! });
  }
  return samples;
}

/** Spawn clearance, spacing from other rivers and no meander folding back on itself. */
function keepsClear(samples: readonly RiverSample[], others: readonly River[]): boolean {
  for (const p of samples) {
    if (Math.hypot(p.x, p.z) < SPAWN_WATER_CLEARANCE + p.halfWidth + BANK_WIDTH) return false;
  }
  for (let a = 0; a < samples.length; a += 4) {
    const p = samples[a]!;
    for (const other of others) {
      for (let b = 0; b < other.samples.length; b += 4) {
        const q = other.samples[b]!;
        if (Math.hypot(p.x - q.x, p.z - q.z) < RIVER_SPACING) return false;
      }
    }
    for (let b = a + 4; b < samples.length; b += 4) {
      const q = samples[b]!;
      if (q.s - p.s < SELF_APPROACH_ARC) continue;
      if (Math.hypot(p.x - q.x, p.z - q.z) < 2 * (p.halfWidth + BANK_WIDTH) + SELF_APPROACH_GAP) return false;
    }
  }
  return true;
}

/** Coarse cost grid over the whole terrain on which river courses are planned. */
class CourseGrid {
  readonly n: number;
  private readonly origin: number;
  private readonly cost: Float32Array;
  private readonly avoided: Uint8Array;

  constructor(terrain: Terrain, playableHalfSize: number) {
    this.origin = -terrain.halfSize;
    this.n = Math.floor((2 * terrain.halfSize) / COURSE_CELL) + 1;
    const n = this.n;
    const heights = new Float32Array(n * n);
    let low = Infinity;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = this.coord(i);
        const z = this.coord(j);
        const h = terrain.heightAt(x, z);
        heights[j * n + i] = h;
        if (Math.max(Math.abs(x), Math.abs(z)) <= playableHalfSize) low = Math.min(low, h);
      }
    }
    this.cost = new Float32Array(n * n);
    this.avoided = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = this.coord(i);
        const z = this.coord(j);
        const inset = playableHalfSize - Math.max(Math.abs(x), Math.abs(z));
        let c = 1 + COURSE_HEIGHT_COST * Math.max(0, heights[j * n + i]! - low);
        // On either side of the boundary, so courses cross it rather than run along it.
        if (Math.abs(inset) < COURSE_EDGE_BAND) c += COURSE_EDGE_COST;
        if (Math.hypot(x, z) < COURSE_SPAWN_RADIUS) c += COURSE_SPAWN_COST;
        this.cost[j * n + i] = c;
      }
    }
  }

  nodeAt(x: number, z: number): number {
    const last = this.n - 1;
    const i = clamp(Math.round((x - this.origin) / COURSE_CELL), 0, last);
    const j = clamp(Math.round((z - this.origin) / COURSE_CELL), 0, last);
    return j * this.n + i;
  }

  /** Raises the cost near a planned river so later courses keep their distance. */
  avoid(river: River): void {
    const n = this.n;
    const reach = Math.ceil(RIVER_SPACING / COURSE_CELL);
    for (const p of river.samples) {
      const ci = Math.round((p.x - this.origin) / COURSE_CELL);
      const cj = Math.round((p.z - this.origin) / COURSE_CELL);
      for (let j = Math.max(0, cj - reach); j <= Math.min(n - 1, cj + reach); j++) {
        for (let i = Math.max(0, ci - reach); i <= Math.min(n - 1, ci + reach); i++) {
          const k = j * n + i;
          if (this.avoided[k] === 1 || Math.hypot(this.coord(i) - p.x, this.coord(j) - p.z) > RIVER_SPACING) continue;
          this.avoided[k] = 1;
          this.cost[k] = this.cost[k]! + COURSE_RIVER_COST;
        }
      }
    }
  }

  /** Cheapest eight-connected course between two nodes as flat [x0, z0, x1, z1, ...], or null. */
  course(from: number, to: number): number[] | null {
    const n = this.n;
    const dist = new Float64Array(n * n).fill(Infinity);
    const prev = new Int32Array(n * n).fill(-1);
    const heap = new MinHeap(1024);
    dist[from] = 0;
    heap.push(from, 0);
    while (heap.size > 0) {
      const key = heap.peekKey();
      const k = heap.pop();
      if (key > dist[k]!) continue;
      if (k === to) break;
      const i = k % n;
      const j = (k - i) / n;
      for (const [di, dj, len] of NEIGHBOURS) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const nk = nj * n + ni;
        const next = dist[k]! + len * COURSE_CELL * 0.5 * (this.cost[k]! + this.cost[nk]!);
        if (next < dist[nk]!) {
          dist[nk] = next;
          prev[nk] = k;
          heap.push(nk, next);
        }
      }
    }
    if (from !== to && prev[to] === -1) return null;
    const nodes: number[] = [];
    for (let k = to; k !== -1; k = prev[k]!) nodes.push(k);
    nodes.reverse();
    const points: number[] = [];
    for (const k of nodes) points.push(this.coord(k % n), this.coord(Math.floor(k / n)));
    return points;
  }

  private coord(index: number): number {
    return this.origin + index * COURSE_CELL;
  }
}

/** Chaikin corner cutting on a flat [x, z, ...] polyline, keeping its end points. */
function chaikin(points: readonly number[], iterations: number): number[] {
  let current = points.slice();
  for (let it = 0; it < iterations; it++) {
    const count = current.length / 2;
    if (count < 3) return current;
    const next: number[] = [current[0]!, current[1]!];
    for (let k = 0; k + 1 < count; k++) {
      const ax = current[2 * k]!;
      const az = current[2 * k + 1]!;
      const bx = current[2 * k + 2]!;
      const bz = current[2 * k + 3]!;
      next.push(0.75 * ax + 0.25 * bx, 0.75 * az + 0.25 * bz, 0.25 * ax + 0.75 * bx, 0.25 * az + 0.75 * bz);
    }
    next.push(current[current.length - 2]!, current[current.length - 1]!);
    current = next;
  }
  return current;
}

/** Re-spaces a flat [x, z, ...] polyline into evenly spaced points, keeping both ends. */
function resample(points: readonly number[], spacing: number): number[] {
  const count = points.length / 2;
  let total = 0;
  for (let k = 1; k < count; k++) total += Math.hypot(points[2 * k]! - points[2 * k - 2]!, points[2 * k + 1]! - points[2 * k - 1]!);
  const steps = Math.max(1, Math.round(total / spacing));
  const out: number[] = [points[0]!, points[1]!];
  let segment = 1;
  let segmentStart = 0;
  let segmentLength = Math.hypot(points[2]! - points[0]!, points[3]! - points[1]!);
  for (let step = 1; step < steps; step++) {
    const target = (total * step) / steps;
    while (segmentStart + segmentLength < target && segment < count - 1) {
      segmentStart += segmentLength;
      segment++;
      segmentLength = Math.hypot(points[2 * segment]! - points[2 * segment - 2]!, points[2 * segment + 1]! - points[2 * segment - 1]!);
    }
    const t = segmentLength > 0 ? (target - segmentStart) / segmentLength : 0;
    out.push(
      lerp(points[2 * segment - 2]!, points[2 * segment]!, t),
      lerp(points[2 * segment - 1]!, points[2 * segment + 1]!, t),
    );
  }
  out.push(points[points.length - 2]!, points[points.length - 1]!);
  return out;
}

/** Bends an evenly spaced course from side to side with low-frequency noise. */
function meander(points: readonly number[], noise: SimplexNoise2D, phase: number): number[] {
  const count = points.length / 2;
  const out: number[] = [];
  for (let k = 0; k < count; k++) {
    const ahead = Math.min(count - 1, k + 1);
    const behind = Math.max(0, k - 1);
    const dx = points[2 * ahead]! - points[2 * behind]!;
    const dz = points[2 * ahead + 1]! - points[2 * behind + 1]!;
    const len = Math.hypot(dx, dz) || 1;
    const offset = MEANDER_AMPLITUDE * noise.noise((k * SAMPLE_SPACING) / MEANDER_WAVELENGTH, phase);
    out.push(points[2 * k]! - (dz / len) * offset, points[2 * k + 1]! + (dx / len) * offset);
  }
  return out;
}

/** Moving average over `radius` points each side of a flat [x, z, ...] polyline; end points stay put. */
function movingAverage(points: readonly number[], radius: number): number[] {
  const count = points.length / 2;
  const out = points.slice();
  for (let k = 1; k < count - 1; k++) {
    const r = Math.min(radius, k, count - 1 - k);
    let sx = 0;
    let sz = 0;
    for (let m = k - r; m <= k + r; m++) {
      sx += points[2 * m]!;
      sz += points[2 * m + 1]!;
    }
    out[2 * k] = sx / (2 * r + 1);
    out[2 * k + 1] = sz / (2 * r + 1);
  }
  return out;
}

function movingAverage1d(values: Float64Array, radius: number): Float64Array {
  const out = new Float64Array(values.length);
  for (let k = 0; k < values.length; k++) {
    const lo = Math.max(0, k - radius);
    const hi = Math.min(values.length - 1, k + radius);
    let sum = 0;
    for (let m = lo; m <= hi; m++) sum += values[m]!;
    out[k] = sum / (hi - lo + 1);
  }
  return out;
}

/** Plans lakes and ponds in low, fairly level spots clear of the rivers and each other. */
export function planLakes(
  seed: number, terrain: Terrain, playableHalfSize: number, rivers: readonly River[], lakeCount: number, pondCount: number,
): Lake[] {
  const rng = new Random(seed ^ 0x6a09e667);
  const lakes: Lake[] = [];
  const kinds: LakeKind[] = [];
  for (let k = 0; k < lakeCount; k++) kinds.push('lake');
  for (let k = 0; k < pondCount; k++) kinds.push('pond');
  for (const kind of kinds) {
    const lake = planLake(lakes.length, kind, rng, terrain, playableHalfSize, rivers, lakes);
    if (lake) lakes.push(lake);
  }
  return lakes;
}

function planLake(
  id: number, kind: LakeKind, rng: Random, terrain: Terrain, playableHalfSize: number,
  rivers: readonly River[], lakes: readonly Lake[],
): Lake | null {
  const radiusRange = kind === 'lake' ? LAKE_RADIUS : POND_RADIUS;
  const depthRange = kind === 'lake' ? LAKE_DEPTH : POND_DEPTH;
  const radius = rng.range(radiusRange[0], radiusRange[1]);
  const maxDepth = rng.range(depthRange[0], depthRange[1]);
  const shape = lakeShape(rng);
  const reach = radius * LAKE_SHAPE_MAX;
  const limit = playableHalfSize - reach - LAKE_EDGE_MARGIN;
  let best: Lake | null = null;
  for (let c = 0; c < LAKE_CANDIDATES; c++) {
    const x = rng.range(-limit, limit);
    const z = rng.range(-limit, limit);
    if (limit <= 0) continue;
    if (Math.hypot(x, z) - reach < SPAWN_WATER_CLEARANCE + BANK_WIDTH) continue;
    if (isNearRiver(rivers, x, z, reach + LAKE_RIVER_CLEARANCE)) continue;
    if (isNearLake(lakes, x, z, reach)) continue;
    const site: Lake = { id, kind, x, z, surfaceY: 0, radius, maxDepth, shape };
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (let a = 0; a < LAKE_RING_SAMPLES; a++) {
      const angle = (a / LAKE_RING_SAMPLES) * Math.PI * 2;
      const r = lakeRadiusAt(site, angle);
      const h = terrain.heightAt(x + Math.cos(angle) * r, z + Math.sin(angle) * r);
      min = Math.min(min, h);
      max = Math.max(max, h);
      sum += h;
    }
    if (max - min > LAKE_MAX_RELIEF) continue;
    const surfaceY = sum / LAKE_RING_SAMPLES - LAKE_SURFACE_DROP;
    if (!best || surfaceY < best.surfaceY) best = { ...site, surfaceY };
  }
  return best;
}

/** Smoothly varying shoreline radius multipliers around a lake. */
function lakeShape(rng: Random): number[] {
  const raw = Array.from({ length: LAKE_SHAPE_POINTS }, () => rng.range(0.82, 1.18));
  const n = raw.length;
  return raw.map((v, k) => (raw[(k + n - 1) % n]! + 2 * v + raw[(k + 1) % n]!) / 4);
}

function isNearRiver(rivers: readonly River[], x: number, z: number, distance: number): boolean {
  for (const river of rivers) {
    for (const p of river.samples) {
      if (Math.hypot(p.x - x, p.z - z) - p.halfWidth < distance) return true;
    }
  }
  return false;
}

function isNearLake(lakes: readonly Lake[], x: number, z: number, reach: number): boolean {
  for (const other of lakes) {
    if (Math.hypot(other.x - x, other.z - z) - other.radius * LAKE_SHAPE_MAX - reach < LAKE_SPACING) return true;
  }
  return false;
}

/**
 * Carves every river and lake into the terrain heights and returns the water
 * level per vertex: set on wet vertices and their neighbours, NaN elsewhere.
 * Rivers cut their valleys as `valley` describes; Gentle's has no bench.
 */
export function carveWater(
  terrain: Terrain, rivers: readonly River[], lakes: readonly Lake[], playableHalfSize: number,
  valley: RiverValley = TERRAIN_TYPES.gentle.profile.riverValley,
): Float32Array {
  const level = new Float32Array(terrain.heights.length).fill(Number.NaN);
  for (const river of rivers) carveRiver(terrain, river, level, playableHalfSize, valley);
  for (const lake of lakes) carveLake(terrain, lake, level, playableHalfSize);
  return dilateLevels(terrain, level);
}

function carveRiver(terrain: Terrain, river: River, level: Float32Array, playableHalfSize: number, valley: RiverValley): void {
  const samples = river.samples;
  const res = terrain.resolution;
  const heights = terrain.heights;
  let widest = 0;
  for (const p of samples) widest = Math.max(widest, p.halfWidth);
  const reach = widest + BANK_WIDTH + valley.reach;
  const nearest = new Float32Array(res * res).fill(Infinity);
  const along = new Float32Array(res * res);
  for (let k = 0; k + 1 < samples.length; k++) {
    const a = samples[k]!;
    const b = samples[k + 1]!;
    const sx = b.x - a.x;
    const sz = b.z - a.z;
    const lenSq = sx * sx + sz * sz || 1;
    const [i0, i1] = vertexRange(terrain, Math.min(a.x, b.x) - reach, Math.max(a.x, b.x) + reach);
    const [j0, j1] = vertexRange(terrain, Math.min(a.z, b.z) - reach, Math.max(a.z, b.z) + reach);
    for (let j = j0; j <= j1; j++) {
      const z = terrain.vertexZ(j);
      for (let i = i0; i <= i1; i++) {
        const x = terrain.vertexX(i);
        const t = clamp(((x - a.x) * sx + (z - a.z) * sz) / lenSq, 0, 1);
        const d = Math.hypot(x - a.x - sx * t, z - a.z - sz * t);
        const v = j * res + i;
        if (d < nearest[v]!) {
          nearest[v] = d;
          along[v] = k + t;
        }
      }
    }
  }
  for (let v = 0; v < nearest.length; v++) {
    const d = nearest[v]!;
    if (d >= reach) continue;
    const k = Math.floor(along[v]!);
    const t = along[v]! - k;
    const a = samples[k]!;
    const b = samples[Math.min(k + 1, samples.length - 1)]!;
    const halfWidth = lerp(a.halfWidth, b.halfWidth, t);
    const surface = lerp(a.surfaceY, b.surfaceY, t);
    const i = v % res;
    const x = terrain.vertexX(i);
    const z = terrain.vertexZ((v - i) / res);
    const orig = heights[v]!;
    if (d <= halfWidth) {
      const bed = surface - lerp(a.depth, b.depth, t) * 0.5 * (1 + Math.cos((Math.PI * d) / halfWidth));
      heights[v] = Math.min(orig, bed);
      raiseLevel(level, v, surface);
    } else {
      heights[v] = shoreHeight(orig, d - halfWidth, surface, sideSlope(x, z, playableHalfSize), valley);
    }
  }
}

function carveLake(terrain: Terrain, lake: Lake, level: Float32Array, playableHalfSize: number): void {
  const res = terrain.resolution;
  const heights = terrain.heights;
  const reach = lake.radius * LAKE_SHAPE_MAX + BANK_WIDTH + LAKE_REACH;
  const [i0, i1] = vertexRange(terrain, lake.x - reach, lake.x + reach);
  const [j0, j1] = vertexRange(terrain, lake.z - reach, lake.z + reach);
  for (let j = j0; j <= j1; j++) {
    const z = terrain.vertexZ(j);
    for (let i = i0; i <= i1; i++) {
      const x = terrain.vertexX(i);
      const dx = x - lake.x;
      const dz = z - lake.z;
      const d = Math.hypot(dx, dz);
      const r = lakeRadiusAt(lake, Math.atan2(dz, dx));
      const e = d - r;
      if (e >= BANK_WIDTH + LAKE_REACH) continue;
      const v = j * res + i;
      const orig = heights[v]!;
      if (e <= 0) {
        const u = d / r;
        heights[v] = Math.min(orig, lake.surfaceY - lake.maxDepth * (1 - u * u));
        raiseLevel(level, v, lake.surfaceY);
      } else {
        heights[v] = shoreHeight(orig, e, lake.surfaceY, sideSlope(x, z, playableHalfSize));
      }
    }
  }
}

/**
 * Ground `e` metres beyond a waterline at `surface`: a bank rising to the
 * freeboard, then ground that meets the land around it no steeper than
 * `slope`, cutting a valley side into higher ground and building up the
 * outer face of a levee over lower ground.
 */
/**
 * Ground `e` metres beyond the waterline: the bank, then natural ground held
 * within walls of `slope` either side of the bank top. A valley bench, when
 * there is one, rises gently before the walls take over.
 */
function shoreHeight(orig: number, e: number, surface: number, slope: number, valley: RiverValley | null = null): number {
  if (e <= BANK_WIDTH) return surface + BANK_FREEBOARD * smoothstep(0, BANK_WIDTH, e);
  const top = surface + BANK_FREEBOARD;
  const run = e - BANK_WIDTH;
  const spread = valley && valley.benchWidth > 0
    ? valley.benchSlope * Math.min(run, valley.benchWidth) + slope * Math.max(0, run - valley.benchWidth)
    : slope * run;
  return clamp(orig, top - spread, top + spread);
}

/** Valley sides stay gentle inside the playable square and steepen into gorges beyond it. */
function sideSlope(x: number, z: number, playableHalfSize: number): number {
  const outside = Math.max(Math.abs(x), Math.abs(z)) - playableHalfSize;
  return lerp(VALLEY_SLOPE, GORGE_SLOPE, smoothstep(20, 80, outside));
}

function raiseLevel(level: Float32Array, v: number, surface: number): void {
  if (!(level[v]! >= surface)) level[v] = surface;
}

/** Copies each wet vertex's level onto its dry neighbours so shorelines interpolate correctly. */
function dilateLevels(terrain: Terrain, level: Float32Array): Float32Array {
  const res = terrain.resolution;
  const out = level.slice();
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const v = j * res + i;
      if (!Number.isNaN(level[v]!)) continue;
      let best = Number.NaN;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= res || nj >= res) continue;
          const neighbour = level[nj * res + ni]!;
          if (!Number.isNaN(neighbour) && !(neighbour <= best)) best = neighbour;
        }
      }
      out[v] = best;
    }
  }
  return out;
}

/** Inclusive range of vertex indices whose coordinates fall within [min, max]. */
function vertexRange(terrain: Terrain, min: number, max: number): [number, number] {
  const last = terrain.resolution - 1;
  return [
    clamp(Math.floor((min + terrain.halfSize) / terrain.cellSize), 0, last),
    clamp(Math.ceil((max + terrain.halfSize) / terrain.cellSize), 0, last),
  ];
}
