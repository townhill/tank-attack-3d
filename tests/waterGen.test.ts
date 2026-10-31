import { describe, expect, it } from 'vitest';
import { BRIDGE, TERRAIN_TYPES, WATER } from '../src/config/settings';
import { createBridgeLocal, deckHeightAt, toBridgeLocal } from '../src/world/Bridge';
import { buildBridge, placeBridges, planCrossing } from '../src/world/BridgePlacer';
import { Terrain } from '../src/world/Terrain';
import type { Lake } from '../src/world/Water';
import { createWaterMap, lakeRadiusAt } from '../src/world/Water';
import { BANK_FREEBOARD, BANK_WIDTH, carveWater, planLakes, planRivers, SPAWN_WATER_CLEARANCE } from '../src/world/WaterGenerator';
import { DEFAULT_WORLD_OPTIONS, generateHeights } from '../src/world/WorldGenerator';
import { makeStraightRiver } from './waterFixtures';

const P = DEFAULT_WORLD_OPTIONS.playableHalfSize;

describe('carveWater: a straight river on flat ground', () => {
  // Half width 14 puts the bank tops (14 + 6 m out) exactly on terrain vertices.
  const terrain = new Terrain(200, 5);
  const river = makeStraightRiver(0, -200, 0, 200, { halfWidth: 14, depth: 3, surfaceY: -2 });
  const level = carveWater(terrain, [river], [], 150);

  it('cuts the channel to the river depth below the surface on the centreline', () => {
    expect(terrain.heightAt(0, 10)).toBeCloseTo(-5, 5);
  });

  it('raises the bank tops to the freeboard above the water and leaves higher ground beyond', () => {
    expect(terrain.heightAt(14 + BANK_WIDTH, 0)).toBeCloseTo(-2 + BANK_FREEBOARD, 5);
    expect(terrain.heightAt(-(14 + BANK_WIDTH), 30)).toBeCloseTo(-2 + BANK_FREEBOARD, 5);
    expect(terrain.heightAt(40, 0)).toBe(0);
  });

  it('records the water level on wet vertices and their neighbours only', () => {
    const at = (x: number): number => level[terrain.index(Math.round((x + 200) / 5), 40)]!;
    expect(at(0)).toBe(-2);
    expect(at(10)).toBe(-2);
    expect(at(15)).toBe(-2);
    expect(at(20)).toBeNaN();
    expect(at(25)).toBeNaN();
  });

  it('meets the ground where the drawn water meets the drawn bank', () => {
    const water = createWaterMap(terrain, level, [], 150);
    expect(water.depthAt(0, 0)).toBeCloseTo(3, 5);
    expect(water.depthAt(13.5, 0)).toBeGreaterThan(0);
    expect(water.depthAt(14.5, 0)).toBe(0);
  });

  it('keeps every slope a wading tank can reach gentle', () => {
    const water = createWaterMap(terrain, level, [], 150);
    for (let x = -60; x <= 60; x += 1) {
      if (water.isBlocked(x, 0)) continue;
      expect(terrain.slopeAt(x, 0)).toBeLessThan(0.5);
    }
  });
});

describe('carveWater: a river cut 42 m deep through high flat ground', () => {
  // Half width 14 puts the bank tops 20 m out; the ground stands 42 m above the water.
  const GROUND = 40;
  const cutting = (): { terrain: Terrain; river: ReturnType<typeof makeStraightRiver> } => {
    const terrain = new Terrain(300, 5);
    terrain.heights.fill(GROUND);
    return { terrain, river: makeStraightRiver(0, -300, 0, 300, { halfWidth: 14, depth: 3, surfaceY: -2 }) };
  };
  const hilly = TERRAIN_TYPES.hilly.profile.riverValley;
  const bench = cutting();
  const benchLevel = carveWater(bench.terrain, [bench.river], [], 250, hilly);
  const top = -2 + BANK_FREEBOARD;

  it('rises no steeper than the bench slope across a bench beside each bank', () => {
    expect(bench.terrain.heightAt(14 + BANK_WIDTH, 0)).toBeCloseTo(top, 5);
    for (let x = 14 + BANK_WIDTH + 3; x <= 14 + BANK_WIDTH + hilly.benchWidth - 3; x += 1) {
      expect(bench.terrain.slopeAt(x, 0)).toBeLessThanOrEqual(hilly.benchSlope + 1e-3);
      expect(bench.terrain.slopeAt(-x, 0)).toBeLessThanOrEqual(hilly.benchSlope + 1e-3);
    }
    expect(bench.terrain.heightAt(14 + BANK_WIDTH + hilly.benchWidth, 0)).toBeCloseTo(top + hilly.benchSlope * hilly.benchWidth, 4);
  });

  it('climbs the valley walls beyond the bench and meets the natural ground inside the carving reach', () => {
    for (let x = 14 + BANK_WIDTH + hilly.benchWidth + 3; x <= 14 + BANK_WIDTH + hilly.reach; x += 1) {
      expect(bench.terrain.slopeAt(x, 0)).toBeLessThan(0.41);
    }
    expect(bench.terrain.heightAt(14 + BANK_WIDTH + hilly.reach - 5, 0)).toBe(GROUND);
  });

  it('lets bridge ramps climb out of the cutting, which plain valley walls do not', () => {
    expect(placeBridges(bench.terrain, benchLevel, [bench.river], 250).length).toBeGreaterThan(0);
    const plain = cutting();
    const plainLevel = carveWater(plain.terrain, [plain.river], [], 250);
    expect(placeBridges(plain.terrain, plainLevel, [plain.river], 250)).toEqual([]);
  });
});

