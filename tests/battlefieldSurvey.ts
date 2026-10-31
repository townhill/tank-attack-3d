/**
 * Seeded survey of a battlefield's cover and ground, for comparing terrain
 * types: how much of the battlefield is hidden at fighting range, how far a
 * tank must drive to break line of sight, and how much ground is too steep
 * for enemies to drive or spawn on.
 */
import type { Obstacle } from '../src/world/Obstacle';
import type { World } from '../src/world/World';
import { TAU } from '../src/utils/math';
import { Random } from '../src/utils/random';

/** Sight heights of the tactical map's visibility check (src/ui/tacticalData.ts). */
const EYE_HEIGHT = 3.2;
const TARGET_HEIGHT = 2;
/** Fighting ranges: enemies prefer 90–150 m and hear gunfire out to 320 m. */
const MIN_RANGE = 60;
const NEAR_FAR_SPLIT = 150;
const MAX_RANGE = 320;
/** Enemies steer around ground steeper than this (src/ai/Navigation.ts). */
const ENEMY_SAFE_SLOPE = 0.42;
/** Enemies only spawn on ground at most this steep (src/game/Simulation.ts). */
const SPAWN_MAX_SLOPE = 0.3;
/** Observers keep this far inside the playable edge, as enemy spawns do. */
const EDGE_MARGIN = 30;
/** How far away the threat stands when an observer looks for cover: mid-way through enemies' preferred 90–150 m. */
const THREAT_RANGE = 120;
const COVER_STEP = 10;
const COVER_SEARCH_RADIUS = 120;
const COVER_DIRECTIONS = 8;
/** Short-drive radius for the "cover within reach" share. */
const NEAR_COVER = 60;
/** Reported as the distance to cover when none lies within the search radius. */
export const NO_COVER_DISTANCE = COVER_SEARCH_RADIUS + COVER_STEP;
/** Grid points per side sampled for relief and slope shares. */
const GROUND_GRID = 60;
/** Clearance observers and targets keep from obstacles (metres). */
const OBSTACLE_CLEARANCE = 3;
const PLACEMENT_TRIES = 40;

export interface SurveyOptions {
  readonly observers: number;
  readonly targetsPerObserver: number;
}

export const DEFAULT_SURVEY: SurveyOptions = { observers: 160, targetsPerObserver: 12 };

export interface BattlefieldSurvey {
  /** Height span between the 5th and 95th percentile of dry playable ground (metres). */
  readonly relief: number;
  /** Share of observer–target pairs 60–320 m apart with no line of sight between them. */
  readonly hiddenShare: number;
  /** The same share for pairs 60–150 m apart. */
  readonly hiddenNear: number;
  /** The same share for pairs 150–320 m apart. */
  readonly hiddenFar: number;
  /** Median distance an observer must move to hide from a threat 120 m away (metres). */
  readonly coverDistanceMedian: number;
  /** Share of observers with cover from that threat within 60 m. */
  readonly coverWithin60: number;
  /** Share of dry playable ground enemies steer around for being too steep. */
  readonly steepShare: number;
  /** Share of dry playable ground flat enough for enemies to spawn on. */
  readonly spawnableShare: number;
  readonly structures: number;
  readonly rocks: number;
}

interface Point {
  readonly x: number;
  readonly z: number;
}

/** Dry ground inside the playable square, clear of obstacles. */
function isOpenGround(world: World, x: number, z: number, margin: number, scratch: Obstacle[]): boolean {
  if (!world.isInsidePlayable(x, z, margin) || world.water.depthAt(x, z) > 0) return false;
  for (const o of world.obstaclesNear(x, z, OBSTACLE_CLEARANCE, scratch)) {
    if (Math.hypot(o.x - x, o.z - z) < o.boundRadius + OBSTACLE_CLEARANCE) return false;
  }
  return true;
}

function isHidden(world: World, from: Point, to: Point): boolean {
  const eye = world.heightAt(from.x, from.z) + EYE_HEIGHT;
  const target = world.heightAt(to.x, to.z) + TARGET_HEIGHT;
  return !world.hasLineOfSight(from.x, eye, from.z, to.x, target, to.z);
}

function placeObserver(world: World, rng: Random, scratch: Obstacle[]): Point | null {
  const limit = world.playableHalfSize - EDGE_MARGIN;
  for (let t = 0; t < PLACEMENT_TRIES; t++) {
    const x = rng.range(-limit, limit);
    const z = rng.range(-limit, limit);
    if (isOpenGround(world, x, z, EDGE_MARGIN, scratch)) return { x, z };
  }
  return null;
}

