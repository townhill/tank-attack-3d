import { describe, expect, it } from 'vitest';
import type { MapSize, TerrainType } from '../src/config/settings';
import { AI, SIM_DT } from '../src/config/settings';
import { createPlayerCommand, Simulation } from '../src/game/Simulation';

/** Enemies counted are those that spawn this early, so each has time to close in (s). */
const COUNTED_SPAWN_WINDOW = 15;
/** Time each counted enemy has to close in, from its spawn (s). */
const CLOSE_IN_TIME = 75;
/** Closing in: within an enemy's preferred range plus this (metres). */
const CLOSE_IN_SLACK = 50;
/** An enemy that never gets this far from where it spawned has been stuck the whole time (metres). */
const STUCK_DISTANCE = 20;
/** Gunfire alerts are repeated this often, as if the player kept firing (ticks). */
const ALERT_TICKS = 300;
/** Hilly's closing-in share may fall at most this far below Gentle's on the same seed. */
const MAX_SHORTFALL = 0.1;
const SIZES: readonly (readonly [MapSize, number])[] = [['standard', 101], ['large', 201], ['huge', 301]];
/** Generating and simulating a Huge battlefield takes a while, longer under coverage (ms). */
const BATTLE_TIMEOUT = 120_000;

interface ClosingIn {
  readonly counted: number;
  readonly closedIn: number;
  readonly stuck: number;
}

interface Tracked {
  readonly spawnTick: number;
  readonly x: number;
  readonly z: number;
  closedIn: boolean;
  moved: boolean;
}

/**
 * Runs the first wave with the player waiting at the spawn point, kept alive,
 * and alerting every enemy to its position every five seconds.
 */
function closingIn(terrain: TerrainType, mapSize: MapSize, seed: number): ClosingIn {
  const sim = new Simulation({ seed, difficulty: 'normal', mapSize, terrain, firstWaveDelay: 0.5 });
  const cmd = createPlayerCommand();
  const tracked = new Map<number, Tracked>();
  const ticks = Math.round((COUNTED_SPAWN_WINDOW + CLOSE_IN_TIME) / SIM_DT);
  for (let i = 0; i < ticks; i++) {
    const p = sim.player;
    p.health = p.spec.maxHealth;
    if (i % ALERT_TICKS === 0) for (const e of sim.enemies) e.controller.notifyGunfire(p.x, p.z);
    sim.step(SIM_DT, cmd);
    sim.clearEvents();
    for (const e of sim.enemies) {
      const t = e.tank;
      let entry = tracked.get(t.id);
      if (!entry) {
        if (i * SIM_DT > COUNTED_SPAWN_WINDOW) continue;
        entry = { spawnTick: i, x: t.x, z: t.z, closedIn: false, moved: false };
        tracked.set(t.id, entry);
      }
      if ((i - entry.spawnTick) * SIM_DT > CLOSE_IN_TIME) continue;
      if (Math.hypot(t.x - p.x, t.z - p.z) <= AI.preferredRange[e.kind] + CLOSE_IN_SLACK) entry.closedIn = true;
      if (Math.hypot(t.x - entry.x, t.z - entry.z) > STUCK_DISTANCE) entry.moved = true;
    }
  }
  const entries = [...tracked.values()];
  return {
    counted: entries.length,
    closedIn: entries.filter((e) => e.closedIn).length,
    stuck: entries.filter((e) => !e.moved).length,
  };
}

describe('Enemies on Hilly battlefields', () => {
  for (const [size, seed] of SIZES) {
    it(`close in on the player as reliably as on Gentle at ${size} size`, () => {
      const gentle = closingIn('gentle', size, seed);
      const hilly = closingIn('hilly', size, seed);
      expect(hilly.counted).toBeGreaterThan(0);
      expect(hilly.stuck).toBe(0);
      expect(hilly.closedIn / hilly.counted).toBeGreaterThanOrEqual(gentle.closedIn / gentle.counted - MAX_SHORTFALL);
    }, BATTLE_TIMEOUT);
  }
});
