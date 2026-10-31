import { describe, expect, it } from 'vitest';
import { NavGrid } from '../src/world/NavGrid';
import { Terrain } from '../src/world/Terrain';
import { createWaterMap, WaterMap } from '../src/world/Water';
import { makeBridge, makeFordWorld, makeRiverWorld, makeTrough, RIVER_WORLD_PLAYABLE } from './waterFixtures';

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

describe('NavGrid banks, portals and costs', () => {
  // Bridges at z = -120 and z = 100 over the river through x = 0.
  const world = makeRiverWorld([-120, 100]);
  const nav = new NavGrid(RIVER_WORLD_PLAYABLE, world.water, world.bridges, { terrain: world.terrain, obstacles: [] });

  it('keeps the banks apart as sides while the bridges join them into one region', () => {
    expect(nav.sideAt(-100, 0)).not.toBe(nav.sideAt(100, 0));
    expect(nav.regionAt(-100, 0)).toBe(nav.regionAt(100, 0));
  });

  it('makes each bridge a portal between ground cells on opposite banks', () => {
    expect(nav.portals).toHaveLength(2);
    for (const portal of nav.portals) {
      const [plus, minus] = portal.ends;
      expect(plus.sign).toBe(1);
      expect(minus.sign).toBe(-1);
      expect(plus.side).not.toBe(minus.side);
      expect(nav.walkable[plus.cell]).toBe(1);
      expect(nav.walkable[minus.cell]).toBe(1);
      const bridge = world.bridges[portal.bridgeId]!;
      expect(Math.abs(plus.z - bridge.z)).toBeLessThan(1);
      expect(Math.abs(Math.abs(plus.x - bridge.x) - (bridge.halfLength + 6))).toBeLessThan(1);
    }
  });

  it('charges more for shallow water and steep ground than for open flat ground', () => {
    const flat = nav.cost[nav.cellAt(-100, 50)]!;
    expect(flat).toBe(1);
    const steep = new Terrain(300, 5);
    for (let k = 0; k < steep.heights.length; k++) steep.heights[k] = 0.6 * steep.vertexX(k % steep.resolution);
    const slopeNav = new NavGrid(RIVER_WORLD_PLAYABLE, WaterMap.dry(steep), [], { terrain: steep, obstacles: [] });
    expect(slopeNav.cost[slopeNav.cellAt(0, 0)]).toBeGreaterThan(flat);
  });

  it('blocks cells covered by an obstacle and its clearance', () => {
    const block = { id: 0, kind: 'block' as const, x: -100, z: 50, yaw: 0, shape: { type: 'box' as const, halfX: 12, halfZ: 12 }, baseY: 0, height: 10, boundRadius: Math.hypot(12, 12), seed: 0 };
    const blocked = new NavGrid(RIVER_WORLD_PLAYABLE, world.water, world.bridges, { terrain: world.terrain, obstacles: [block] });
    expect(blocked.isWalkable(-100, 50)).toBe(false);
    expect(blocked.isWalkable(-100, 85)).toBe(true);
  });

  it('projects a goal across the river back onto the tank side', () => {
    const out = { x: 0, z: 0 };
    expect(nav.projectToSide(80, 30, -80, 30, nav.sideAt(-80, 30), out)).toBe(true);
    expect(out.x).toBeLessThan(-10);
    expect(out.x).toBeGreaterThan(-40);
    expect(out.z).toBeCloseTo(30, 6);
    expect(nav.projectToSide(-60, 30, -80, 30, nav.sideAt(-80, 30), out)).toBe(true);
    expect(out.x).toBe(-60);
  });

  it('tells whether a straight drive stays clear of deep water', () => {
    expect(nav.isWaterClear(-100, -200, -100, 200, 5)).toBe(true);
    expect(nav.isWaterClear(-100, 30, 100, 30, 5)).toBe(false);
  });
});

describe('NavGrid fords', () => {
  // The river world with a bridge at z = 100 and a ford further south.
  const world = makeFordWorld();
  const ford = world.fords[0]!;
  const nav = world.nav;

  it('keeps the banks apart at a ford, as a bridge does, but joins them in one region', () => {
    expect(ford.z).toBeLessThan(0);
    const west = nav.sideAt(-60, ford.z);
    const east = nav.sideAt(60, ford.z);
    expect(west).toBeGreaterThanOrEqual(0);
    expect(east).toBeGreaterThanOrEqual(0);
    expect(west).not.toBe(east);
    expect(nav.regionAt(-60, ford.z)).toBe(nav.regionAt(60, ford.z));
  });

  it('links the banks across the ford with a crossing whose ends stand on either bank', () => {
    expect(nav.portals).toHaveLength(2);
    const portal = nav.portals.find((p) => p.fordId === 0)!;
    expect(portal.bridgeId).toBe(-1);
    const [a, b] = portal.ends;
    expect(a.side).not.toBe(b.side);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeCloseTo(portal.length);
    expect(portal.length).toBeGreaterThan(2 * ford.halfWidth);
    for (const end of portal.ends) expect(Math.abs(end.z - ford.z)).toBeLessThan(1);
    expect(nav.portals.find((p) => p.bridgeId === 0)!.fordId).toBe(-1);
  });

  it('leaves the shallow water of the ford off the walkable ground', () => {
    expect(nav.isWalkable(ford.x, ford.z)).toBe(false);
    expect(nav.isWalkable(-60, ford.z)).toBe(true);
  });

  it('knows which ford a point stands in', () => {
    expect(nav.fordAt(ford.x, ford.z)).toBe(0);
    expect(nav.fordAt(ford.x + ford.halfWidth - 1, ford.z + ford.halfLength)).toBe(0);
    expect(nav.fordAt(-60, ford.z)).toBe(-1);
    expect(nav.fordAt(ford.x, ford.z + 120)).toBe(-1);
  });
});
