/**
 * Seeded procedural battlefield generation. The same seed always produces the
 * same heightfield and obstacle layout.
 */
import { WORLD } from '../config/settings';
import { lerp, smoothstep, TAU } from '../utils/math';
import { SimplexNoise2D } from '../utils/noise';
import { Random } from '../utils/random';
import type { Obstacle, ObstacleKind, ObstacleShape } from './Obstacle';
import { boundRadiusOf, STOREY_HEIGHT, toWorldX, toWorldZ } from './Obstacle';
import { Terrain } from './Terrain';
import { World } from './World';

export interface WorldGenOptions {
  readonly terrainHalfSize: number;
  readonly cellSize: number;
  readonly playableHalfSize: number;
  readonly rockCount: number;
  readonly structureCount: number;
  readonly spawnClearRadius: number;
}

export const DEFAULT_WORLD_OPTIONS: WorldGenOptions = {
  terrainHalfSize: WORLD.terrainHalfSize,
  cellSize: WORLD.cellSize,
  playableHalfSize: WORLD.playableHalfSize,
  rockCount: WORLD.rockCount,
  structureCount: WORLD.structureCount,
  spawnClearRadius: WORLD.spawnClearRadius,
};

/** Maximum gradient tolerated under an obstacle's footprint. */
const MAX_OBSTACLE_SLOPE = 0.32;
/** Stricter limit for buildings, so a hillside never swallows the ground floor. */
export const MAX_BUILDING_SLOPE = 0.18;

export function generateHeights(seed: number, opts: WorldGenOptions): Terrain {
  const terrain = new Terrain(opts.terrainHalfSize, opts.cellSize);
  const hills = new SimplexNoise2D(seed);
  const detail = new SimplexNoise2D(seed ^ 0x9e3779b9);
  const res = terrain.resolution;
  for (let j = 0; j < res; j++) {
    const z = terrain.vertexZ(j);
    for (let i = 0; i < res; i++) {
      const x = terrain.vertexX(i);
      let h = hills.fbm(x / 380, z / 380, 4) * 16;
      h += hills.fbm(x / 110 + 17.3, z / 110 - 9.1, 3) * 4;
      // Low-frequency mask carves out flatter combat basins.
      const hilliness = smoothstep(-0.35, 0.4, detail.noise(x / 430, z / 430));
      h *= lerp(0.22, 1, hilliness);
      // Keep the player's spawn point level.
      const centreDist = Math.hypot(x, z);
      h *= 0.12 + 0.88 * smoothstep(30, 140, centreDist);
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

function pickStructure(rng: Random): StructureTemplate {
  const total = STRUCTURES.reduce((sum, s) => sum + s.weight, 0);
  let roll = rng.next() * total;
  for (const s of STRUCTURES) {
    roll -= s.weight;
    if (roll <= 0) return s;
  }
  return STRUCTURES[0]!;
}

function generateObstacles(seed: number, terrain: Terrain, opts: WorldGenOptions): Obstacle[] {
  const rng = new Random(seed ^ 0x5bd1e995);
  const obstacles: Obstacle[] = [];
  const placed: Placement[] = [];
  const limit = opts.playableHalfSize - 25;

  const isFree = (x: number, z: number, radius: number, gap: number): boolean => {
    if (Math.hypot(x, z) < opts.spawnClearRadius + radius) return false;
    for (const p of placed) {
      if (Math.hypot(p.x - x, p.z - z) < p.radius + radius + gap) return false;
    }
    return true;
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

  // Structures first so they get the best (flattest) spots.
  for (let attempt = 0, made = 0; made < opts.structureCount && attempt < opts.structureCount * 40; attempt++) {
    const template = pickStructure(rng);
    const { shape, height } = template.make(rng);
    const x = rng.range(-limit, limit);
    const z = rng.range(-limit, limit);
    const yaw = template.kind === 'pyramid' || template.kind === 'block' ? rng.range(0, Math.PI / 2) : rng.range(0, TAU);
    const radius = boundRadiusOf(shape);
    if (!isFree(x, z, radius, 18) || !footprintIsUsable(terrain, x, z, radius, template.maxSlope)) continue;
    add(template.kind, x, z, yaw, shape, height);
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

export function generateWorld(seed: number, opts: WorldGenOptions = DEFAULT_WORLD_OPTIONS): World {
  const terrain = generateHeights(seed, opts);
  const obstacles = generateObstacles(seed, terrain, opts);
  return new World(seed, terrain, obstacles, opts.playableHalfSize);
}
