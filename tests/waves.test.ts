import { describe, expect, it } from 'vitest';
import { DIFFICULTY, WAVES } from '../src/config/settings';
import type { DifficultySpec, EnemyKind } from '../src/config/settings';
import {
  aimErrorScale,
  maxConcurrentEnemies,
  WaveManager,
  waveComposition,
  waveEnemyCount,
} from '../src/game/WaveManager';
import type { WaveUpdate } from '../src/game/WaveManager';
import { Random } from '../src/utils/random';

const countKinds = (kinds: readonly EnemyKind[]): Record<EnemyKind, number> => ({
  standard: kinds.filter((k) => k === 'standard').length,
  heavy: kinds.filter((k) => k === 'heavy').length,
  scout: kinds.filter((k) => k === 'scout').length,
});

/** WaveManager reuses one result object, so tests must copy it before the next update. */
function snapshot(update: WaveUpdate): WaveUpdate {
  return { startedWave: update.startedWave, clearedWave: update.clearedWave, spawn: update.spawn };
}

describe('waveEnemyCount', () => {
  it('starts at the base count and grows by enemiesPerWave', () => {
    expect(waveEnemyCount(1)).toBe(WAVES.baseEnemyCount);
    expect(waveEnemyCount(2)).toBe(WAVES.baseEnemyCount + WAVES.enemiesPerWave);
    expect(waveEnemyCount(5)).toBe(WAVES.baseEnemyCount + 4 * WAVES.enemiesPerWave);
  });

  it('never exceeds the per-wave cap', () => {
    expect(waveEnemyCount(11)).toBe(23);
    expect(waveEnemyCount(12)).toBe(WAVES.maxEnemiesPerWave);
    expect(waveEnemyCount(500)).toBe(WAVES.maxEnemiesPerWave);
  });

  it('is monotonic and treats wave 0 like wave 1', () => {
    expect(waveEnemyCount(0)).toBe(waveEnemyCount(1));
    for (let wave = 1; wave < 40; wave++) expect(waveEnemyCount(wave + 1)).toBeGreaterThanOrEqual(waveEnemyCount(wave));
  });
});

describe('waveComposition', () => {
  it('wave 1 contains standard tanks only', () => {
    const kinds = waveComposition(1, new Random(1));
    expect(countKinds(kinds)).toEqual({ standard: 3, heavy: 0, scout: 0 });
  });

  it('introduces heavies from wave 2 but no scouts yet', () => {
    const counts = countKinds(waveComposition(2, new Random(1)));
    expect(counts.heavy).toBeGreaterThanOrEqual(1);
    expect(counts.scout).toBe(0);
    expect(counts.standard).toBeGreaterThan(0);
  });

  it('introduces scouts from wave 3', () => {
    const counts = countKinds(waveComposition(3, new Random(1)));
    expect(counts.scout).toBeGreaterThanOrEqual(1);
    expect(counts.heavy).toBeGreaterThanOrEqual(1);
  });

  it('always totals the wave enemy count with no negative groups', () => {
    for (let wave = 1; wave <= 40; wave++) {
      const kinds = waveComposition(wave, new Random(wave));
      const counts = countKinds(kinds);
      expect(kinds).toHaveLength(waveEnemyCount(wave));
      expect(counts.standard).toBeGreaterThanOrEqual(0);
      expect(counts.standard + counts.heavy + counts.scout).toBe(waveEnemyCount(wave));
    }
  });

  it('caps the heavy and scout shares', () => {
    const counts = countKinds(waveComposition(30, new Random(1)));
    expect(counts.heavy).toBe(Math.round(WAVES.maxEnemiesPerWave * WAVES.heavyShareMax));
    expect(counts.scout).toBe(Math.round(WAVES.maxEnemiesPerWave * WAVES.scoutShareMax));
    expect(counts.standard).toBeGreaterThan(0);
  });

  it('is deterministic for a seeded Random', () => {
    expect(waveComposition(8, new Random(55))).toEqual(waveComposition(8, new Random(55)));
  });

  it('keeps the same mix regardless of seed, only the order changes', () => {
    const a = waveComposition(10, new Random(1));
    const b = waveComposition(10, new Random(2));
    expect(countKinds(a)).toEqual(countKinds(b));
    expect(a).not.toEqual(b);
  });
});

