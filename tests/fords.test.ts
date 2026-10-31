import { describe, expect, it } from 'vitest';
import { WATER } from '../src/config/settings';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/config/userSettings';
import type { Bridge } from '../src/world/Bridge';
import { buildBridge, planCrossing } from '../src/world/BridgePlacer';
import { FORD_BRIDGE_CLEARANCE, FORD_DEPTH, FORD_HALF_LENGTH, placeFords } from '../src/world/FordPlacer';
import { Terrain } from '../src/world/Terrain';
import type { River, WaterMap } from '../src/world/Water';
import { createWaterMap } from '../src/world/Water';
import { carveWater } from '../src/world/WaterGenerator';
import { generateWorld, worldOptionsFor } from '../src/world/WorldGenerator';
import { packWorld, unpackWorld } from '../src/world/worldTransfer';
import { FORD_LINK_OFFSET } from '../src/world/NavGrid';
import { makeStraightRiver, RIVER_WORLD_PLAYABLE } from './waterFixtures';

/** Generating several battlefields can take a while under coverage instrumentation (ms). */
const GENERATION_TIMEOUT = 30_000;

interface Scene {
  readonly terrain: Terrain;
  readonly level: Float32Array;
  readonly river: River;
  readonly bridges: Bridge[];
}

/** The river world of the fixtures before its water map is built: a straight river north to south, bridged at z = 0. */
function riverScene(): Scene {
  const terrain = new Terrain(300, 5);
  const river = makeStraightRiver(0, -300, 0, 300);
  const level = carveWater(terrain, [river], [], RIVER_WORLD_PLAYABLE);
  const crossing = planCrossing(terrain, level, river, Math.round(300 / 4), RIVER_WORLD_PLAYABLE);
  if (!crossing) throw new Error('no crossing at z = 0');
  return { terrain, level, river, bridges: [buildBridge(terrain, level, crossing, 0)] };
}

function waterOf(s: Scene): WaterMap {
  return createWaterMap(s.terrain, s.level, s.bridges, RIVER_WORLD_PLAYABLE + 40);
}

describe('placeFords', () => {
  it('fords each river once, along a reach well clear of its bridges and the map edge', () => {
    const s = riverScene();
    const fords = placeFords(s.terrain, [s.river], s.bridges, RIVER_WORLD_PLAYABLE);
    expect(fords).toHaveLength(1);
    const ford = fords[0]!;
    expect(ford.riverId).toBe(0);
    expect(ford.x).toBeCloseTo(0);
    expect(Math.abs(ford.z)).toBeGreaterThanOrEqual(FORD_BRIDGE_CLEARANCE - 4);
    expect(Math.abs(ford.z)).toBeLessThan(RIVER_WORLD_PLAYABLE - 40);
    expect(ford.tx).toBeCloseTo(0);
    expect(ford.tz).toBeCloseTo(1);
  });

  it('raises the riverbed so the water across the ford is shallow enough to wade but still water', () => {
    const s = riverScene();
    const [ford] = placeFords(s.terrain, [s.river], s.bridges, RIVER_WORLD_PLAYABLE);
    const water = waterOf(s);
    for (let along = -FORD_HALF_LENGTH; along <= FORD_HALF_LENGTH; along += 2.5) {
      for (let across = -30; across <= 30; across += 1) {
        const x = ford!.x + across;
        const z = ford!.z + along;
        expect(water.depthAt(x, z)).toBeLessThanOrEqual(FORD_DEPTH + 0.01);
        expect(water.isBlocked(x, z)).toBe(false);
      }
    }
    expect(water.depthAt(ford!.x, ford!.z)).toBeGreaterThan(FORD_DEPTH * 0.8);
  });

  it('leaves the rest of the river too deep to cross', () => {
    const s = riverScene();
    const [ford] = placeFords(s.terrain, [s.river], s.bridges, RIVER_WORLD_PLAYABLE);
    const water = waterOf(s);
    for (const offset of [60, 120]) {
      for (const side of [-1, 1]) {
        const z = ford!.z + side * offset;
        if (Math.abs(z) > RIVER_WORLD_PLAYABLE || Math.abs(z) < 20) continue;
        expect(water.depthAt(0, z)).toBeGreaterThan(WATER.impassableDepth);
        expect(water.isBlocked(0, z)).toBe(true);
      }
    }
  });

  it('keeps the water level where it was', () => {
    const s = riverScene();
    const before = s.level.slice();
    placeFords(s.terrain, [s.river], s.bridges, RIVER_WORLD_PLAYABLE);
    expect(Array.from(s.level)).toEqual(Array.from(before));
  });

  it('places nothing on a river with no reach far enough from its bridges', () => {
    const s = riverScene();
    const crowded: Bridge[] = [...s.bridges, { ...s.bridges[0]!, id: 1, z: -150 }, { ...s.bridges[0]!, id: 2, z: 150 }];
    expect(placeFords(s.terrain, [s.river], crowded, RIVER_WORLD_PLAYABLE)).toEqual([]);
  });
});

describe('fords on generated battlefields', () => {
  it('are off unless asked for, leaving the battlefield exactly as before', () => {
    expect(worldOptionsFor('standard').fords).toBe(false);
    expect(worldOptionsFor('large', true).fords).toBe(true);
    const plain = generateWorld(2);
    const unforded = generateWorld(2, worldOptionsFor('standard', false));
    expect(plain.fords).toEqual([]);
    expect(Array.from(unforded.terrain.heights)).toEqual(Array.from(plain.terrain.heights));
  });

  it('give every river a wadeable crossing when asked for, the same way every time', () => {
    for (const seed of [2, 3, 7]) {
      const world = generateWorld(seed, worldOptionsFor('standard', true));
      expect(world.fords).toHaveLength(world.rivers.length);
      for (const ford of world.fords) {
        expect(world.water.isBlocked(ford.x, ford.z)).toBe(false);
        expect(world.water.depthAt(ford.x, ford.z)).toBeGreaterThan(0);
        expect(world.water.depthAt(ford.x, ford.z)).toBeLessThan(WATER.impassableDepth);
      }
    }
    expect(generateWorld(2, worldOptionsFor('standard', true)).fords).toEqual(generateWorld(2, worldOptionsFor('standard', true)).fords);
  }, GENERATION_TIMEOUT);

  it('keep obstacles off the way across', () => {
    // Large seed 51 once had a rock beside its ford.
    for (const [seed, size] of [[51, 'large'], [3, 'standard']] as const) {
      const world = generateWorld(seed, worldOptionsFor(size, true));
      expect(world.fords.length).toBeGreaterThan(0);
      for (const f of world.fords) {
        for (const ob of world.obstacles) {
          const dx = ob.x - f.x;
          const dz = ob.z - f.z;
          const along = Math.abs(dx * f.tx + dz * f.tz);
          const across = Math.abs(dz * f.tx - dx * f.tz);
          expect(along < f.halfLength + ob.boundRadius && across < f.halfWidth + FORD_LINK_OFFSET + ob.boundRadius).toBe(false);
        }
      }
    }
  }, GENERATION_TIMEOUT);

  it('travel with a packed battlefield', () => {
    const world = generateWorld(3, worldOptionsFor('standard', true));
    expect(unpackWorld(structuredClone(packWorld(world))).fords).toEqual(world.fords);
  });
});

describe('fords setting', () => {
  it('is off by default and only a boolean turns it on', () => {
    expect(DEFAULT_SETTINGS.fords).toBe(false);
    expect(sanitizeSettings({ fords: true }).fords).toBe(true);
    expect(sanitizeSettings({ fords: 'yes' }).fords).toBe(false);
  });
});
