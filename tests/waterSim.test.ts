import { describe, expect, it } from 'vitest';
import { SIM_DT, TANK_SPECS } from '../src/config/settings';
import { createProjectileHit, stepProjectile } from '../src/combat/WeaponSystem';
import { Projectile } from '../src/entities/Projectile';
import type { Tank } from '../src/entities/Tank';
import type { GameEvent } from '../src/game/events';
import { createPlayerCommand, Simulation } from '../src/game/Simulation';
import { createBridgeLocal, deckHeightAt, toBridgeLocal } from '../src/world/Bridge';
import { makeRiverWorld } from './waterFixtures';

/** A simulation on the small river world with no enemy waves. */
function riverSim(): Simulation {
  return new Simulation({ seed: 9, difficulty: 'normal', world: makeRiverWorld(), firstWaveDelay: Number.POSITIVE_INFINITY });
}

/** Drives the player with fixed controls for `seconds`, calling `onTick` after every step. */
function drive(sim: Simulation, seconds: number, throttle: number, onTick: (tank: Tank) => void = () => undefined): void {
  const cmd = createPlayerCommand();
  cmd.throttle = throttle;
  const ticks = Math.round(seconds / SIM_DT);
  for (let i = 0; i < ticks; i++) {
    sim.step(SIM_DT, cmd);
    sim.clearEvents();
    onTick(sim.player);
  }
}

describe('Tanks and deep water', () => {
  it('stops a tank driven straight at the river at the water edge', () => {
    const sim = riverSim();
    const radius = TANK_SPECS.player.collisionRadius;
    sim.player.placeAt(-60, 100, Math.PI / 2, sim.world);
    let closest = Infinity;
    drive(sim, 8, 1, (t) => {
      closest = Math.min(closest, sim.world.water.blockedDistance(t.x, t.z));
    });
    expect(closest).toBeGreaterThan(radius - 0.3);
    expect(sim.player.x).toBeLessThan(-8);
    expect(sim.player.x).toBeGreaterThan(-16);
    expect(sim.player.bridgeId).toBe(-1);
  });

  it('slows a tank wading through the shallows along the bank', () => {
    const dry = riverSim();
    dry.player.placeAt(-60, -150, 0, dry.world);
    drive(dry, 4, 1);
    const wading = riverSim();
    wading.player.placeAt(-11.5, -150, 0, wading.world);
    drive(wading, 4, 1);
    expect(wading.world.water.depthAt(wading.player.x, wading.player.z)).toBeGreaterThan(0);
    expect(wading.player.speed).toBeLessThan(dry.player.speed - 1);
    expect(wading.player.speed).toBeGreaterThan(dry.player.speed * 0.7);
  });
});

describe('Tanks on bridges', () => {
  const local = createBridgeLocal();

  it('carries a tank across the bridge on the road surface without dropping it', () => {
    const sim = riverSim();
    const bridge = sim.world.bridges[0]!;
    sim.player.placeAt(-60, 0, Math.PI / 2, sim.world);
    let ticksOverWater = 0;
    let fastest = 0;
    drive(sim, 9, 1, (t) => {
      fastest = Math.max(fastest, t.speed);
      toBridgeLocal(bridge, t.x, t.z, local);
      if (Math.abs(local.along) >= bridge.halfSpan) return;
      ticksOverWater++;
      expect(t.bridgeId).toBe(0);
      expect(Math.abs(t.y - deckHeightAt(bridge, local.along))).toBeLessThan(0.01);
    });
    expect(ticksOverWater).toBeGreaterThan(60);
    expect(sim.player.x).toBeGreaterThan(bridge.halfLength + 10);
    expect(sim.player.bridgeId).toBe(-1);
    expect(fastest).toBeGreaterThan(TANK_SPECS.player.maxSpeed * 0.95);
  });

  it('keeps a tank that drives onto the deck off-centre between the kerbs', () => {
    const sim = riverSim();
    const bridge = sim.world.bridges[0]!;
    const radius = TANK_SPECS.player.collisionRadius;
    sim.player.placeAt(-45, 5.5, Math.PI / 2, sim.world);
    let ticksOverWater = 0;
    drive(sim, 8, 1, (t) => {
      toBridgeLocal(bridge, t.x, t.z, local);
      if (Math.abs(local.along) >= bridge.halfSpan) return;
      ticksOverWater++;
      expect(Math.abs(local.lateral)).toBeLessThanOrEqual(bridge.halfWidth - radius + 1e-6);
      expect(Math.abs(t.y - deckHeightAt(bridge, local.along))).toBeLessThan(0.01);
    });
    expect(ticksOverWater).toBeGreaterThan(30);
    expect(sim.player.x).toBeGreaterThan(bridge.halfSpan);
  });
});