describe('maxConcurrentEnemies', () => {
  it('starts at the difficulty base', () => {
    expect(maxConcurrentEnemies(1, DIFFICULTY.normal)).toBe(DIFFICULTY.normal.maxConcurrentEnemies);
    expect(maxConcurrentEnemies(0, DIFFICULTY.normal)).toBe(DIFFICULTY.normal.maxConcurrentEnemies);
  });

  it('grows by one every concurrencyStepWaves waves', () => {
    const base = DIFFICULTY.normal.maxConcurrentEnemies;
    const step = WAVES.concurrencyStepWaves;
    expect(maxConcurrentEnemies(step, DIFFICULTY.normal)).toBe(base);
    expect(maxConcurrentEnemies(step + 1, DIFFICULTY.normal)).toBe(base + 1);
    expect(maxConcurrentEnemies(2 * step, DIFFICULTY.normal)).toBe(base + 1);
    expect(maxConcurrentEnemies(2 * step + 1, DIFFICULTY.normal)).toBe(base + 2);
  });

  it('is higher on harder difficulties', () => {
    expect(maxConcurrentEnemies(5, DIFFICULTY.hard)).toBeGreaterThan(maxConcurrentEnemies(5, DIFFICULTY.normal));
    expect(maxConcurrentEnemies(5, DIFFICULTY.normal)).toBeGreaterThan(maxConcurrentEnemies(5, DIFFICULTY.easy));
  });
});

describe('aimErrorScale', () => {
  it('starts at 1 and decreases each wave', () => {
    expect(aimErrorScale(1)).toBe(1);
    expect(aimErrorScale(0)).toBe(1);
    expect(aimErrorScale(2)).toBeCloseTo(1 - WAVES.aimImprovementPerWave, 12);
    for (let wave = 1; wave < 10; wave++) expect(aimErrorScale(wave + 1)).toBeLessThan(aimErrorScale(wave));
  });

  it('floors at minAimErrorFactor', () => {
    expect(aimErrorScale(13)).toBe(WAVES.minAimErrorFactor);
    expect(aimErrorScale(200)).toBe(WAVES.minAimErrorFactor);
    for (let wave = 1; wave < 60; wave++) expect(aimErrorScale(wave)).toBeGreaterThanOrEqual(WAVES.minAimErrorFactor);
  });
});

