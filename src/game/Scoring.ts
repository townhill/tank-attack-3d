/** Score rules, run statistics and best-score persistence. */
import type { Difficulty, EnemyKind } from '../config/settings';
import { DIFFICULTY, TANK_SPECS, WAVES } from '../config/settings';

export function killScore(kind: EnemyKind, wave: number, difficulty: Difficulty): number {
  const waveMultiplier = 1 + Math.max(0, wave - 1) * WAVES.waveScoreStep;
  return Math.round(TANK_SPECS[kind].scoreValue * waveMultiplier * DIFFICULTY[difficulty].scoreMultiplier);
}

export function waveClearBonus(wave: number, difficulty: Difficulty): number {
  return Math.round(WAVES.waveClearBonus * wave * DIFFICULTY[difficulty].scoreMultiplier);
}

/** Hit ratio in [0, 1]; zero when nothing has been fired. */
export function accuracy(shotsFired: number, hits: number): number {
  if (shotsFired <= 0) return 0;
  return Math.min(1, hits / shotsFired);
}

export interface GameStats {
  score: number;
  kills: number;
  killsByKind: Record<'standard' | 'heavy' | 'scout', number>;
  wave: number;
  wavesCleared: number;
  shotsFired: number;
  hits: number;
  survivalTime: number;
  damageTaken: number;
}

export function createStats(): GameStats {
  return {
    score: 0,
    kills: 0,
    killsByKind: { standard: 0, heavy: 0, scout: 0 },
    wave: 0,
    wavesCleared: 0,
    shotsFired: 0,
    hits: 0,
    survivalTime: 0,
    damageTaken: 0,
  };
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const BEST_SCORE_KEY = 'vectorTanks.bestScore';

/** Persists the best score; tolerates missing or failing storage. */
export class BestScoreStore {
  constructor(private readonly storage: KeyValueStore | null) {}

  load(): number {
    if (!this.storage) return 0;
    try {
      const raw = this.storage.getItem(BEST_SCORE_KEY);
      const value = raw === null ? 0 : Number(raw);
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch (error) {
      console.warn('Unable to read best score', error);
      return 0;
    }
  }

  /** Records `score` if it beats the stored best. Returns true for a new record. */
  submit(score: number): boolean {
    if (score <= this.load()) return false;
    if (!this.storage) return true;
    try {
      this.storage.setItem(BEST_SCORE_KEY, String(Math.floor(score)));
    } catch (error) {
      console.warn('Unable to save best score', error);
    }
    return true;
  }
}
