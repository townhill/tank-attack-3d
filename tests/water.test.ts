import { describe, expect, it } from 'vitest';
import { TANK_SPECS, WATER } from '../src/config/settings';
import { createPushResult, NO_HIT, segmentVsWater } from '../src/world/Collision';
import { Terrain } from '../src/world/Terrain';
import { createWaterMap, lakeRadiusAt, WaterMap } from '../src/world/Water';
import type { Lake } from '../src/world/Water';
import { makeBridge, makeTrough } from './waterFixtures';

describe('WaterMap depth and surface', () => {
  const { terrain, level } = makeTrough();
  const water = createWaterMap(terrain, level, [], 50);

  it('measures depth over the same triangles as the ground', () => {
    expect(water.depthAt(0, 3)).toBeCloseTo(2, 5);
    expect(water.depthAt(7, -12)).toBeCloseTo(0.6, 5);
    expect(water.depthAt(-7, 20)).toBeCloseTo(0.6, 5);
  });

  it('is dry beyond the shoreline and where no water level is set', () => {
    expect(water.depthAt(12, 0)).toBe(0);
    expect(water.depthAt(40, 0)).toBe(0);
    expect(water.surfaceAt(12, 0)).toBeNaN();
    expect(water.surfaceAt(40, 0)).toBeNaN();
  });

  it('reports the water surface where it is wet', () => {
    expect(water.surfaceAt(0, 0)).toBeCloseTo(-1, 6);
    expect(water.surfaceAt(8, 30)).toBeCloseTo(-1, 6);
    expect(water.maxLevel).toBeCloseTo(-1, 6);
  });

  it('slows wading in proportion to depth and stops slowing on dry ground', () => {
    expect(water.wadingFactor(40, 0)).toBe(1);
    expect(water.wadingFactor(7, 0)).toBeCloseTo(1 + (WATER.wadingSpeedFactor - 1) * (0.6 / WATER.impassableDepth), 5);
    expect(water.wadingFactor(0, 0)).toBeCloseTo(WATER.wadingSpeedFactor, 9);
  });
});

describe('WaterMap blocked water', () => {
  const { terrain, level } = makeTrough();
  const water = createWaterMap(terrain, level, [], 50);
  const radius = TANK_SPECS.standard.collisionRadius;

  it('blocks only water deeper than the impassable depth', () => {
    // The trough is 1.2 m deep at |x| = 4.
    expect(water.isBlocked(0, 0)).toBe(true);
    expect(water.isBlocked(2.5, 10)).toBe(true);
    expect(water.isBlocked(7, 10)).toBe(false);
    expect(water.isBlocked(30, 10)).toBe(false);
  });

  it('measures the distance to blocked water to within one field cell', () => {
    expect(Math.abs(water.blockedDistance(20, 5) - 16)).toBeLessThan(WATER.fieldCellSize);
    expect(water.blockedDistance(-30, -5)).toBeGreaterThan(water.blockedDistance(-20, -5));
  });

  it('pushes a tank centre that is too close back out to its own radius', () => {
    const push = createPushResult();
    expect(water.pushOut(6, 0, radius, push)).toBe(true);
    expect(push.nx).toBeCloseTo(1, 3);
    expect(push.nz).toBeCloseTo(0, 3);
    expect(water.blockedDistance(6 + push.nx * push.depth, push.nz * push.depth)).toBeCloseTo(radius, 1);
    expect(water.pushOut(-6, 0, radius, push)).toBe(true);
    expect(push.nx).toBeCloseTo(-1, 3);
  });

  it('leaves tanks clear of blocked water alone', () => {
    expect(water.pushOut(25, 0, radius, createPushResult())).toBe(false);
  });

  it('blocks the ground under a bridge span so tanks cannot drive beneath the deck', () => {
    const bridge = makeBridge({ halfSpan: 14, halfLength: 22 });
    const withBridge = createWaterMap(terrain, level, [bridge], 50);
    expect(withBridge.isBlocked(12, 0)).toBe(true);
    expect(withBridge.isBlocked(-12, 6)).toBe(true);
    expect(withBridge.isBlocked(12, 20)).toBe(false);
    expect(withBridge.isBlocked(18, 0)).toBe(false);
  });
});

describe('WaterMap.dry', () => {
  const water = WaterMap.dry(new Terrain(50, 5));

  it('has no water anywhere', () => {
    expect(water.maxLevel).toBe(-Infinity);
    expect(water.depthAt(3, 4)).toBe(0);
    expect(water.surfaceAt(3, 4)).toBeNaN();
    expect(water.isBlocked(3, 4)).toBe(false);
    expect(water.wadingFactor(3, 4)).toBe(1);
    expect(water.pushOut(0, 0, 5, createPushResult())).toBe(false);
  });
});

describe('segmentVsWater', () => {
  const { terrain, level } = makeTrough();
  const water = createWaterMap(terrain, level, [], 50);

  it('finds where a falling shell meets the surface', () => {
    const t = segmentVsWater(0, 5, 0, 0, -5, 0, water, 1);
    expect(t).toBeCloseTo(0.6, 2);
  });

  it('starts inside the water when the first point is below the surface', () => {
    expect(segmentVsWater(0, -1.5, 0, 0, 5, 0, water, 1)).toBe(0);
  });

  it('misses a segment that never dips below the highest water', () => {
    expect(segmentVsWater(-30, 0, 0, 30, 0.5, 0, water, 1)).toBe(NO_HIT);
  });

  it('misses a segment that only dips below the level over dry ground', () => {
    expect(segmentVsWater(30, 5, 0, 30, -5, 0, water, 1)).toBe(NO_HIT);
  });

  it('misses everything when there is no water', () => {
    expect(segmentVsWater(0, 5, 0, 0, -5, 0, WaterMap.dry(terrain), 1)).toBe(NO_HIT);
  });
});

describe('lakeRadiusAt', () => {
  const lake: Lake = { id: 0, kind: 'pond', x: 0, z: 0, surfaceY: 0, radius: 20, maxDepth: 2.5, shape: [1, 1.2, 0.9, 1] };

  it('interpolates the shoreline radius around the lake and wraps at a full turn', () => {
    expect(lakeRadiusAt(lake, 0)).toBeCloseTo(20, 9);
    expect(lakeRadiusAt(lake, Math.PI / 2)).toBeCloseTo(24, 9);
    expect(lakeRadiusAt(lake, Math.PI / 4)).toBeCloseTo(22, 9);
    expect(lakeRadiusAt(lake, -Math.PI / 4)).toBeCloseTo(20, 9);
    expect(lakeRadiusAt(lake, 2 * Math.PI)).toBeCloseTo(20, 9);
  });
});
