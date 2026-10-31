import { describe, expect, it } from 'vitest';
import { NavPlanner } from '../src/ai/NavPlanner';
import { Route } from '../src/ai/PathFinder';
import { createWaypoint, PathFollower } from '../src/ai/PathFollower';
import { NAV, TANK_SPECS } from '../src/config/settings';
import type { Faction } from '../src/config/settings';
import { Tank } from '../src/entities/Tank';
import type { World } from '../src/world/World';
import { makeFordWorld, makeRiverWorld } from './waterFixtures';

// The river runs north-south through x = 0; on these bridges `along` is x,
// so a tank driving east travels in the +1 direction.
const world = makeRiverWorld([-120, 100]);

function tankAt(id: number, x: number, z: number, heading: number, faction: Faction = 'enemy', on: World = world): Tank {
  const tank = new Tank(id, faction === 'player' ? TANK_SPECS.player : TANK_SPECS.standard, faction);
  tank.placeAt(x, z, heading, on);
  tank.bridgeId = on.trackBridge(-1, x, z);
  return tank;
}

function freshPlanner(on: World = world, tanks: Tank[] = []): NavPlanner {
  const planner = new NavPlanner(on);
  planner.beginTick(tanks);
  return planner;
}

describe('NavPlanner.planLeg', () => {
  it('heads straight for a goal on the same bank', () => {
    const route = new Route();
    expect(freshPlanner().planLeg(tankAt(1, -100, 0, 0), -150, 80, route)).toBe(true);
    expect(route.bridgeId).toBe(-1);
    expect(route.xs[route.count - 1]).toBe(-150);
    expect(route.zs[route.count - 1]).toBe(80);
  });

  it('crosses by the nearer bridge, lining up on the approach and keeping right', () => {
    const route = new Route();
    expect(freshPlanner().planLeg(tankAt(1, -60, 90, Math.PI / 2), 60, 90, route)).toBe(true);
    const bridge = world.bridges[1]!;
    expect(route.bridgeId).toBe(1);
    expect(route.direction).toBe(1);
    expect(route.crossingStart).toBeGreaterThanOrEqual(0);
    expect(route.count - route.crossingStart).toBe(4);
    // Driving east, the right-hand lane is to the south (+z): wider on the approaches than on the deck.
    expect(route.zs[route.crossingStart]).toBeCloseTo(bridge.z + NAV.approachLaneOffset, 3);
    expect(route.zs[route.crossingStart + 1]).toBeCloseTo(bridge.z + NAV.laneOffset, 3);
    expect(route.zs[route.crossingStart + 2]).toBeCloseTo(bridge.z + NAV.laneOffset, 3);
    expect(route.zs[route.count - 1]).toBeCloseTo(bridge.z + NAV.approachLaneOffset, 3);
    expect(route.xs[route.crossingStart]).toBeLessThan(-bridge.halfLength);
    expect(route.xs[route.count - 1]).toBeGreaterThan(bridge.halfLength);
  });

  it('spreads a pack over two equally good bridges by personal preference', () => {
    const chosen = new Set<number>();
    for (let id = 1; id <= 12; id++) {
      const route = new Route();
      freshPlanner().planLeg(tankAt(id, -60, -10, Math.PI / 2), 60, -10, route);
      chosen.add(route.bridgeId);
    }
    expect([...chosen].sort()).toEqual([0, 1]);
  });

  it('finishes a crossing already under way in the direction the tank faces', () => {
    const route = new Route();
    const tank = tankAt(1, 5, 100, -Math.PI / 2);
    expect(tank.bridgeId).toBe(1);
    expect(freshPlanner().planLeg(tank, 200, 100, route)).toBe(true);
    expect(route.bridgeId).toBe(1);
    expect(route.direction).toBe(-1);
    expect(route.xs[route.count - 1]).toBeLessThan(-world.bridges[1]!.halfLength);
  });

  it('plans no leg when the goal bank cannot be reached', () => {
    const noBridges = makeRiverWorld([]);
    const route = new Route();
    expect(freshPlanner(noBridges).planLeg(tankAt(1, -60, 0, 0, 'enemy', noBridges), 60, 0, route)).toBe(false);
  });
});

describe('NavPlanner budget and right of way', () => {
  it('allows only a few searches per tick', () => {
    const planner = freshPlanner();
    const route = new Route();
    for (let n = 0; n < NAV.plansPerTick; n++) {
      expect(planner.canPlan()).toBe(true);
      planner.planLeg(tankAt(1, -100, 0, 0), -150, 80, route);
    }
    expect(planner.canPlan()).toBe(false);
    planner.beginTick([]);
    expect(planner.canPlan()).toBe(true);
    expect(planner.stats.maxPlansInTick).toBe(NAV.plansPerTick);
  });

  it('gives a bridge to enemy traffic already on it and lets traffic going the same way follow', () => {
    const planner = freshPlanner(world, [tankAt(5, 5, -120, -Math.PI / 2)]);
    expect(planner.claimCrossing(0, 1)).toBe(false);
    expect(planner.claimCrossing(0, -1)).toBe(true);
    expect(planner.claimCrossing(1, 1)).toBe(true);
  });

  it('never holds an enemy back for the player', () => {
    const planner = freshPlanner(world, [tankAt(0, 5, -120, -Math.PI / 2, 'player')]);
    expect(planner.claimCrossing(0, 1)).toBe(true);
  });

  it('lets the first claim in a tick win until the next tick', () => {
    const planner = freshPlanner();
    expect(planner.claimCrossing(1, 1)).toBe(true);
    expect(planner.claimCrossing(1, -1)).toBe(false);
    planner.beginTick([]);
    expect(planner.claimCrossing(1, -1)).toBe(true);
  });
});

