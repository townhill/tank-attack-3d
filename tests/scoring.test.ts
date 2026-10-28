import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { DIFFICULTY, TANK_SPECS, WAVES } from '../src/config/settings';
import type { Difficulty, EnemyKind } from '../src/config/settings';
import {
  accuracy,
  BestScoreStore,
  createStats,
  formatTime,
  killScore,
  waveClearBonus,
} from '../src/game/Scoring';
import type { KeyValueStore } from '../src/game/Scoring';

const STORAGE_KEY = 'vectorTanks.bestScore';

class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('killScore', () => {
  it('awards the base score for each enemy kind in wave 1 on normal difficulty', () => {
    expect(killScore('standard', 1, 'normal')).toBe(TANK_SPECS.standard.scoreValue);
    expect(killScore('heavy', 1, 'normal')).toBe(TANK_SPECS.heavy.scoreValue);
    expect(killScore('scout', 1, 'normal')).toBe(TANK_SPECS.scout.scoreValue);
  });

  it('ranks heavy above scout above standard', () => {
    expect(killScore('heavy', 1, 'normal')).toBeGreaterThan(killScore('scout', 1, 'normal'));
    expect(killScore('scout', 1, 'normal')).toBeGreaterThan(killScore('standard', 1, 'normal'));
  });

  it('grows by waveScoreStep per wave after the first', () => {
    expect(killScore('standard', 3, 'normal')).toBe(Math.round(100 * (1 + 2 * WAVES.waveScoreStep)));
    expect(killScore('standard', 11, 'normal')).toBe(Math.round(100 * (1 + 10 * WAVES.waveScoreStep)));
  });

  it('scales with the difficulty multiplier', () => {
    expect(killScore('standard', 1, 'easy')).toBe(Math.round(100 * DIFFICULTY.easy.scoreMultiplier));
    expect(killScore('standard', 1, 'hard')).toBe(Math.round(100 * DIFFICULTY.hard.scoreMultiplier));
    expect(killScore('standard', 1, 'hard')).toBeGreaterThan(killScore('standard', 1, 'normal'));
    expect(killScore('standard', 1, 'normal')).toBeGreaterThan(killScore('standard', 1, 'easy'));
  });

  it('combines wave and difficulty scaling and rounds to a whole number', () => {
    // 150 * 1.2 * 1.5 = 270
    expect(killScore('scout', 3, 'hard')).toBe(270);
    // 250 * 1.1 * 0.75 = 206.25
    expect(killScore('heavy', 2, 'easy')).toBe(206);
  });

  it('treats wave 0 or negative waves like wave 1', () => {
    expect(killScore('standard', 0, 'normal')).toBe(killScore('standard', 1, 'normal'));
    expect(killScore('standard', -5, 'normal')).toBe(killScore('standard', 1, 'normal'));
  });

  it.each<[EnemyKind, Difficulty]>([
    ['standard', 'easy'],
    ['heavy', 'normal'],
    ['scout', 'hard'],
  ])('is a positive integer for %s on %s', (kind, difficulty) => {
    for (let wave = 1; wave <= 20; wave++) {
      const score = killScore(kind, wave, difficulty);
      expect(Number.isInteger(score)).toBe(true);
      expect(score).toBeGreaterThan(0);
    }
  });
});

describe('waveClearBonus', () => {
  it('is the base bonus times the wave number on normal difficulty', () => {
    expect(waveClearBonus(1, 'normal')).toBe(WAVES.waveClearBonus);
    expect(waveClearBonus(3, 'normal')).toBe(WAVES.waveClearBonus * 3);
  });

  it('scales with difficulty', () => {
    expect(waveClearBonus(2, 'hard')).toBe(Math.round(WAVES.waveClearBonus * 2 * DIFFICULTY.hard.scoreMultiplier));
    expect(waveClearBonus(1, 'easy')).toBe(Math.round(WAVES.waveClearBonus * DIFFICULTY.easy.scoreMultiplier));
  });
});

describe('accuracy', () => {
  it('is 0 when nothing has been fired', () => {
    expect(accuracy(0, 0)).toBe(0);
    expect(accuracy(0, 5)).toBe(0);
    expect(accuracy(-3, 1)).toBe(0);
  });

  it('is the hit ratio otherwise', () => {
    expect(accuracy(10, 5)).toBe(0.5);
    expect(accuracy(4, 1)).toBe(0.25);
    expect(accuracy(7, 0)).toBe(0);
  });

  it('is capped at 1', () => {
    expect(accuracy(4, 10)).toBe(1);
    expect(accuracy(5, 5)).toBe(1);
  });
});

