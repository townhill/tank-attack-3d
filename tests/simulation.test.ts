import { describe, expect, it } from 'vitest';
import { SIM_DT } from '../src/config/settings';
import { createPlayerCommand, Simulation } from '../src/game/Simulation';
import type { GameEvent } from '../src/game/events';

function run(sim: Simulation, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  const cmd = createPlayerCommand();
  const ticks = Math.round(seconds / SIM_DT);
  for (let i = 0; i < ticks; i++) {
    sim.step(SIM_DT, cmd);
    events.push(...sim.events);
    sim.clearEvents();
  }
  return events;
}

describe('Simulation', () => {
  it('starts the first wave and spawns enemies away from the player', () => {
    const sim = new Simulation({ seed: 1234, difficulty: 'normal', firstWaveDelay: 1 });
    const events = run(sim, 4);
    expect(events.some((e) => e.type === 'waveStart')).toBe(true);
    const spawns = events.filter((e) => e.type === 'enemySpawned');
    expect(spawns.length).toBeGreaterThan(0);
    for (const s of spawns) {
      expect(Math.hypot(s.x, s.z)).toBeGreaterThan(150);
    }
  });

  it('keeps every tank inside the playable area and on the ground', () => {
    const sim = new Simulation({ seed: 77, difficulty: 'hard', firstWaveDelay: 0.5 });
    run(sim, 40);
    for (const t of sim.tanks) {
      expect(Math.abs(t.x)).toBeLessThanOrEqual(sim.world.playableHalfSize);
      expect(Math.abs(t.z)).toBeLessThanOrEqual(sim.world.playableHalfSize);
      expect(t.y).toBeGreaterThanOrEqual(sim.world.heightAt(t.x, t.z) - 1e-6);
      expect(t.up.y).toBeGreaterThan(0.8);
    }
  });

  it('builds a bigger battlefield for the large map size and keeps tanks inside it', () => {
    const sim = new Simulation({ seed: 77, difficulty: 'hard', firstWaveDelay: 0.5, mapSize: 'large' });
    expect(sim.world.playableHalfSize).toBe(1000);
    run(sim, 20);
    expect(sim.enemies.length).toBeGreaterThan(0);
    for (const t of sim.tanks) {
      expect(Math.abs(t.x)).toBeLessThanOrEqual(sim.world.playableHalfSize);
      expect(Math.abs(t.z)).toBeLessThanOrEqual(sim.world.playableHalfSize);
    }
  });

  it('uses the standard battlefield when no map size is given', () => {
    const sim = new Simulation({ seed: 77, difficulty: 'normal', firstWaveDelay: 999 });
    expect(sim.world.playableHalfSize).toBe(500);
  });

  it('enemies engage and damage a stationary player', () => {
    const sim = new Simulation({ seed: 99, difficulty: 'hard', firstWaveDelay: 0.5 });
    const events = run(sim, 120);
    expect(events.some((e) => e.type === 'fire' && e.faction === 'enemy')).toBe(true);
    expect(sim.stats.damageTaken).toBeGreaterThan(0);
  });

  it('player shots destroy an enemy placed in front of the gun', () => {
    const sim = new Simulation({ seed: 5, difficulty: 'normal', firstWaveDelay: 999 });
    expect(sim.spawnEnemy('scout')).toBe(true);
    const enemy = sim.enemies[0]!.tank;
    const cmd = createPlayerCommand();
    let destroyed = false;
    for (let i = 0; i < 60 * 20 && !destroyed; i++) {
      // Hold the enemy in place and aim straight at it.
      enemy.placeAt(0, -60, 0, sim.world.terrain);
      cmd.aimX = enemy.x - sim.player.x;
      cmd.aimY = enemy.y + 1.2 - (sim.player.y + 2.6);
      cmd.aimZ = enemy.z - sim.player.z;
      cmd.fire = true;
      sim.step(SIM_DT, cmd);
      destroyed = sim.events.some((e) => e.type === 'tankDestroyed' && e.byPlayer);
      sim.clearEvents();
    }
    expect(destroyed).toBe(true);
    expect(sim.stats.kills).toBe(1);
    expect(sim.stats.score).toBeGreaterThan(0);
    expect(sim.stats.hits).toBeGreaterThan(0);
    expect(sim.stats.shotsFired).toBeGreaterThanOrEqual(sim.stats.hits);
  });

  it('ends the game a few seconds after the player is destroyed', () => {
    const sim = new Simulation({ seed: 3, difficulty: 'normal', firstWaveDelay: 999 });
    expect(sim.spawnEnemy('heavy')).toBe(true);
    const enemy = sim.enemies[0]!.tank;
    enemy.placeAt(0, -40, Math.PI, sim.world.terrain);
    sim.player.health = 1;
    const events = run(sim, 30);
    expect(sim.player.alive).toBe(false);
    expect(sim.phase).toBe('over');
    expect(events.some((e) => e.type === 'gameOver')).toBe(true);
  });

  it('is deterministic for a given seed and input', () => {
    const a = new Simulation({ seed: 42, difficulty: 'normal', firstWaveDelay: 0.5 });
    const b = new Simulation({ seed: 42, difficulty: 'normal', firstWaveDelay: 0.5 });
    run(a, 20);
    run(b, 20);
    expect(a.tanks.map((t) => [t.x, t.z, t.health])).toEqual(b.tanks.map((t) => [t.x, t.z, t.health]));
  });
});
