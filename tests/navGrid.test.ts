import { describe, expect, it } from 'vitest';
import { NavGrid } from '../src/world/NavGrid';
import { createWaterMap, WaterMap } from '../src/world/Water';
import { makeBridge, makeTrough } from './waterFixtures';

// A 19 m wide impassable river running north-south through x = 0.
const river = makeTrough(300, 0.4, 6);
const PLAYABLE = 250;

describe('NavGrid regions', () => {
  it('puts the whole battlefield in one region when there is no water', () => {
    const nav = new NavGrid(PLAYABLE, WaterMap.dry(river.terrain), []);
    const region = nav.regionAt(-200, -200);
    expect(region).toBeGreaterThanOrEqual(0);
    expect(nav.regionAt(200, 200)).toBe(region);
    expect(nav.regionShare(region)).toBe(1);
  });

  it('a river with no bridge splits the banks into separate regions', () => {
    const water = createWaterMap(river.terrain, river.level, [], PLAYABLE + 40);
    const nav = new NavGrid(PLAYABLE, water, []);
    const west = nav.regionAt(-100, 0);
    const east = nav.regionAt(100, 0);
    expect(west).toBeGreaterThanOrEqual(0);
    expect(east).toBeGreaterThanOrEqual(0);
    expect(east).not.toBe(west);
    expect(nav.regionShare(west)).toBeCloseTo(0.5, 1);
  });

  it('a bridge joins the banks into one region', () => {
    const bridge = makeBridge({ halfSpan: 16, halfLength: 24, rampLength: 20 });
    const water = createWaterMap(river.terrain, river.level, [bridge], PLAYABLE + 40);
    const nav = new NavGrid(PLAYABLE, water, [bridge]);
    expect(nav.regionAt(100, 150)).toBe(nav.regionAt(-100, -150));
    expect(nav.regionShare(nav.regionAt(100, 0))).toBe(1);
  });

  it('marks cells too close to blocked water as unwalkable', () => {
    const water = createWaterMap(river.terrain, river.level, [], PLAYABLE + 40);
    const nav = new NavGrid(PLAYABLE, water, []);
    expect(nav.isWalkable(0, 0)).toBe(false);
    expect(nav.isWalkable(5, 100)).toBe(false);
    expect(nav.isWalkable(60, 100)).toBe(true);
  });

  it('snaps a point in the water to the region of the nearest walkable cell', () => {
    const water = createWaterMap(river.terrain, river.level, [], PLAYABLE + 40);
    const nav = new NavGrid(PLAYABLE, water, []);
    const region = nav.regionAt(2, 40);
    expect(region === nav.regionAt(-100, 40) || region === nav.regionAt(100, 40)).toBe(true);
  });

  it('reports -1 outside the playable square', () => {
    const nav = new NavGrid(PLAYABLE, WaterMap.dry(river.terrain), []);
    expect(nav.regionAt(400, 0)).toBe(-1);
  });
});
