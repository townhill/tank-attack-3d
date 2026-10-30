/** Hand-built water and bridge fixtures shared by the water, bridge, navigation and simulation suites. */
import { buildBridge, planCrossing } from '../src/world/BridgePlacer';
import type { Bridge } from '../src/world/Bridge';
import { Terrain } from '../src/world/Terrain';
import type { River, RiverSample } from '../src/world/Water';
import { createWaterMap } from '../src/world/Water';
import { carveWater } from '../src/world/WaterGenerator';
import { World } from '../src/world/World';

export interface StraightRiverOptions {
  readonly halfWidth?: number;
  readonly depth?: number;
  readonly surfaceY?: number;
}

/** A straight river of constant width, depth and level from (x0, z0) to (x1, z1), sampled every 4 m. */
export function makeStraightRiver(x0: number, z0: number, x1: number, z1: number, options: StraightRiverOptions = {}): River {
  const length = Math.hypot(x1 - x0, z1 - z0);
  const tx = (x1 - x0) / length;
  const tz = (z1 - z0) / length;
  const count = Math.round(length / 4);
  const samples: RiverSample[] = [];
  for (let k = 0; k <= count; k++) {
    const s = (length * k) / count;
    samples.push({
      x: x0 + tx * s,
      z: z0 + tz * s,
      s,
      tx,
      tz,
      halfWidth: options.halfWidth ?? 14,
      depth: options.depth ?? 3.2,
      surfaceY: options.surfaceY ?? -2,
    });
  }
  return { id: 0, samples };
}

/** Half size of the playable square in `makeRiverWorld`. */
export const RIVER_WORLD_PLAYABLE = 250;

/**
 * Flat ground with a 28 m wide river flowing north to south through x = 0,
 * crossed by an east-west bridge at each of `bridgeZs` (one at z = 0 by default).
 */
export function makeRiverWorld(bridgeZs: readonly number[] = [0]): World {
  const terrain = new Terrain(300, 5);
  const river = makeStraightRiver(0, -300, 0, 300);
  const level = carveWater(terrain, [river], [], RIVER_WORLD_PLAYABLE);
  const bridges = bridgeZs.map((z, id) => {
    const crossing = planCrossing(terrain, level, river, Math.round((z + 300) / 4), RIVER_WORLD_PLAYABLE);
    if (!crossing) throw new Error(`makeRiverWorld: no crossing at z = ${z}`);
    return buildBridge(terrain, level, crossing, id);
  });
  const water = createWaterMap(terrain, level, bridges, RIVER_WORLD_PLAYABLE + 40);
  return new World(1, terrain, [], RIVER_WORLD_PLAYABLE, { water, rivers: [river], lakes: [], bridges });
}

export interface Trough {
  readonly terrain: Terrain;
  /** Water level per vertex: `surface` where the ground is at or below it and on the next ring of vertices, NaN elsewhere. */
  readonly level: Float32Array;
}

/**
 * A straight channel along Z: the ground is `slope * |x| - floor` (never above
 * zero) and water stands at `surface`. With the defaults the water is 2 m deep
 * in the middle, 1.2 m deep at |x| = 4 and meets the ground at |x| = 10.
 */
export function makeTrough(halfSize = 60, slope = 0.2, floor = 3, surface = -1): Trough {
  const terrain = new Terrain(halfSize, 5);
  const res = terrain.resolution;
  const level = new Float32Array(res * res).fill(Number.NaN);
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      terrain.heights[terrain.index(i, j)] = Math.min(0, slope * Math.abs(terrain.vertexX(i)) - floor);
    }
  }
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      let wet = false;
      for (let di = -1; di <= 1 && !wet; di++) {
        const ni = i + di;
        if (ni >= 0 && ni < res && terrain.heights[terrain.index(ni, j)]! <= surface) wet = true;
      }
      if (wet) level[terrain.index(i, j)] = surface;
    }
  }
  return { terrain, level };
}

/** A bridge whose deck runs along X (east-west), centred on (x, z); override any field. */
export function makeBridge(overrides: Partial<Bridge> = {}): Bridge {
  return {
    id: 0,
    riverId: 0,
    x: 0,
    z: 0,
    yaw: Math.PI / 2,
    halfLength: 30,
    halfSpan: 22,
    halfWidth: 7,
    endY: 5,
    arch: 0.5,
    rampLength: 24,
    piers: [-8, 8],
    footY: -6,
    ...overrides,
  };
}
