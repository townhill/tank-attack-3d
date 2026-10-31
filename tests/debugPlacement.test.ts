import { describe, expect, it } from 'vitest';
import { bridgeApproach, fordApproach } from '../src/game/debugPlacement';
import type { Ford } from '../src/world/Water';
import { World } from '../src/world/World';
import { makeRiverWorld } from './waterFixtures';

/** The fixture's river world (flowing north to south through x = 0, bridged at z = 0) with fords added. */
function withFords(fords: Ford[]): World {
  const w = makeRiverWorld();
  return new World(w.seed, w.terrain, w.obstacles, w.playableHalfSize, { water: w.water, rivers: w.rivers, lakes: w.lakes, bridges: w.bridges, fords });
}

function ford(id: number, z: number): Ford {
  return { id, riverId: 0, x: 0, z, s: z + 300, tx: 0, tz: 1, halfWidth: 14, halfLength: 10, depth: 0.6 };
}

/** Unit forward direction of a tank with compass heading `h`. */
function forward(h: number): [number, number] {
  return [Math.sin(h), -Math.cos(h)];
}

describe('bridgeApproach', () => {
  it('stands back from the nearest deck end on the bridge axis, facing the bridge', () => {
    const world = makeRiverWorld([-120, 120]);
    const spot = bridgeApproach(world, 10, 100);
    const b = world.bridges[1]!;
    expect(spot).not.toBeNull();
    const dx = b.x - spot!.x;
    const dz = b.z - spot!.z;
    expect(Math.hypot(dx, dz)).toBeCloseTo(b.halfLength + 20);
    const [fx, fz] = forward(spot!.heading);
    expect((fx * dx + fz * dz) / Math.hypot(dx, dz)).toBeCloseTo(1);
  });

  it('finds nothing on a battlefield without bridges', () => {
    expect(bridgeApproach(makeRiverWorld([]), 0, 0)).toBeNull();
  });
});

describe('fordApproach', () => {
  it('stands on the bank beside the nearest ford, facing across the river', () => {
    const world = withFords([ford(0, -150), ford(1, 150)]);
    const spot = fordApproach(world, 0, 120);
    expect(spot).not.toBeNull();
    expect(spot!.z).toBeCloseTo(150);
    expect(Math.abs(spot!.x)).toBeCloseTo(14 + 20);
    const [fx, fz] = forward(spot!.heading);
    // Facing the ford, square across the flow.
    expect(fx * -Math.sign(spot!.x)).toBeCloseTo(1);
    expect(fz).toBeCloseTo(0);
  });

  it('finds nothing on a battlefield without fords', () => {
    expect(fordApproach(makeRiverWorld(), 0, 0)).toBeNull();
  });
});