describe('carveWater: a pond on flat ground', () => {
  const terrain = new Terrain(100, 5);
  const pond: Lake = { id: 0, kind: 'pond', x: 0, z: 0, surfaceY: 1, radius: 20, maxDepth: 2.5, shape: [1, 1, 1, 1] };
  const level = carveWater(terrain, [], [pond], 80);

  it('digs a bowl to the full depth at the centre', () => {
    expect(terrain.heightAt(0, 0)).toBeCloseTo(1 - 2.5, 5);
    expect(level[terrain.index(20, 20)]).toBe(1);
  });

  it('keeps the ground just beyond the shore above the water all the way round, so it cannot spill', () => {
    let checked = 0;
    for (let j = 0; j < terrain.resolution; j++) {
      for (let i = 0; i < terrain.resolution; i++) {
        const x = terrain.vertexX(i);
        const z = terrain.vertexZ(j);
        const e = Math.hypot(x, z) - lakeRadiusAt(pond, Math.atan2(z, x));
        if (e <= 0.5 || e > BANK_WIDTH) continue;
        expect(terrain.vertexHeight(i, j)).toBeGreaterThanOrEqual(1);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe('planRivers and planLakes on generated terrain', () => {
  const seeds = [1234, 4321, 7, 2024, 99999];
  const plans = seeds.map((seed) => {
    const terrain = generateHeights(seed, DEFAULT_WORLD_OPTIONS);
    const rivers = planRivers(seed, terrain, P, 1);
    const lakes = planLakes(seed, terrain, P, rivers, 1, 2);
    return { seed, terrain, rivers, lakes };
  });

  it('is deterministic', () => {
    const terrain = generateHeights(1234, DEFAULT_WORLD_OPTIONS);
    expect(planRivers(1234, terrain, P, 1)).toEqual(plans[0]!.rivers);
  });

  it('plans one river per battlefield that crosses the playable square from edge to edge', () => {
    for (const { rivers, terrain } of plans) {
      expect(rivers).toHaveLength(1);
      const samples = rivers[0]!.samples;
      const first = samples[0]!;
      const last = samples[samples.length - 1]!;
      expect(Math.max(Math.abs(first.x), Math.abs(first.z))).toBeGreaterThan(terrain.halfSize - 40);
      expect(Math.max(Math.abs(last.x), Math.abs(last.z))).toBeGreaterThan(terrain.halfSize - 40);
      expect(samples.some((p) => Math.max(Math.abs(p.x), Math.abs(p.z)) < P - 100)).toBe(true);
    }
  });

  it('keeps every river clear of the spawn point', () => {
    for (const { rivers } of plans) {
      for (const p of rivers[0]!.samples) {
        expect(Math.hypot(p.x, p.z) - p.halfWidth).toBeGreaterThan(SPAWN_WATER_CLEARANCE);
      }
    }
  });

  it('never lets the water run uphill, and keeps the channel sides gentle', () => {
    for (const { rivers } of plans) {
      const samples = rivers[0]!.samples;
      for (let k = 1; k < samples.length; k++) {
        expect(samples[k]!.surfaceY).toBeLessThanOrEqual(samples[k - 1]!.surfaceY + 1e-9);
        expect(samples[k]!.s).toBeGreaterThan(samples[k - 1]!.s);
      }
      for (const p of samples) {
        expect(p.halfWidth).toBeGreaterThanOrEqual(10);
        expect(p.depth).toBeGreaterThan(WATER.impassableDepth * 2);
        expect(p.depth).toBeLessThanOrEqual(0.28 * p.halfWidth + 1e-9);
        expect(Math.hypot(p.tx, p.tz)).toBeCloseTo(1, 6);
      }
    }
  });

  it('places lakes and ponds inside the square, clear of spawn, rivers and each other', () => {
    for (const { rivers, lakes } of plans) {
      expect(lakes.length).toBeGreaterThan(0);
      for (const lake of lakes) {
        const reach = lake.radius * 1.25;
        expect(Math.max(Math.abs(lake.x), Math.abs(lake.z)) + reach).toBeLessThan(P);
        expect(Math.hypot(lake.x, lake.z) - reach).toBeGreaterThan(SPAWN_WATER_CLEARANCE);
        for (const p of rivers[0]!.samples) expect(Math.hypot(p.x - lake.x, p.z - lake.z) - p.halfWidth - reach).toBeGreaterThan(60);
        for (const other of lakes) {
          if (other === lake) continue;
          expect(Math.hypot(other.x - lake.x, other.z - lake.z)).toBeGreaterThan((other.radius + lake.radius) * 1.25);
        }
      }
    }
  });
});

describe('planCrossing and buildBridge', () => {
  const terrain = new Terrain(300, 5);
  const river = makeStraightRiver(0, -300, 0, 300);
  const level = carveWater(terrain, [river], [], 250);
  const middle = (river.samples.length - 1) / 2;
  const crossing = planCrossing(terrain, level, river, middle, 250);
  if (!crossing) throw new Error('expected a crossing');
  const bridge = buildBridge(terrain, level, crossing, 3);
  const local = createBridgeLocal();

  it('spans from bank top to bank top square to the flow', () => {
    expect(bridge.id).toBe(3);
    expect(bridge.x).toBeCloseTo(0, 1);
    expect(Math.abs(Math.sin(bridge.yaw))).toBeCloseTo(1, 6);
    expect(bridge.halfSpan).toBeCloseTo(14 + BANK_WIDTH, 0);
    expect(bridge.halfLength).toBeCloseTo(bridge.halfSpan + BRIDGE.bankOverlap, 9);
    expect(bridge.halfWidth).toBe(BRIDGE.deckHalfWidth);
  });

  it('clears the water and stands its piers inside the span', () => {
    expect(bridge.endY).toBeGreaterThanOrEqual(-2 + BANK_FREEBOARD);
    expect(bridge.piers.length).toBeGreaterThan(0);
    for (const pier of bridge.piers) expect(Math.abs(pier)).toBeLessThan(bridge.halfSpan);
    expect(bridge.footY).toBeLessThan(-2 - WATER.impassableDepth);
  });

  it('grades the ground where the deck rests on each bank to the road height', () => {
    for (const along of [bridge.halfSpan + 1, bridge.halfLength - 2, -(bridge.halfSpan + 1), -(bridge.halfLength - 2)]) {
      for (const lateral of [-5, 0, 5]) {
        const x = bridge.x + Math.cos(bridge.yaw) * lateral - Math.sin(bridge.yaw) * along;
        const z = bridge.z + Math.sin(bridge.yaw) * lateral + Math.cos(bridge.yaw) * along;
        expect(toBridgeLocal(bridge, x, z, local).along).toBeCloseTo(along, 6);
        expect(terrain.heightAt(x, z)).toBeCloseTo(bridge.endY, 1);
      }
    }
  });

  it('ramps down to the natural ground no steeper than the ramp limit', () => {
    for (const sign of [1, -1]) {
      let previous = deckHeightAt(bridge, sign * bridge.halfLength);
      for (let d = 0.5; d <= bridge.rampLength; d += 0.5) {
        const along = sign * (bridge.halfLength + d);
        const h = terrain.heightAt(bridge.x - Math.sin(bridge.yaw) * along, bridge.z + Math.cos(bridge.yaw) * along);
        expect(Math.abs(h - previous) / 0.5).toBeLessThanOrEqual(BRIDGE.maxRampGrade + 0.05);
        previous = h;
      }
    }
  });

  it('refuses a crossing where a bank is missing', () => {
    expect(planCrossing(terrain, level, river, 1, 250)).toBeNull();
  });
});

describe('placeBridges on generated terrain', () => {
  it.each([1234, 4321, 7])('spreads at least two bridges along the river (seed %i)', (seed) => {
    const terrain = generateHeights(seed, DEFAULT_WORLD_OPTIONS);
    const rivers = planRivers(seed, terrain, P, 1);
    const level = carveWater(terrain, rivers, [], P);
    const bridges = placeBridges(terrain, level, rivers, P);
    expect(bridges.length).toBeGreaterThanOrEqual(2);
    bridges.forEach((b, index) => {
      expect(b.id).toBe(index);
      expect(Math.max(Math.abs(b.x), Math.abs(b.z)) + b.halfLength + b.rampLength).toBeLessThan(P);
    });
    for (let a = 0; a < bridges.length; a++) {
      for (let b = a + 1; b < bridges.length; b++) {
        expect(Math.hypot(bridges[a]!.x - bridges[b]!.x, bridges[a]!.z - bridges[b]!.z)).toBeGreaterThan(BRIDGE.minSpacing * 0.6);
      }
    }
  });
});
