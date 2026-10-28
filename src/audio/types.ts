/**
 * Plain per-frame data the audio layer reads. Kept free of Three.js and
 * simulation classes so the mixer can be driven from tests or replays.
 */
import type { EnemyKind } from '../config/settings';

export interface AudioEnemy {
  readonly id: number;
  readonly kind: EnemyKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly speed: number;
}

export interface AudioFrame {
  /** Camera position. */
  listenerX: number;
  listenerY: number;
  listenerZ: number;
  /** Camera forward (unit). */
  listenerForwardX: number;
  listenerForwardY: number;
  listenerForwardZ: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerSpeed: number;
  playerMaxSpeed: number;
  /** Throttle input, -1..1. */
  throttle: number;
  /** Turret traverse rate in rad/s, signed. */
  turretYawRate: number;
  playerHealthFraction: number;
  playerAlive: boolean;
  enemies: readonly AudioEnemy[];
}