describe('createStats', () => {
  it('starts every counter at zero', () => {
    expect(createStats()).toEqual({
      score: 0,
      kills: 0,
      killsByKind: { standard: 0, heavy: 0, scout: 0 },
      wave: 0,
      wavesCleared: 0,
      shotsFired: 0,
      hits: 0,
      survivalTime: 0,
      damageTaken: 0,
    });
  });

  it('returns independent objects', () => {
    const a = createStats();
    const b = createStats();
    a.kills = 3;
    a.killsByKind.heavy = 2;
    expect(b.kills).toBe(0);
    expect(b.killsByKind.heavy).toBe(0);
  });
});

describe('formatTime', () => {
  it.each<[number, string]>([
    [0, '0:00'],
    [5, '0:05'],
    [59.9, '0:59'],
    [60, '1:00'],
    [125, '2:05'],
    [600, '10:00'],
    [3600, '60:00'],
  ])('formats %f seconds as %s', (seconds, text) => {
    expect(formatTime(seconds)).toBe(text);
  });

  it('clamps negative times to zero', () => {
    expect(formatTime(-12)).toBe('0:00');
  });
});

describe('BestScoreStore', () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  describe('with a working store', () => {
    it('loads 0 when nothing is saved', () => {
      expect(new BestScoreStore(new MemoryStore()).load()).toBe(0);
    });

    it('saves a first score and reports a new record', () => {
      const storage = new MemoryStore();
      const best = new BestScoreStore(storage);
      expect(best.submit(500)).toBe(true);
      expect(storage.data.get(STORAGE_KEY)).toBe('500');
      expect(best.load()).toBe(500);
    });

    it('saves a higher score', () => {
      const storage = new MemoryStore();
      const best = new BestScoreStore(storage);
      best.submit(500);
      expect(best.submit(900)).toBe(true);
      expect(best.load()).toBe(900);
    });

    it('does not overwrite with a lower or equal score', () => {
      const storage = new MemoryStore();
      const best = new BestScoreStore(storage);
      best.submit(500);
      expect(best.submit(300)).toBe(false);
      expect(best.submit(500)).toBe(false);
      expect(best.load()).toBe(500);
      expect(storage.data.get(STORAGE_KEY)).toBe('500');
    });

    it('never records a zero or negative score', () => {
      const storage = new MemoryStore();
      const best = new BestScoreStore(storage);
      expect(best.submit(0)).toBe(false);
      expect(best.submit(-20)).toBe(false);
      expect(storage.data.size).toBe(0);
    });

    it('stores whole numbers only', () => {
      const storage = new MemoryStore();
      const best = new BestScoreStore(storage);
      expect(best.submit(700.9)).toBe(true);
      expect(storage.data.get(STORAGE_KEY)).toBe('700');
    });

    it('persists across store instances sharing the same storage', () => {
      const storage = new MemoryStore();
      new BestScoreStore(storage).submit(1234);
      expect(new BestScoreStore(storage).load()).toBe(1234);
    });

    it.each(['abc', '-5', 'Infinity', 'NaN', ''])('treats a corrupt saved value %j as no record', (raw) => {
      const storage = new MemoryStore();
      storage.data.set(STORAGE_KEY, raw);
      expect(new BestScoreStore(storage).load()).toBe(0);
    });

    it('floors a fractional saved value', () => {
      const storage = new MemoryStore();
      storage.data.set(STORAGE_KEY, '12.7');
      expect(new BestScoreStore(storage).load()).toBe(12);
    });
  });

  describe('without storage', () => {
    it('loads 0 and still reports records', () => {
      const best = new BestScoreStore(null);
      expect(best.load()).toBe(0);
      expect(best.submit(10)).toBe(true);
      expect(best.submit(0)).toBe(false);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('with a store that throws', () => {
    const failing = (): KeyValueStore => ({
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {
        throw new Error('quota exceeded');
      },
    });

    it('load swallows the error, returns 0 and warns', () => {
      const best = new BestScoreStore(failing());
      expect(() => best.load()).not.toThrow();
      expect(best.load()).toBe(0);
      expect(warn).toHaveBeenCalled();
    });

    it('submit swallows read and write errors and still reports the record', () => {
      const best = new BestScoreStore(failing());
      expect(() => best.submit(250)).not.toThrow();
      expect(best.submit(250)).toBe(true);
      expect(warn).toHaveBeenCalled();
    });

    it('survives a store that only fails on write', () => {
      const storage: KeyValueStore = {
        getItem: () => '100',
        setItem: () => {
          throw new Error('read only');
        },
      };
      const best = new BestScoreStore(storage);
      expect(best.load()).toBe(100);
      expect(best.submit(200)).toBe(true);
      expect(best.submit(50)).toBe(false);
    });
  });
});
