/**
 * Chooses where roads cross each river, grades earth ramps up to every deck
 * and records the bridges. Crossings favour straight, narrow reaches with
 * banks of similar height, spread evenly along each river.
 */
import { BRIDGE } from '../config/settings';
import { angleDiff, clamp, DEG, headingOf, lerp, smoothstep } from '../utils/math';
import type { Bridge } from './Bridge';
import { DistanceField } from './distanceField';
import { toLocalX, toLocalZ, toWorldX, toWorldZ } from './Obstacle';
import type { Terrain } from './Terrain';
import type { River } from './Water';
import { waterDepthAt } from './Water';
import { BANK_FREEBOARD, BANK_WIDTH } from './WaterGenerator';

/** Longest span between bank tops (metres). */
const MAX_SPAN = 56;
/** How far out from the centreline to look for each bank top (metres), and the search step. */
const BANK_SEARCH = 45;
const SEARCH_STEP = 0.5;
const BANK_TOLERANCE = 0.05;
/** Offsets along the river of the lines on which bank tops are found (metres): the road, its shoulders and embankments. */
const BANK_LINES: readonly number[] = [-16, -8, 0, 8, 16];
/** Banks that differ by more than this across the deck mark a reach too irregular to bridge (metres). */
const MAX_BANK_SPREAD = 8;
/** Largest change of flow direction across the reach a bridge spans. */
const MAX_BEND = 30 * DEG;
/** Road height above the bank tops, so the deck clears the water (metres). */
const DECK_LIFT = 0.4;
/**
 * Most the road may rise further towards high banks, shortening the ramps;
 * the ground under the far end of each pad can still be raised that high
 * without standing taller than a bank there may (metres).
 */
const MAX_DECK_RAISE = 2.4;
/** Mid-span rise per metre of span, and its cap (metres). */
const ARCH_PER_METRE = 0.012;
const MAX_ARCH = 0.6;
/** Shortest and longest approach ramps (metres). */
const RAMP_LENGTH = 24;
const MAX_RAMP_LENGTH = 80;
/** Flat shoulder beside the road on the approaches, and the steepest embankment side. */
const SHOULDER = 2;
const SIDE_SLOPE = 0.4;
const MIN_SIDE_BLEND = 4;
const MAX_SIDE_REACH = 32;
/** How far the shoreline cap may sit below the road where tanks drive off the deck (metres). */
const SUPPORT_TOLERANCE = 0.05;
/** Ramps flatten into the natural ground over their last quarter. */
const RAMP_FADE_START = 0.75;
const PIER_SPACING = 16;
/** Approaches keep this far inside the playable square, and this far from water beside the road (metres). */
const EDGE_MARGIN = 40;
const APPROACH_CLEARANCE = 4;
/** Every Nth centreline sample is tried as a crossing. */
const CANDIDATE_STRIDE = 2;

interface RampEnd {
  readonly length: number;
  /** Natural ground height where the ramp meets it. */
  readonly height: number;
}

/** A checked place to build a bridge, before its approaches are graded. */
export interface Crossing {
  readonly riverId: number;
  /** Distance along the river (metres). */
  readonly s: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly halfSpan: number;
  readonly halfLength: number;
  readonly endY: number;
  readonly arch: number;
  readonly footY: number;
  /** Water surface of the river at the crossing. */
  readonly surfaceY: number;
  readonly piers: readonly number[];
  /** Ramps beyond the deck end at positive and at negative `along`. */
  readonly ramps: readonly [RampEnd, RampEnd];
  /** Higher is a better place to cross. */
  readonly score: number;
}

