/**
 * Seeded procedural battlefield generation. The same seed always produces the
 * same heightfield and obstacle layout.
 */
import type { MapSize, TerrainProfile, TerrainType } from '../config/settings';
import { MAP_SIZES, TERRAIN_TYPES, WORLD } from '../config/settings';
import { lerp, smoothstep, TAU } from '../utils/math';
import { SimplexNoise2D } from '../utils/noise';
import { Random } from '../utils/random';
import { createBridgeLocal, toBridgeLocal } from './Bridge';
import { placeBridges } from './BridgePlacer';
import { placeFords } from './FordPlacer';
import { FORD_LINK_OFFSET, NavGrid } from './NavGrid';
import type { Obstacle, ObstacleKind, ObstacleShape } from './Obstacle';
import { boundRadiusOf, STOREY_HEIGHT, toWorldX, toWorldZ } from './Obstacle';
import { Terrain } from './Terrain';
import { createWaterMap } from './Water';
import { carveWater, planLakes, planRivers } from './WaterGenerator';
import type { WorldFeatures } from './World';
import { dryFeatures, World } from './World';

export interface WorldGenOptions {
  readonly terrainHalfSize: number;
  readonly cellSize: number;
  readonly playableHalfSize: number;
  readonly rockCount: number;
  readonly structureCount: number;
  readonly spawnClearRadius: number;
  /** Rivers, lakes and ponds to generate; all zero for dry land. */
  readonly rivers: number;
  readonly lakes: number;
  readonly ponds: number;
  /** Whether each river gets a shallow ford; off keeps a seed's layout as it was before fords. */
  readonly fords: boolean;
  /** Shape of the ground inside the boundary mountains; Gentle keeps a seed's layout as it was before terrain types. */
  readonly terrainProfile: TerrainProfile;
}

/**
 * Generation options for a map size and terrain type: the playable square
 * scales by side length, the boundary mountain margin keeps its width, rivers
 * scale with the side and obstacles, lakes and ponds with the area so density
 * stays the same.
 */
export function worldOptionsFor(size: MapSize, fords = false, terrain: TerrainType = 'gentle'): WorldGenOptions {
  const scale = MAP_SIZES[size].scale;
  const playableHalfSize = WORLD.playableHalfSize * scale;
  const area = scale * scale;
  return {
    terrainHalfSize: playableHalfSize + (WORLD.terrainHalfSize - WORLD.playableHalfSize),
    cellSize: WORLD.cellSize,
    playableHalfSize,
    rockCount: WORLD.rockCount * area,
    structureCount: WORLD.structureCount * area,
    spawnClearRadius: WORLD.spawnClearRadius,
    rivers: WORLD.riverCount * scale,
    lakes: WORLD.lakeCount * area,
    ponds: WORLD.pondCount * area,
    fords,
    terrainProfile: TERRAIN_TYPES[terrain].profile,
  };
}

export const DEFAULT_WORLD_OPTIONS: WorldGenOptions = worldOptionsFor('standard');

/** Maximum gradient tolerated under an obstacle's footprint. */
const MAX_OBSTACLE_SLOPE = 0.32;
/** Obstacles keep this far from water tanks cannot enter, beyond their own radius (metres). */
const OBSTACLE_WATER_CLEARANCE = 6;
/** Obstacles keep this far from a bridge road and its ramps, beyond their own radius (metres). */
const OBSTACLE_BRIDGE_CLEARANCE = 10;
/** Attempts with rivers before trying lakes alone, then dry land. */
const RIVER_LAYOUT_ATTEMPTS = 3;
/** Share of the walkable ground that must be reachable from the player's spawn. */
const MIN_REACHABLE_SHARE = 0.97;
/** How far beyond the playable square the blocked-water field reaches (metres). */
const WATER_FIELD_MARGIN = 40;
/** Stricter limit for buildings, so a hillside never swallows the ground floor. */
export const MAX_BUILDING_SLOPE = 0.18;
/** Features of the combat-basin mask are roughly this many metres across. */
const BASIN_SCALE = 430;
/** Offsets the detail layer so it never lines up with the hills it shares noise with. */
const DETAIL_OFFSET_X = 17.3;
const DETAIL_OFFSET_Z = -9.1;
/** Seed salt for the ridgeline noise, which Gentle never samples. */
const RIDGE_SALT = 0x85ebca6b;

