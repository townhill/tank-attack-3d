/** Wave planning and spawn pacing. */
import type { DifficultySpec, EnemyKind } from '../config/settings';
import { WAVES } from '../config/settings';
import type { Random } from '../utils/random';

export function waveEnemyCount(wave: number): number {
  return Math.min(WAVES.maxEnemiesPerWave, WAVES.baseEnemyCount + Math.max(0, wave - 1) * WAVES.enemiesPerWave);
}

function shareFrom(wave: number, fromWave: number, step: number, max: number): number {
  if (wave < fromWave) return 0;
  return Math.min(max, step * (wave - fromWave + 1));
}

/** Enemy types for a wave, in spawn order. Deterministic for a given RNG state. */
export function waveComposition(wave: number, rng: Random): EnemyKind[] {
  const count = waveEnemyCount(wave);
  const heavy = Math.round(count * shareFrom(wave, WAVES.heavyFromWave, WAVES.heavyShareStep, WAVES.heavyShareMax));
  const scout = Math.round(count * shareFrom(wave, WAVES.scoutFromWave, WAVES.scoutShareStep, WAVES.scoutShareMax));
  const standard = Math.max(0, count - heavy - scout);
  const kinds: EnemyKind[] = [
    ...Array<EnemyKind>(standard).fill('standard'),
    ...Array<EnemyKind>(heavy).fill('heavy'),
    ...Array<EnemyKind>(scout).fill('scout'),
  ];
  return rng.shuffle(kinds);
}

export function maxConcurrentEnemies(wave: number, difficulty: DifficultySpec): number {
  return difficulty.maxConcurrentEnemies + Math.floor(Math.max(0, wave - 1) / WAVES.concurrencyStepWaves);
}

/** Enemy aim error multiplier: enemies get sharper as waves progress. */
export function aimErrorScale(wave: number): number {
  return Math.max(WAVES.minAimErrorFactor, 1 - Math.max(0, wave - 1) * WAVES.aimImprovementPerWave);
}

export type WavePhase = 'intermission' | 'active';

export interface WaveUpdate {
  startedWave: number | null;
  clearedWave: number | null;
  spawn: EnemyKind | null;
}

/** Quick follow-up spawn interval while the field is nearly empty. */
const BURST_SPAWN_INTERVAL = 0.8;
const BURST_THRESHOLD = 2;

export class WaveManager {
  wave = 0;
  phase: WavePhase = 'intermission';
  /** Seconds left in the current intermission. */
  timer: number;
  private queue: EnemyKind[] = [];
  private spawnTimer = 0;
  private readonly result: WaveUpdate = { startedWave: null, clearedWave: null, spawn: null };

  constructor(
    private readonly difficulty: DifficultySpec,
    private readonly rng: Random,
    firstWaveDelay = 3,
  ) {
    this.timer = firstWaveDelay;
  }

  get remainingToSpawn(): number {
    return this.queue.length;
  }

  /** Puts a spawn back at the front of the queue (e.g. no valid spawn point found). */
  requeue(kind: EnemyKind): void {
    this.queue.unshift(kind);
    this.spawnTimer = 0.5;
  }

  update(dt: number, aliveEnemies: number): WaveUpdate {
    const r = this.result;
    r.startedWave = null;
    r.clearedWave = null;
    r.spawn = null;

    if (this.phase === 'intermission') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.wave++;
        this.phase = 'active';
        this.queue = waveComposition(this.wave, this.rng);
        this.spawnTimer = 0;
        r.startedWave = this.wave;
      }
      return r;
    }

    this.spawnTimer -= dt;
    if (this.queue.length > 0 && this.spawnTimer <= 0 && aliveEnemies < maxConcurrentEnemies(this.wave, this.difficulty)) {
      r.spawn = this.queue.shift() ?? null;
      this.spawnTimer = aliveEnemies + 1 < BURST_THRESHOLD ? BURST_SPAWN_INTERVAL : this.difficulty.spawnInterval;
      return r;
    }
    if (this.queue.length === 0 && aliveEnemies === 0) {
      r.clearedWave = this.wave;
      this.phase = 'intermission';
      this.timer = WAVES.intermission;
    }
    return r;
  }
}