/** Spreads bridges evenly along every river, builds them and grades their approaches. */
export function placeBridges(terrain: Terrain, level: Float32Array, rivers: readonly River[], playableHalfSize: number): Bridge[] {
  const bridges: Bridge[] = [];
  const limit = playableHalfSize - EDGE_MARGIN;
  const shore = shoreField(terrain, level);
  for (const river of rivers) {
    const samples = river.samples;
    let first = -1;
    let last = -1;
    samples.forEach((p, k) => {
      if (Math.max(Math.abs(p.x), Math.abs(p.z)) > limit) return;
      if (first < 0) first = k;
      last = k;
    });
    if (first < 0) continue;
    const start = samples[first]!.s;
    const length = samples[last]!.s - start;
    const count = Math.max(Math.ceil(length / BRIDGE.maxSpacing), Math.min(2, Math.floor(length / BRIDGE.minSpacing) + 1));
    const built: number[] = [];
    const placeBest = (from: number, to: number): void => {
      let best: Crossing | null = null;
      for (let k = first; k <= last; k += CANDIDATE_STRIDE) {
        const s = samples[k]!.s;
        if (s < from || s > to || built.some((b) => Math.abs(s - b) < BRIDGE.minSpacing)) continue;
        const crossing = planCrossing(terrain, level, river, k, playableHalfSize, shore);
        if (crossing && (!best || crossing.score > best.score)) best = crossing;
      }
      if (!best) return;
      bridges.push(buildBridge(terrain, level, best, bridges.length, shore));
      built.push(best.s);
    };
    for (let part = 0; part < count; part++) {
      placeBest(start + (length * part) / count, start + (length * (part + 1)) / count);
    }
    // A stretch with nowhere to cross loses its bridge; make up a second one
    // anywhere along the river, so no river leaves a single choke point.
    const wanted = Math.min(2, count);
    while (built.length < wanted) {
      const before = built.length;
      placeBest(start, start + length);
      if (built.length === before) break;
    }
  }
  return bridges;
}

/** Checks whether a road can cross `river` square to the flow at sample `index`; null when it cannot. */
export function planCrossing(
  terrain: Terrain, level: Float32Array, river: River, index: number, playableHalfSize: number,
  shore: DistanceField = shoreField(terrain, level),
): Crossing | null {
  const samples = river.samples;
  const centre = samples[index];
  if (!centre) return null;
  const ax = -centre.tz;
  const az = centre.tx;
  // Banks are found along lines across the whole graded width, so on a bend no
  // corner of a pad lands on the bank slope.
  let plus = 0;
  let minus = 0;
  let nearestPlus = Infinity;
  let nearestMinus = Infinity;
  for (const offset of BANK_LINES) {
    const ox = centre.x + centre.tx * offset;
    const oz = centre.z + centre.tz * offset;
    const p = bankDistance(terrain, level, ox, oz, ax, az, centre.surfaceY);
    const m = bankDistance(terrain, level, ox, oz, -ax, -az, centre.surfaceY);
    if (p === null || m === null) return null;
    plus = Math.max(plus, p);
    minus = Math.max(minus, m);
    nearestPlus = Math.min(nearestPlus, p);
    nearestMinus = Math.min(nearestMinus, m);
  }
  if (plus - nearestPlus > MAX_BANK_SPREAD || minus - nearestMinus > MAX_BANK_SPREAD) return null;
  const halfSpan = (plus + minus) / 2;
  if (2 * halfSpan > MAX_SPAN) return null;

  const spacing = samples.length > 1 ? samples[1]!.s - samples[0]!.s : 1;
  const reach = Math.ceil((halfSpan + 10) / spacing);
  const before = samples[index - reach];
  const after = samples[index + reach];
  if (!before || !after) return null;
  const bend = Math.abs(angleDiff(headingOf(before.tx, before.tz), headingOf(after.tx, after.tz)));
  if (bend > MAX_BEND) return null;

  const x = centre.x + ax * ((plus - minus) / 2);
  const z = centre.z + az * ((plus - minus) / 2);
  const yaw = headingOf(ax, az);
  const halfLength = halfSpan + BRIDGE.bankOverlap;
  const hw = BRIDGE.deckHalfWidth;
  const groundAt = (along: number, lateral: number): number => terrain.heightAt(x + toWorldX(lateral, along, yaw), z + toWorldZ(lateral, along, yaw));

  const padHeight = (side: number): number => {
    let max = -Infinity;
    for (let a = halfSpan; a <= halfLength; a += 1) {
      for (const lateral of [-hw, 0, hw]) max = Math.max(max, groundAt(side * a, lateral));
    }
    return max;
  };
  const padPlus = padHeight(1);
  const padMinus = padHeight(-1);
  // The road sits just above the bank tops, rising a little towards higher
  // banks; ground above it is cut away, since raising ground beside the water
  // would leave a cliff at the shore.
  const lowest = centre.surfaceY + BANK_FREEBOARD + DECK_LIFT;
  const endY = lowest + clamp(Math.max(padPlus, padMinus) - lowest, 0, MAX_DECK_RAISE);
  const rampPlus = planRamp(groundAt, 1, halfLength, endY);
  const rampMinus = planRamp(groundAt, -1, halfLength, endY);
  if (!rampPlus || !rampMinus) return null;

  // Where tanks roll off the deck and down the ramps, the road must not need
  // ground higher than a bank may stand that close to the water.
  for (const [side, ramp] of [[1, rampPlus], [-1, rampMinus]] as const) {
    for (let a = halfLength - 1; a <= halfLength + ramp.length; a += 1) {
      const top = a <= halfLength ? endY : lerp(endY, ramp.height, (a - halfLength) / ramp.length);
      for (const lateral of [-hw, 0, hw]) {
        const px = x + toWorldX(lateral, side * a, yaw);
        const pz = z + toWorldZ(lateral, side * a, yaw);
        if (shoreCap(shore.sample(px, pz), centre.surfaceY) < top - SUPPORT_TOLERANCE) return null;
      }
    }
  }

  const limit = playableHalfSize - EDGE_MARGIN;
  for (const [side, ramp] of [[1, rampPlus], [-1, rampMinus]] as const) {
    for (let a = halfSpan; a <= halfLength + ramp.length + 10; a += 2) {
      for (const lateral of [-(hw + APPROACH_CLEARANCE), 0, hw + APPROACH_CLEARANCE]) {
        const px = x + toWorldX(lateral, side * a, yaw);
        const pz = z + toWorldZ(lateral, side * a, yaw);
        if (Math.max(Math.abs(px), Math.abs(pz)) > limit || waterDepthAt(terrain, level, px, pz) > 0) return null;
      }
    }
  }

  let footY = Infinity;
  for (let a = -halfSpan; a <= halfSpan; a += 1) footY = Math.min(footY, groundAt(a, 0));
  const spans = Math.max(1, Math.ceil((2 * halfSpan) / PIER_SPACING));
  const piers: number[] = [];
  for (let k = 1; k < spans; k++) piers.push(-halfSpan + (2 * halfSpan * k) / spans);

  const score = -(bend / DEG + 0.4 * halfSpan + 2 * Math.abs(padPlus - padMinus) + 0.3 * (rampPlus.length + rampMinus.length - 2 * RAMP_LENGTH));
  return {
    riverId: river.id,
    s: centre.s,
    x,
    z,
    yaw,
    halfSpan,
    halfLength,
    endY,
    arch: Math.min(MAX_ARCH, ARCH_PER_METRE * 2 * halfSpan),
    footY,
    surfaceY: centre.surfaceY,
    piers,
    ramps: [rampPlus, rampMinus],
    score,
  };
}