/** 1 on a zero line of `n`, easing to 0 at `width` either side. */
function band(n: number, width: number): number {
  return 1 - smoothstep(0, width, Math.abs(n));
}

export function generateHeights(seed: number, opts: WorldGenOptions): Terrain {
  const terrain = new Terrain(opts.terrainHalfSize, opts.cellSize);
  const { hills: hillLayer, detail: detailLayer, ridges: ridgeLayer, basinFloor, spawnFloor } = opts.terrainProfile;
  const hills = new SimplexNoise2D(seed);
  const detail = new SimplexNoise2D(seed ^ 0x9e3779b9);
  const ridges = new SimplexNoise2D(seed ^ RIDGE_SALT);
  const res = terrain.resolution;
  for (let j = 0; j < res; j++) {
    const z = terrain.vertexZ(j);
    for (let i = 0; i < res; i++) {
      const x = terrain.vertexX(i);
      let h = hills.fbm(x / hillLayer.scale, z / hillLayer.scale, hillLayer.octaves) * hillLayer.amplitude;
      h += hills.fbm(x / detailLayer.scale + DETAIL_OFFSET_X, z / detailLayer.scale + DETAIL_OFFSET_Z, detailLayer.octaves) * detailLayer.amplitude;
      // Skipped outright when absent, so Gentle's arithmetic is untouched.
      if (ridgeLayer.height > 0) {
        h += ridgeLayer.height * band(ridges.noise(x / ridgeLayer.scale, z / ridgeLayer.scale), ridgeLayer.width);
      }
      // Low-frequency mask carves out flatter combat basins.
      const hilliness = smoothstep(-0.35, 0.4, detail.noise(x / BASIN_SCALE, z / BASIN_SCALE));
      h *= lerp(basinFloor, 1, hilliness);
      // Keep the player's spawn point level.
      const centreDist = Math.hypot(x, z);
      h *= spawnFloor + (1 - spawnFloor) * smoothstep(30, 140, centreDist);
      // Boundary mountain range rising beyond the playable square.
      const edge = Math.max(Math.abs(x), Math.abs(z)) - opts.playableHalfSize;
      const rise = smoothstep(-30, 170, edge);
      if (rise > 0) {
        const ridge = detail.ridged(x / 140, z / 140, 4);
        h += Math.pow(rise, 1.6) * (55 + 95 * ridge);
      }
      terrain.heights[terrain.index(i, j)] = h;
    }
  }
  return terrain;
}

interface Placement {
  x: number;
  z: number;
  radius: number;
}

function footprintIsUsable(terrain: Terrain, x: number, z: number, radius: number, maxSlope = MAX_OBSTACLE_SLOPE): boolean {
  for (let a = 0; a < 6; a++) {
    const angle = (a / 6) * TAU;
    if (terrain.slopeAt(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius) > maxSlope) return false;
  }
  return terrain.slopeAt(x, z) <= maxSlope;
}

/** Lowest terrain height under the footprint, so obstacles never float. */
function footprintBase(terrain: Terrain, x: number, z: number, shape: ObstacleShape, yaw: number): number {
  let min = terrain.heightAt(x, z);
  if (shape.type === 'circle') {
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * TAU;
      min = Math.min(min, terrain.heightAt(x + Math.cos(angle) * shape.radius, z + Math.sin(angle) * shape.radius));
    }
  } else {
    for (const sx of [-1, 0, 1]) {
      for (const sz of [-1, 0, 1]) {
        const lx = sx * shape.halfX;
        const lz = sz * shape.halfZ;
        min = Math.min(min, terrain.heightAt(x + toWorldX(lx, lz, yaw), z + toWorldZ(lx, lz, yaw)));
      }
    }
  }
  return min - 0.4;
}

interface StructureTemplate {
  readonly kind: ObstacleKind;
  readonly weight: number;
  /** Steepest ground tolerated under the footprint; defaults to MAX_OBSTACLE_SLOPE. */
  readonly maxSlope?: number;
  make(rng: Random): { shape: ObstacleShape; height: number };
}

