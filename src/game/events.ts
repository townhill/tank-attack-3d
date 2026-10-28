/**
 * Events emitted by the simulation each tick. The presentation layer
 * (effects, audio, HUD) consumes them without reaching into game logic.
 */
import type { HitZone } from '../combat/DamageSystem';
import type { HitSurface } from '../combat/WeaponSystem';
import type { EnemyKind, Faction, TankKind } from '../config/settings';

export interface FireEvent {
  readonly type: 'fire';
  readonly tankId: number;
  readonly kind: TankKind;
  readonly faction: Faction;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
}

export interface ImpactEvent {
  readonly type: 'impact';
  readonly surface: HitSurface;
  readonly faction: Faction;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface TankHitEvent {
  readonly type: 'tankHit';
  readonly tankId: number;
  readonly attackerId: number;
  readonly kind: TankKind;
  readonly faction: Faction;
  readonly damage: number;
  readonly zone: HitZone;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface TankDestroyedEvent {
  readonly type: 'tankDestroyed';
  readonly tankId: number;
  readonly kind: TankKind;
  readonly faction: Faction;
  readonly byPlayer: boolean;
  readonly score: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface PlayerDamagedEvent {
  readonly type: 'playerDamaged';
  readonly amount: number;
  readonly sourceX: number;
  readonly sourceZ: number;
  readonly healthFraction: number;
}

export interface EnemySpawnedEvent {
  readonly type: 'enemySpawned';
  readonly tankId: number;
  readonly kind: EnemyKind;
  readonly x: number;
  readonly z: number;
}

export interface WaveStartEvent {
  readonly type: 'waveStart';
  readonly wave: number;
  readonly enemies: number;
}

export interface WaveCompleteEvent {
  readonly type: 'waveComplete';
  readonly wave: number;
  readonly bonus: number;
  readonly repair: number;
}

export interface GameOverEvent {
  readonly type: 'gameOver';
}

export type GameEvent =
  | FireEvent
  | ImpactEvent
  | TankHitEvent
  | TankDestroyedEvent
  | PlayerDamagedEvent
  | EnemySpawnedEvent
  | WaveStartEvent
  | WaveCompleteEvent
  | GameOverEvent;