/** Grades the approaches of a planned crossing into the terrain and returns the finished bridge. */
export function buildBridge(
  terrain: Terrain, level: Float32Array, crossing: Crossing, id: number,
  shore: DistanceField = shoreField(terrain, level),
): Bridge {
  gradeApproaches(terrain, level, crossing, shore);
  return {
    id,
    riverId: crossing.riverId,
    x: crossing.x,
    z: crossing.z,
    yaw: crossing.yaw,
    halfLength: crossing.halfLength,
    halfSpan: crossing.halfSpan,
    halfWidth: BRIDGE.deckHalfWidth,
    endY: crossing.endY,
    arch: crossing.arch,
    rampLength: Math.max(crossing.ramps[0].length, crossing.ramps[1].length),
    piers: crossing.piers,
    footY: crossing.footY,
  };
}

/** Distance from (x, z) along (dx, dz) to the first dry ground at bank-top height, or null. */
function bankDistance(terrain: Terrain, level: Float32Array, x: number, z: number, dx: number, dz: number, surface: number): number | null {
  const top = surface + BANK_FREEBOARD - BANK_TOLERANCE;
  for (let d = SEARCH_STEP; d <= BANK_SEARCH; d += SEARCH_STEP) {
    const px = x + dx * d;
    const pz = z + dz * d;
    if (waterDepthAt(terrain, level, px, pz) <= 0 && terrain.heightAt(px, pz) >= top) return d;
  }
  return null;
}