const STRUCTURES: readonly StructureTemplate[] = [
  { kind: 'pyramid', weight: 3, make: (rng) => { const s = rng.range(6, 10); return { shape: { type: 'box', halfX: s, halfZ: s }, height: s * rng.range(1.1, 1.5) }; } },
  { kind: 'block', weight: 3, make: (rng) => { const s = rng.range(3.5, 6); return { shape: { type: 'box', halfX: s, halfZ: s }, height: s * 2 }; } },
  { kind: 'bunker', weight: 2, make: (rng) => ({ shape: { type: 'box', halfX: rng.range(7, 10), halfZ: rng.range(5, 7) }, height: rng.range(4, 5.5) }) },
  { kind: 'tower', weight: 2, make: (rng) => ({ shape: { type: 'circle', radius: rng.range(2.6, 3.4) }, height: rng.range(22, 32) }) },
  { kind: 'wall', weight: 2, make: (rng) => ({ shape: { type: 'box', halfX: rng.range(14, 22), halfZ: 1.4 }, height: rng.range(4.5, 6) }) },
  { kind: 'pylon', weight: 2, make: (rng) => ({ shape: { type: 'circle', radius: 1.6 }, height: rng.range(12, 16) }) },
  { kind: 'building', weight: 4, maxSlope: MAX_BUILDING_SLOPE, make: (rng) => ({ shape: { type: 'box', halfX: rng.range(6, 10), halfZ: rng.range(5, 8) }, height: rng.int(2, 4) * STOREY_HEIGHT }) },
];

const BUILDING_TEMPLATE = STRUCTURES.find((s) => s.kind === 'building')!;

function pickStructure(rng: Random): StructureTemplate {
  const total = STRUCTURES.reduce((sum, s) => sum + s.weight, 0);
  let roll = rng.next() * total;
  for (const s of STRUCTURES) {
    roll -= s.weight;
    if (roll <= 0) return s;
  }
  return STRUCTURES[0]!;
}

/** True when an obstacle footprint of `radius` at (x, z) keeps clear of water, banks, bridge approaches and fords. */
function isClearOfWater(features: WorldFeatures, x: number, z: number, radius: number): boolean {
  const water = features.water;
  if (water.blockedDistance(x, z) < radius + OBSTACLE_WATER_CLEARANCE || water.depthAt(x, z) > 0) return false;
  for (let a = 0; a < 6; a++) {
    const angle = (a / 6) * TAU;
    if (water.depthAt(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius) > 0) return false;
  }
  const local = createBridgeLocal();
  for (const b of features.bridges) {
    toBridgeLocal(b, x, z, local);
    const reach = radius + OBSTACLE_BRIDGE_CLEARANCE;
    if (Math.abs(local.lateral) < b.halfWidth + reach && Math.abs(local.along) < b.halfLength + b.rampLength + reach) return false;
  }
  // A ford's way across runs square to the flow, out to where it joins the ground on each bank.
  for (const f of features.fords ?? []) {
    const dx = x - f.x;
    const dz = z - f.z;
    const reach = radius + OBSTACLE_BRIDGE_CLEARANCE;
    if (Math.abs(dx * f.tx + dz * f.tz) < f.halfLength + reach && Math.abs(dz * f.tx - dx * f.tz) < f.halfWidth + FORD_LINK_OFFSET + reach) return false;
  }
  return true;
}