/** Open ground at a random bearing from `from`, between `minRange` and `maxRange` away. */
function placeAround(world: World, rng: Random, from: Point, minRange: number, maxRange: number, scratch: Obstacle[]): Point | null {
  for (let t = 0; t < PLACEMENT_TRIES; t++) {
    const angle = rng.range(0, TAU);
    const range = rng.range(minRange, maxRange);
    const x = from.x + Math.sin(angle) * range;
    const z = from.z - Math.cos(angle) * range;
    if (isOpenGround(world, x, z, 0, scratch)) return { x, z };
  }
  return null;
}

/** Distance `observer` must move to hide from a threat 120 m away; null when no threat could be placed. */
function coverDistance(world: World, rng: Random, observer: Point, scratch: Obstacle[]): number | null {
  const threat = placeAround(world, rng, observer, THREAT_RANGE, THREAT_RANGE, scratch);
  if (!threat) return null;
  if (isHidden(world, threat, observer)) return 0;
  for (let r = COVER_STEP; r <= COVER_SEARCH_RADIUS; r += COVER_STEP) {
    for (let k = 0; k < COVER_DIRECTIONS; k++) {
      const angle = (k / COVER_DIRECTIONS) * TAU;
      const spot = { x: observer.x + Math.cos(angle) * r, z: observer.z + Math.sin(angle) * r };
      if (isOpenGround(world, spot.x, spot.z, 0, scratch) && isHidden(world, threat, spot)) return r;
    }
  }
  return NO_COVER_DISTANCE;
}

function percentile(sorted: readonly number[], p: number): number {
  return sorted.length === 0 ? 0 : sorted[Math.round(p * (sorted.length - 1))]!;
}

function shareOf(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

interface GroundStats {
  readonly relief: number;
  readonly steepShare: number;
  readonly spawnableShare: number;
}

/** Relief and slope shares over a regular grid of dry playable ground. */
function surveyGround(world: World): GroundStats {
  const half = world.playableHalfSize;
  const heights: number[] = [];
  let steep = 0;
  let spawnable = 0;
  for (let j = 0; j <= GROUND_GRID; j++) {
    const z = -half + (2 * half * j) / GROUND_GRID;
    for (let i = 0; i <= GROUND_GRID; i++) {
      const x = -half + (2 * half * i) / GROUND_GRID;
      if (world.water.depthAt(x, z) > 0) continue;
      heights.push(world.terrain.heightAt(x, z));
      const slope = world.terrain.slopeAt(x, z, 3);
      if (slope > ENEMY_SAFE_SLOPE) steep++;
      if (slope <= SPAWN_MAX_SLOPE) spawnable++;
    }
  }
  heights.sort((a, b) => a - b);
  return {
    relief: percentile(heights, 0.95) - percentile(heights, 0.05),
    steepShare: shareOf(steep, heights.length),
    spawnableShare: shareOf(spawnable, heights.length),
  };
}

/** Surveys `world` from seeded observer positions; the same seed always gives the same survey. */
export function surveyBattlefield(world: World, seed: number, options: SurveyOptions = DEFAULT_SURVEY): BattlefieldSurvey {
  const rng = new Random(seed);
  const scratch: Obstacle[] = [];
  const pairs = { near: 0, far: 0, hiddenNear: 0, hiddenFar: 0 };
  const distances: number[] = [];
  for (let o = 0; o < options.observers; o++) {
    const observer = placeObserver(world, rng, scratch);
    if (!observer) continue;
    for (let t = 0; t < options.targetsPerObserver; t++) {
      const target = placeAround(world, rng, observer, MIN_RANGE, MAX_RANGE, scratch);
      if (!target) continue;
      const hidden = isHidden(world, observer, target) ? 1 : 0;
      if (Math.hypot(target.x - observer.x, target.z - observer.z) < NEAR_FAR_SPLIT) {
        pairs.near++;
        pairs.hiddenNear += hidden;
      } else {
        pairs.far++;
        pairs.hiddenFar += hidden;
      }
    }
    const distance = coverDistance(world, rng, observer, scratch);
    if (distance !== null) distances.push(distance);
  }
  distances.sort((a, b) => a - b);
  const rocks = world.obstacles.filter((o) => o.kind === 'rock').length;
  return {
    ...surveyGround(world),
    hiddenShare: shareOf(pairs.hiddenNear + pairs.hiddenFar, pairs.near + pairs.far),
    hiddenNear: shareOf(pairs.hiddenNear, pairs.near),
    hiddenFar: shareOf(pairs.hiddenFar, pairs.far),
    coverDistanceMedian: distances.length === 0 ? NO_COVER_DISTANCE : distances[Math.floor(distances.length / 2)]!,
    coverWithin60: shareOf(distances.filter((d) => d <= NEAR_COVER).length, distances.length),
    structures: world.obstacles.length - rocks,
    rocks,
  };
}