/** Ramp beyond one deck end: long enough to stay within the grade limit, or null when that is too long. */
function planRamp(groundAt: (along: number, lateral: number) => number, side: number, halfLength: number, endY: number): RampEnd | null {
  let length = RAMP_LENGTH;
  for (let pass = 0; pass < 2; pass++) {
    length = Math.max(RAMP_LENGTH, Math.abs(endY - groundAt(side * (halfLength + length), 0)) / BRIDGE.maxRampGrade);
  }
  const height = groundAt(side * (halfLength + length), 0);
  if (length > MAX_RAMP_LENGTH || Math.abs(endY - height) / length > BRIDGE.maxRampGrade * 1.05) return null;
  return { length, height };
}

/**
 * Levels the ground where the deck rests on each bank to the road height and
 * builds straight ramps down to the natural ground, with embankment sides
 * blending into the land beside them. Water and the ground under the span are
 * left alone.
 */
function gradeApproaches(terrain: Terrain, level: Float32Array, c: Crossing, shore: DistanceField): void {
  const heights = terrain.heights;
  const res = terrain.resolution;
  const core = BRIDGE.deckHalfWidth + SHOULDER;
  const reachAlong = c.halfLength + Math.max(c.ramps[0].length, c.ramps[1].length);
  const reachLateral = core + MAX_SIDE_REACH;
  const radius = Math.hypot(reachAlong, reachLateral);
  const last = res - 1;
  const i0 = Math.max(0, Math.floor((c.x - radius + terrain.halfSize) / terrain.cellSize));
  const i1 = Math.min(last, Math.ceil((c.x + radius + terrain.halfSize) / terrain.cellSize));
  const j0 = Math.max(0, Math.floor((c.z - radius + terrain.halfSize) / terrain.cellSize));
  const j1 = Math.min(last, Math.ceil((c.z + radius + terrain.halfSize) / terrain.cellSize));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const dx = terrain.vertexX(i) - c.x;
      const dz = terrain.vertexZ(j) - c.z;
      const along = toLocalZ(dx, dz, c.yaw);
      const lateral = Math.abs(toLocalX(dx, dz, c.yaw));
      const a = Math.abs(along);
      if (lateral > reachLateral) continue;
      const v = j * res + i;
      const orig = heights[v]!;
      if (level[v]! > orig) continue;
      const ramp = along >= 0 ? c.ramps[0] : c.ramps[1];
      let top = c.endY;
      let fade = 0;
      if (a < c.halfSpan) {
        // The abutment: the pad's face falls towards the river like an embankment side.
        top = c.endY - SIDE_SLOPE * (c.halfSpan - a);
        if (top <= orig) continue;
      } else if (a > c.halfLength) {
        const t = (a - c.halfLength) / ramp.length;
        if (t >= 1) continue;
        top = lerp(c.endY, ramp.height, t);
        fade = smoothstep(RAMP_FADE_START, 1, t);
      }
      let h = top;
      if (lateral > core) {
        const blend = Math.max(MIN_SIDE_BLEND, Math.abs(top - orig) / SIDE_SLOPE);
        if (lateral >= core + blend) continue;
        h = lerp(top, orig, (lateral - core) / blend);
      }
      // Under the span the abutment only ever fills; the bank below it is never cut away.
      if (a < c.halfSpan) h = Math.max(h, orig);
      // Nothing is raised higher than a bank may stand at this distance from the water.
      if (h > orig) h = Math.min(h, Math.max(orig, shoreCap(shore.sample(terrain.vertexX(i), terrain.vertexZ(j)), c.surfaceY)));
      heights[v] = lerp(h, orig, fade);
    }
  }
}

/** Distance from every terrain vertex to the nearest wet vertex, as a field sampled at the vertices (metres). */
function shoreField(terrain: Terrain, level: Float32Array): DistanceField {
  const res = terrain.resolution;
  const mask = new Uint8Array(res * res);
  for (let v = 0; v < mask.length; v++) mask[v] = level[v]! > terrain.heights[v]! ? 1 : 0;
  const corner = -terrain.halfSize - terrain.cellSize / 2;
  return DistanceField.fromMask(mask, res, res, corner, corner, terrain.cellSize);
}

/**
 * Highest ground may stand `e` metres from water whose surface is at
 * `surface`: a bank rising to the freeboard, then an embankment slope.
 */
function shoreCap(e: number, surface: number): number {
  if (e <= 0) return surface;
  if (e <= BANK_WIDTH) return surface + BANK_FREEBOARD * smoothstep(0, BANK_WIDTH, e);
  return surface + BANK_FREEBOARD + SIDE_SLOPE * (e - BANK_WIDTH);
}