describe('WaveManager', () => {
  const normal = DIFFICULTY.normal;

  it('starts in intermission with the first-wave countdown', () => {
    const manager = new WaveManager(normal, new Random(1), 2);
    expect(manager.phase).toBe('intermission');
    expect(manager.wave).toBe(0);
    expect(manager.timer).toBe(2);
    expect(manager.remainingToSpawn).toBe(0);
  });

  it('defaults the first wave delay to 3 seconds', () => {
    expect(new WaveManager(normal, new Random(1)).timer).toBe(3);
  });

  it('counts the intermission down and starts wave 1 when it expires', () => {
    const manager = new WaveManager(normal, new Random(1), 1);
    expect(snapshot(manager.update(0.5, 0))).toEqual({ startedWave: null, clearedWave: null, spawn: null });
    expect(manager.wave).toBe(0);
    const started = snapshot(manager.update(0.6, 0));
    expect(started.startedWave).toBe(1);
    expect(manager.wave).toBe(1);
    expect(manager.phase).toBe('active');
    expect(manager.remainingToSpawn).toBe(waveEnemyCount(1));
  });

  it('does not spawn on the same tick the wave starts', () => {
    const manager = new WaveManager(normal, new Random(1), 0.1);
    const started = snapshot(manager.update(0.2, 0));
    expect(started.startedWave).toBe(1);
    expect(started.spawn).toBeNull();
  });

  it('spawns the queued composition in order', () => {
    const manager = new WaveManager(normal, new Random(9), 0.1);
    manager.update(0.2, 0);
    const expected = waveComposition(1, new Random(9));
    const spawned: EnemyKind[] = [];
    let alive = 0;
    for (let i = 0; i < 2000 && spawned.length < expected.length; i++) {
      const update = manager.update(0.1, alive);
      if (update.spawn) {
        spawned.push(update.spawn);
        alive++;
      }
    }
    expect(spawned).toEqual(expected);
    expect(manager.remainingToSpawn).toBe(0);
  });

  it('follows a quick burst when the field is empty, then the normal spawn interval', () => {
    const manager = new WaveManager(normal, new Random(1), 0.1);
    manager.update(0.2, 0);
    expect(manager.update(0.01, 0).spawn).not.toBeNull(); // first spawn with an empty field
    // Burst interval (0.8 s) because only one enemy will be alive.
    expect(manager.update(0.5, 1).spawn).toBeNull();
    expect(manager.update(0.31, 1).spawn).not.toBeNull();
    // That second spawn leaves two alive, so the longer interval now applies before the third.
    expect(manager.update(normal.spawnInterval - 0.5, 2).spawn).toBeNull();
    expect(manager.update(0.6, 2).spawn).not.toBeNull();
    expect(manager.remainingToSpawn).toBe(0);
  });

  it('respects the concurrency limit', () => {
    const limited: DifficultySpec = { ...normal, maxConcurrentEnemies: 1, spawnInterval: 0.5 };
    const manager = new WaveManager(limited, new Random(1), 0.1);
    manager.update(0.2, 0);
    for (let i = 0; i < 100; i++) expect(manager.update(0.5, 1).spawn).toBeNull();
    expect(manager.remainingToSpawn).toBe(waveEnemyCount(1));
    expect(manager.update(0.5, 0).spawn).not.toBeNull();
  });

  it('does not clear the wave while enemies are queued or alive', () => {
    const manager = new WaveManager(normal, new Random(1), 0.1);
    manager.update(0.2, 0);
    expect(snapshot(manager.update(0.01, 0)).spawn).not.toBeNull();
    expect(snapshot(manager.update(0.01, 0)).clearedWave).toBeNull(); // still queued
    // Drain the queue, then keep one enemy alive.
    for (let i = 0; i < 200; i++) manager.update(1, 1);
    expect(manager.remainingToSpawn).toBe(0);
    expect(snapshot(manager.update(1, 1)).clearedWave).toBeNull();
    expect(manager.phase).toBe('active');
  });

  it('clears the wave when the queue is empty and nothing is alive, then runs the intermission', () => {
    const manager = new WaveManager(normal, new Random(1), 0.1);
    manager.update(0.2, 0);
    let alive = 0;
    for (let i = 0; i < 400 && manager.remainingToSpawn > 0; i++) {
      if (manager.update(0.5, alive).spawn) alive++;
    }
    expect(manager.remainingToSpawn).toBe(0);

    const cleared = snapshot(manager.update(0.1, 0));
    expect(cleared.clearedWave).toBe(1);
    expect(manager.phase).toBe('intermission');
    expect(manager.timer).toBe(WAVES.intermission);

    // The intermission timer runs down and wave 2 begins with a bigger queue.
    expect(snapshot(manager.update(WAVES.intermission - 0.1, 0)).startedWave).toBeNull();
    const second = snapshot(manager.update(0.2, 0));
    expect(second.startedWave).toBe(2);
    expect(manager.wave).toBe(2);
    expect(manager.remainingToSpawn).toBe(waveEnemyCount(2));
  });

  it('only reports clearedWave once per wave', () => {
    const manager = new WaveManager(normal, new Random(1), 0.1);
    manager.update(0.2, 0);
    let alive = 0;
    let cleared = 0;
    for (let i = 0; i < 600; i++) {
      const update = manager.update(0.1, alive);
      if (update.spawn) alive++;
      if (update.clearedWave !== null) cleared++;
      if (manager.phase === 'active' && manager.remainingToSpawn === 0) alive = 0;
      if (manager.wave > 1) break;
    }
    expect(cleared).toBe(1);
  });

  it('requeue puts a kind back at the front of the queue', () => {
    const manager = new WaveManager(normal, new Random(3), 0.1);
    manager.update(0.2, 0);
    const first = manager.update(0.01, 0).spawn!;
    const remaining = manager.remainingToSpawn;
    manager.requeue(first);
    expect(manager.remainingToSpawn).toBe(remaining + 1);
    // The retry waits half a second, then hands back the same kind.
    expect(manager.update(0.4, 0).spawn).toBeNull();
    expect(manager.update(0.2, 0).spawn).toBe(first);
  });

  it('requeue places an arbitrary kind first, ahead of the rest of the queue', () => {
    const manager = new WaveManager(normal, new Random(3), 0.1);
    manager.update(0.2, 0);
    manager.requeue('heavy');
    expect(manager.update(0.6, 0).spawn).toBe('heavy');
  });
});