function generateObstacles(seed: number, terrain: Terrain, opts: WorldGenOptions, features: WorldFeatures): Obstacle[] {
  const rng = new Random(seed ^ 0x5bd1e995);
  const obstacles: Obstacle[] = [];
  const placed: Placement[] = [];
  const limit = opts.playableHalfSize - 25;

  const isFree = (x: number, z: number, radius: number, gap: number): boolean => {
    if (Math.hypot(x, z) < opts.spawnClearRadius + radius) return false;
    for (const p of placed) {
      if (Math.hypot(p.x - x, p.z - z) < p.radius + radius + gap) return false;
    }
    return isClearOfWater(features, x, z, radius);
  };

  const add = (kind: ObstacleKind, x: number, z: number, yaw: number, shape: ObstacleShape, height: number): void => {
    const boundRadius = boundRadiusOf(shape);
    obstacles.push({
      id: obstacles.length,
      kind,
      x,
      z,
      yaw,
      shape,
      baseY: footprintBase(terrain, x, z, shape, yaw),
      height,
      boundRadius,
      seed: rng.int(0, 0x7fffffff),
    });
    placed.push({ x, z, radius: boundRadius });
  };

  // Structures first so they get the best (flattest) spots. Water takes some
  // of the flattest ground, so the last structure is kept for a building
  // whenever none has been placed yet.
  let hasBuilding = false;
  for (let attempt = 0, made = 0; made < opts.structureCount && attempt < opts.structureCount * 40; attempt++) {
    // Always draw the pick, so the random sequence is unchanged when no building is forced.
    const picked = pickStructure(rng);
    const template: StructureTemplate = !hasBuilding && made === opts.structureCount - 1 ? BUILDING_TEMPLATE : picked;
    const { shape, height } = template.make(rng);
    const x = rng.range(-limit, limit);
    const z = rng.range(-limit, limit);
    const yaw = template.kind === 'pyramid' || template.kind === 'block' ? rng.range(0, Math.PI / 2) : rng.range(0, TAU);
    const radius = boundRadiusOf(shape);
    if (!isFree(x, z, radius, 18) || !footprintIsUsable(terrain, x, z, radius, template.maxSlope)) continue;
    add(template.kind, x, z, yaw, shape, height);
    hasBuilding ||= template.kind === 'building';
    made++;
  }

  // Rocks are scattered in loose clusters.
  let rocks = 0;
  for (let attempt = 0; rocks < opts.rockCount && attempt < opts.rockCount * 30; attempt++) {
    const cx = rng.range(-limit, limit);
    const cz = rng.range(-limit, limit);
    const clusterSize = rng.int(1, 4);
    for (let k = 0; k < clusterSize && rocks < opts.rockCount; k++) {
      const radius = rng.range(1.8, 5.5);
      const x = cx + rng.signed() * 16;
      const z = cz + rng.signed() * 16;
      if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
      if (!isFree(x, z, radius, 9) || !footprintIsUsable(terrain, x, z, radius)) continue;
      add('rock', x, z, rng.range(0, TAU), { type: 'circle', radius }, radius * rng.range(0.7, 1.3));
      rocks++;
    }
  }
  return obstacles;
}

/**
 * Carves rivers, lakes and ponds into the terrain, bridges every river and,
 * when asked, fords each one.
 * A layout that strands more than a sliver of the battlefield out of reach
 * of the player's spawn is undone and replanned: first with other rivers,
 * then with lakes alone, and finally with no water at all.
 */
export function generateWaterFeatures(seed: number, terrain: Terrain, opts: WorldGenOptions): WorldFeatures {
  const half = opts.playableHalfSize;
  const original = terrain.heights.slice();
  for (let attempt = 0; attempt <= RIVER_LAYOUT_ATTEMPTS; attempt++) {
    const layoutSeed = (seed + attempt * 0x3c6ef372) >>> 0;
    const rivers = planRivers(layoutSeed, terrain, half, attempt < RIVER_LAYOUT_ATTEMPTS ? opts.rivers : 0);
    const lakes = planLakes(layoutSeed, terrain, half, rivers, opts.lakes, opts.ponds);
    if (rivers.length + lakes.length === 0) break;
    const level = carveWater(terrain, rivers, lakes, half, opts.terrainProfile.riverValley);
    const bridges = placeBridges(terrain, level, rivers, half);
    const fords = opts.fords ? placeFords(terrain, rivers, bridges, half) : [];
    const water = createWaterMap(terrain, level, bridges, half + WATER_FIELD_MARGIN);
    const nav = new NavGrid(half, water, bridges, null, undefined, fords);
    if (nav.regionShare(nav.regionAt(0, 0)) >= MIN_REACHABLE_SHARE) return { water, rivers, lakes, bridges, fords };
    terrain.heights.set(original);
  }
  return dryFeatures(terrain);
}

export function generateWorld(seed: number, opts: WorldGenOptions = DEFAULT_WORLD_OPTIONS): World {
  const terrain = generateHeights(seed, opts);
  const features = generateWaterFeatures(seed, terrain, opts);
  const obstacles = generateObstacles(seed, terrain, opts, features);
  return new World(seed, terrain, obstacles, opts.playableHalfSize, features);
}