describe('PathFollower', () => {
  it('lets the tank steer straight at a goal when no water is in the way', () => {
    const follower = new PathFollower();
    expect(follower.steer(tankAt(1, -100, 0, 0), -150, 80, freshPlanner(), true, 0, createWaypoint())).toBe(false);
  });

  it('leads the tank across the bridge, moving on as it passes each waypoint', () => {
    const follower = new PathFollower();
    const planner = freshPlanner();
    const tank = tankAt(1, -60, 90, Math.PI / 2);
    const wp = createWaypoint();
    expect(follower.steer(tank, 60, 90, planner, true, 0, wp)).toBe(true);
    const visited: number[] = [];
    for (let step = 0; step < 12 && follower.steer(tank, 60, 90, planner, false, 0, wp); step++) {
      visited.push(wp.x);
      tank.x = wp.x;
      tank.z = wp.z;
      tank.bridgeId = world.trackBridge(tank.bridgeId, tank.x, tank.z);
    }
    expect(visited.length).toBeGreaterThan(3);
    for (let k = 1; k < visited.length; k++) expect(visited[k]).toBeGreaterThanOrEqual(visited[k - 1]! - 1e-6);
    expect(visited[visited.length - 1]).toBeGreaterThan(world.bridges[1]!.halfLength);
  });

  it('holds the tank on the approach while oncoming traffic has the bridge', () => {
    const oncoming = tankAt(7, 10, 100, -Math.PI / 2);
    const planner = freshPlanner(world, [oncoming]);
    const follower = new PathFollower();
    const bridge = world.bridges[1]!;
    const tank = tankAt(1, -(bridge.halfLength + 20), 100 + NAV.approachLaneOffset, Math.PI / 2);
    const wp = createWaypoint();
    expect(follower.steer(tank, 60, 90, planner, true, 0, wp)).toBe(true);
    expect(wp.hold).toBe(true);
    planner.beginTick([]);
    follower.steer(tank, 60, 90, planner, false, 0, wp);
    expect(wp.hold).toBe(false);
  });
});

describe('NavPlanner fords', () => {
  // A bridge at z = 100 and a ford near z = -45 on the north-south river.
  const forded = makeFordWorld();
  const ford = forded.fords[0]!;

  it('wades across the ford when it is the better crossing, straight from bank to bank', () => {
    const route = new Route();
    const planner = freshPlanner(forded);
    expect(planner.planLeg(tankAt(1, -70, ford.z - 10, Math.PI / 2, 'enemy', forded), 70, ford.z - 10, route)).toBe(true);
    expect(route.bridgeId).toBe(-1);
    const last = route.count - 1;
    // The leg ends on the east bank, reached by a final stretch across the ford.
    expect(route.xs[last]).toBeGreaterThan(ford.halfWidth);
    expect(route.xs[last - 1]).toBeLessThan(-ford.halfWidth);
    expect(Math.abs(route.zs[last]! - ford.z)).toBeLessThan(1);
    expect(Math.abs(route.zs[last - 1]! - ford.z)).toBeLessThan(1);
  });

  it('still takes the bridge when that is nearer', () => {
    const route = new Route();
    expect(freshPlanner(forded).planLeg(tankAt(1, -60, 100, Math.PI / 2, 'enemy', forded), 60, 100, route)).toBe(true);
    expect(route.bridgeId).toBe(0);
  });

  it('carries on to the goal\'s bank from inside the ford, whichever way the tank faces', () => {
    for (const heading of [Math.PI / 2, -Math.PI / 2]) {
      const route = new Route();
      expect(freshPlanner(forded).planLeg(tankAt(1, ford.x - 3, ford.z, heading, 'enemy', forded), 80, ford.z, route)).toBe(true);
      expect(route.count).toBe(1);
      expect(route.xs[0]).toBeGreaterThan(ford.halfWidth);
    }
  });

  it('carries on the way it faces from inside the ford when the goal is on neither bank', () => {
    const route = new Route();
    expect(freshPlanner(forded).planLeg(tankAt(1, ford.x + 2, ford.z, -Math.PI / 2, 'enemy', forded), ford.x, ford.z + 300, route)).toBe(true);
    expect(route.count).toBe(1);
    expect(route.xs[0]).toBeLessThan(-ford.halfWidth);
  });
});
