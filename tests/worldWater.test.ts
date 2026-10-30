import { describe, expect, it } from 'vitest';
import { TANK_SPECS } from '../src/config/settings';
import { deckHeightAt } from '../src/world/Bridge';
import { createPushResult, NO_HIT } from '../src/world/Collision';
import { Terrain } from '../src/world/Terrain';
import { createStaticHit, World } from '../src/world/World';
import { makeRiverWorld } from './waterFixtures';

// The river flows north-south through x = 0 with its surface at y = -2; the
// bridge carries an east-west road across it at z = 0, so `along` is x and
// `lateral` is -z on the deck.
const world = makeRiverWorld();
const bridge = world.bridges[0]!;

describe('World ground with water and bridges', () => {
  it('has one river, one bridge and water in the channel', () => {
    expect(world.rivers).toHaveLength(1);
    expect(world.bridges).toHaveLength(1);
    expect(world.water.depthAt(0, 60)).toBeGreaterThan(3);
  });

  it('puts the ground on the road across the deck slab, out to the parapets and no further', () => {
    expect(world.heightAt(0, 0)).toBeCloseTo(deckHeightAt(bridge, 0), 6);
    expect(world.heightAt(10, -3)).toBeCloseTo(deckHeightAt(bridge, 10), 6);
    expect(world.heightAt(0, 7.3)).toBeCloseTo(deckHeightAt(bridge, 0), 6);
    expect(world.heightAt(0, 7.8)).toBeCloseTo(world.terrain.heightAt(0, 7.8), 9);
  });

  it('is the riverbed away from the deck', () => {
    expect(world.heightAt(0, 12)).toBeCloseTo(world.terrain.heightAt(0, 12), 9);
    expect(world.heightAt(0, 12)).toBeLessThan(-4);
  });

  it('meets the graded bank where the deck rests on it', () => {
    expect(world.heightAt(-25, 2)).toBeGreaterThanOrEqual(world.terrain.heightAt(-25, 2));
    expect(Math.abs(world.heightAt(-28, 0) - world.terrain.heightAt(-28, 0))).toBeLessThan(0.05);
  });

  it('reports the water surface as the top of everything over open water', () => {
    expect(world.surfaceHeightAt(0, 60)).toBeCloseTo(-2, 6);
    expect(world.surfaceHeightAt(0, 0)).toBeCloseTo(deckHeightAt(bridge, 0), 6);
    expect(world.surfaceHeightAt(60, 60)).toBeCloseTo(world.terrain.heightAt(60, 60), 9);
  });

  it('links both banks into one region through the bridge', () => {
    expect(world.nav.regionAt(-120, 80)).toBe(world.nav.regionAt(120, -80));
    expect(world.nav.regionShare(world.nav.regionAt(-120, 80))).toBe(1);
  });
});

describe('World raycasts against water and bridges', () => {
  const out = createStaticHit();

  it('stops a falling shell at the water surface', () => {
    world.raycastStatic(0, 10, 40, 0, -10, 40, out);
    expect(out.surface).toBe('water');
    expect(out.obstacle).toBeNull();
    expect(out.t).toBeCloseTo(0.6, 2);
  });

  it('can look through the water to the riverbed', () => {
    world.raycastStatic(0, 10, 40, 0, -10, 40, out, 1, false);
    expect(out.surface).toBe('terrain');
    expect(10 - 20 * out.t).toBeCloseTo(world.terrain.heightAt(0, 40), 1);
  });

  it('stops a shell on the road', () => {
    world.raycastStatic(5, 10, 2, 5, -10, 2, out);
    expect(out.surface).toBe('bridge');
    expect(10 - 20 * out.t).toBeCloseTo(deckHeightAt(bridge, 5), 1);
  });

  it('sees across the river over the water', () => {
    expect(world.hasLineOfSight(-40, 1, 60, 40, 1, 60)).toBe(true);
  });

  it('sees under the deck between the piers but not through the deck slab', () => {
    expect(world.hasLineOfSight(0, -1.2, -30, 0, -1.2, 30)).toBe(true);
    expect(world.hasLineOfSight(0, 0.5, -30, 0, 0.5, 30)).toBe(false);
  });

  it('a clean miss stays a miss', () => {
    world.raycastStatic(-40, 30, 40, 40, 30, 40, out);
    expect(out.t).toBe(NO_HIT);
    expect(out.surface).toBe('none');
  });
});

describe('World bridge tracking', () => {
  it('a tank joins the deck by driving onto the road from either end', () => {
    expect(world.trackBridge(-1, -31, 0)).toBe(-1);
    expect(world.trackBridge(-1, -26, 1)).toBe(0);
    expect(world.trackBridge(-1, 26, -2)).toBe(0);
  });

  it('a tank on the deck stays on it while crossing and leaves past either end', () => {
    expect(world.trackBridge(0, 0, 3)).toBe(0);
    expect(world.trackBridge(0, 29, 0)).toBe(-1);
    expect(world.trackBridge(0, -29, 0)).toBe(-1);
  });

  it('a tank driving past beside the deck end is not captured, and one on the deck leaves only over an end', () => {
    expect(world.trackBridge(-1, -24, 9)).toBe(-1);
    expect(world.trackBridge(0, -24, 8.5)).toBe(0);
    expect(world.trackBridge(0, -28.5, 3)).toBe(-1);
  });

  it('keeps a tank beside the deck outside its parapets', () => {
    const push = createPushResult();
    const radius = TANK_SPECS.standard.collisionRadius;
    // The deck lies along z = 0, so a tank at z = 9 is pushed further towards +z.
    expect(world.parapetPush(-24, 9, radius, push)).toBe(true);
    expect(push.nz).toBeCloseTo(1, 9);
    expect(world.parapetPush(-24, 14, radius, push)).toBe(false);
    expect(world.parapetPush(-60, 9, radius, push)).toBe(false);
  });

  it('pushes a crossing tank back between the kerbs', () => {
    const push = createPushResult();
    const radius = TANK_SPECS.standard.collisionRadius;
    expect(world.kerbPush(0, 0, 5, radius, push)).toBe(true);
    expect(push.nx).toBeCloseTo(0, 9);
    expect(push.nz).toBeCloseTo(-1, 9);
    expect(push.depth).toBeCloseTo(5 - (bridge.halfWidth - radius), 9);
    expect(world.kerbPush(-1, 0, 5, radius, push)).toBe(false);
  });
});

describe('World without water', () => {
  const dry = new World(1, new Terrain(100, 5), [], 80);

  it('has no water, no bridges and terrain ground', () => {
    expect(dry.bridges).toHaveLength(0);
    expect(dry.water.maxLevel).toBe(-Infinity);
    expect(dry.heightAt(3, 4)).toBe(dry.terrain.heightAt(3, 4));
    expect(dry.surfaceHeightAt(3, 4)).toBe(dry.terrain.heightAt(3, 4));
    expect(dry.trackBridge(-1, 0, 0)).toBe(-1);
  });
});