describe('Tanks beside bridges', () => {
  it('a tank crossing the road beside a deck end slides along the parapet and never pops up onto the deck', () => {
    const sim = riverSim();
    const bridge = sim.world.bridges[0]!;
    const radius = TANK_SPECS.player.collisionRadius;
    const local = createBridgeLocal();
    // Heading north across the deck's west end, where it rests on the bank.
    sim.player.placeAt(-24, 30, 0, sim.world);
    let previousY = sim.player.y;
    let biggestStep = 0;
    drive(sim, 4, 1, (t) => {
      biggestStep = Math.max(biggestStep, Math.abs(t.y - previousY));
      previousY = t.y;
      expect(t.bridgeId).toBe(-1);
      toBridgeLocal(bridge, t.x, t.z, local);
      if (Math.abs(local.along) <= bridge.halfLength) {
        expect(Math.abs(local.lateral)).toBeGreaterThan(bridge.halfWidth + radius);
      }
    });
    expect(biggestStep).toBeLessThan(0.15);
    expect(sim.player.z).toBeGreaterThan(0);
  });
});

describe('Shells and water', () => {
  it('a shell that lands in the river stops at the surface as a water impact', () => {
    const world = makeRiverWorld();
    const shell = new Projectile(0);
    shell.active = true;
    shell.ownerId = 99;
    shell.x = -40;
    shell.y = 4;
    shell.z = 60;
    shell.vx = 200;
    shell.vy = -30;
    shell.vz = 0;
    const hit = createProjectileHit();
    let stopped = false;
    for (let i = 0; i < 120 && !stopped; i++) stopped = stepProjectile(shell, SIM_DT, world, [], hit);
    expect(stopped).toBe(true);
    expect(hit.surface).toBe('water');
    expect(hit.y).toBeCloseTo(-2, 1);
    expect(Math.abs(hit.x)).toBeLessThan(14);
  });

  it('a shell that lands on the deck is a bridge impact', () => {
    const world = makeRiverWorld();
    const shell = new Projectile(0);
    shell.active = true;
    shell.x = 0;
    shell.y = 30;
    shell.z = 1;
    shell.vy = -150;
    const hit = createProjectileHit();
    let stopped = false;
    for (let i = 0; i < 60 && !stopped; i++) stopped = stepProjectile(shell, SIM_DT, world, [], hit);
    expect(hit.surface).toBe('bridge');
  });
});

describe('Water during a generated battle', () => {
  const sim = new Simulation({ seed: 1234, difficulty: 'hard', firstWaveDelay: 0.5 });
  const events: GameEvent[] = [];
  let closest = Infinity;
  const cmd = createPlayerCommand();
  for (let i = 0; i < Math.round(90 / SIM_DT); i++) {
    sim.step(SIM_DT, cmd);
    events.push(...sim.events);
    sim.clearEvents();
    for (const t of sim.tanks) {
      if (t.bridgeId >= 0) continue;
      closest = Math.min(closest, sim.world.water.blockedDistance(t.x, t.z) - t.spec.collisionRadius);
    }
  }

  it('generates water on the battlefield', () => {
    expect(sim.world.rivers.length + sim.world.lakes.length).toBeGreaterThan(0);
  });

  it('never lets a tank off a bridge into water too deep to wade', () => {
    expect(closest).toBeGreaterThan(-0.5);
  });

  it('spawns enemies only on dry ground connected to the player', () => {
    const spawns = events.filter((e) => e.type === 'enemySpawned');
    expect(spawns.length).toBeGreaterThan(0);
    const nav = sim.world.nav;
    const home = nav.regionAt(0, 0);
    for (const s of spawns) {
      expect(sim.world.water.depthAt(s.x, s.z)).toBe(0);
      expect(sim.world.water.blockedDistance(s.x, s.z)).toBeGreaterThan(TANK_SPECS.heavy.collisionRadius);
      expect(nav.regionAt(s.x, s.z)).toBe(home);
    }
  });
});
