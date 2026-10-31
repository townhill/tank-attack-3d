/**
 * A generated battlefield as plain data that can cross between a Web Worker
 * and the page: structured cloning keeps plain objects and typed arrays but
 * not classes, so the terrain, water map and distance field travel as their
 * arrays and are rebuilt around them on arrival. Nothing is regenerated.
 */
import type { Bridge } from './Bridge';
import { DistanceField } from './distanceField';
import type { Obstacle } from './Obstacle';
import { Terrain } from './Terrain';
import type { Ford, Lake, River } from './Water';
import { WaterMap } from './Water';
import { World } from './World';

export interface PackedField {
  readonly minX: number;
  readonly minZ: number;
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly values: Float32Array;
}

export interface PackedWorld {
  readonly seed: number;
  readonly playableHalfSize: number;
  readonly terrainHalfSize: number;
  readonly cellSize: number;
  readonly heights: Float32Array;
  /** Water level per terrain vertex (NaN where dry). */
  readonly level: Float32Array;
  /** Signed distance to water a tank cannot enter. */
  readonly blocked: PackedField;
  readonly rivers: readonly River[];
  readonly lakes: readonly Lake[];
  readonly bridges: readonly Bridge[];
  readonly fords: readonly Ford[];
  readonly obstacles: readonly Obstacle[];
}

/** The data of `world`, sharing its arrays rather than copying them. */
export function packWorld(world: World): PackedWorld {
  const terrain = world.terrain;
  const field = world.water.blocked;
  return {
    seed: world.seed,
    playableHalfSize: world.playableHalfSize,
    terrainHalfSize: terrain.halfSize,
    cellSize: terrain.cellSize,
    heights: terrain.heights,
    level: world.water.level,
    blocked: { minX: field.minX, minZ: field.minZ, cellSize: field.cellSize, cols: field.cols, rows: field.rows, values: field.values },
    rivers: world.rivers,
    lakes: world.lakes,
    bridges: world.bridges,
    fords: world.fords,
    obstacles: world.obstacles,
  };
}

/**
 * The large arrays of a packed world, each once, to transfer with
 * postMessage instead of copying. They become unusable on the sending side.
 */
export function transferablesOf(packed: PackedWorld): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  for (const array of [packed.heights, packed.level, packed.blocked.values]) {
    if (array.buffer instanceof ArrayBuffer) buffers.add(array.buffer);
  }
  return [...buffers];
}

/** Rebuilds the battlefield from its packed data. */
export function unpackWorld(packed: PackedWorld): World {
  const terrain = new Terrain(packed.terrainHalfSize, packed.cellSize, packed.heights);
  const f = packed.blocked;
  const water = new WaterMap(terrain, packed.level, new DistanceField(f.minX, f.minZ, f.cellSize, f.cols, f.rows, f.values));
  return new World(packed.seed, terrain, packed.obstacles, packed.playableHalfSize, {
    water,
    rivers: packed.rivers,
    lakes: packed.lakes,
    bridges: packed.bridges,
    fords: packed.fords,
  });
}
