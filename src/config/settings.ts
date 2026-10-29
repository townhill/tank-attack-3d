/**
 * Central tunable gameplay parameters. Rendering-only values live in the
 * rendering modules; anything that affects the simulation lives here.
 */
import { DEG } from '../utils/math';

export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;

export const WORLD = {
  /** Half extent of the generated heightfield in metres. */
  terrainHalfSize: 720,
  /** Heightfield cell size in metres. */
  cellSize: 5,
  /** Half extent of the square the tanks can drive in. */
  playableHalfSize: 500,
  /** Radius around the player spawn kept clear of obstacles. */
  spawnClearRadius: 55,
  gravity: 9.81,
  rockCount: 75,
  structureCount: 24,
} as const;

export type TankKind = 'player' | 'standard' | 'heavy' | 'scout';
export type EnemyKind = Exclude<TankKind, 'player'>;
export type Faction = 'player' | 'enemy';

export interface WeaponSpec {
  readonly damage: number;
  readonly reloadTime: number;
  readonly muzzleSpeed: number;
  readonly maxRange: number;
}

export interface TankSpec {
  readonly kind: TankKind;
  readonly label: string;
  /** Uniform model scale relative to the base model (affects size and hit box). */
  readonly scale: number;
  readonly collisionRadius: number;
  /** Hit box half extents (x = half width, y = half height, z = half length). */
  readonly hitHalfExtents: { readonly x: number; readonly y: number; readonly z: number };
  readonly maxSpeed: number;
  readonly reverseSpeed: number;
  readonly acceleration: number;
  readonly braking: number;
  readonly coastDeceleration: number;
  readonly turnRate: number;
  readonly turnAcceleration: number;
  readonly turretTraverse: number;
  readonly elevationRate: number;
  readonly minElevation: number;
  readonly maxElevation: number;
  readonly maxHealth: number;
  /** Fraction of incoming damage absorbed by armour, 0..1. */
  readonly armor: number;
  readonly mass: number;
  readonly weapon: WeaponSpec;
  /** Model-space offsets (before scale) shared by physics and rendering. */
  readonly turretPivotY: number;
  readonly turretPivotZ: number;
  readonly gunPivotY: number;
  readonly gunPivotZ: number;
  readonly barrelLength: number;
  readonly scoreValue: number;
}

const BASE_GEOMETRY = {
  turretPivotY: 2.05,
  turretPivotZ: 0.35,
  gunPivotY: 0.55,
  gunPivotZ: -1.25,
  barrelLength: 4.4,
};

export const TANK_SPECS: Readonly<Record<TankKind, TankSpec>> = {
  player: {
    kind: 'player',
    label: 'Player',
    scale: 1,
    collisionRadius: 3.6,
    hitHalfExtents: { x: 1.9, y: 1.45, z: 3.6 },
    maxSpeed: 15,
    reverseSpeed: 6.5,
    acceleration: 6.5,
    braking: 14,
    coastDeceleration: 4,
    turnRate: 62 * DEG,
    turnAcceleration: 260 * DEG,
    turretTraverse: 130 * DEG,
    elevationRate: 30 * DEG,
    minElevation: -8 * DEG,
    maxElevation: 20 * DEG,
    maxHealth: 100,
    armor: 0,
    mass: 1,
    weapon: { damage: 34, reloadTime: 1.5, muzzleSpeed: 240, maxRange: 900 },
    ...BASE_GEOMETRY,
    scoreValue: 0,
  },
  standard: {
    kind: 'standard',
    label: 'Standard',
    scale: 1,
    collisionRadius: 3.6,
    hitHalfExtents: { x: 1.9, y: 1.45, z: 3.6 },
    maxSpeed: 10,
    reverseSpeed: 5,
    acceleration: 5,
    braking: 12,
    coastDeceleration: 4,
    turnRate: 50 * DEG,
    turnAcceleration: 200 * DEG,
    turretTraverse: 55 * DEG,
    elevationRate: 20 * DEG,
    minElevation: -8 * DEG,
    maxElevation: 18 * DEG,
    maxHealth: 70,
    armor: 0,
    mass: 1,
    weapon: { damage: 16, reloadTime: 3.4, muzzleSpeed: 210, maxRange: 650 },
    ...BASE_GEOMETRY,
    scoreValue: 100,
  },
  heavy: {
    kind: 'heavy',
    label: 'Heavy',
    scale: 1.3,
    collisionRadius: 4.7,
    hitHalfExtents: { x: 2.5, y: 1.9, z: 4.7 },
    maxSpeed: 6.5,
    reverseSpeed: 3.5,
    acceleration: 3,
    braking: 9,
    coastDeceleration: 3,
    turnRate: 32 * DEG,
    turnAcceleration: 120 * DEG,
    turretTraverse: 26 * DEG,
    elevationRate: 12 * DEG,
    minElevation: -6 * DEG,
    maxElevation: 15 * DEG,
    maxHealth: 160,
    armor: 0.25,
    mass: 2.2,
    weapon: { damage: 30, reloadTime: 4.6, muzzleSpeed: 200, maxRange: 700 },
    ...BASE_GEOMETRY,
    scoreValue: 250,
  },
  scout: {
    kind: 'scout',
    label: 'Scout',
    scale: 0.78,
    collisionRadius: 2.8,
    hitHalfExtents: { x: 1.5, y: 1.15, z: 2.8 },
    maxSpeed: 19,
    reverseSpeed: 9,
    acceleration: 9,
    braking: 18,
    coastDeceleration: 5,
    turnRate: 95 * DEG,
    turnAcceleration: 360 * DEG,
    turretTraverse: 110 * DEG,
    elevationRate: 35 * DEG,
    minElevation: -8 * DEG,
    maxElevation: 20 * DEG,
    maxHealth: 40,
    armor: 0,
    mass: 0.6,
    weapon: { damage: 9, reloadTime: 2.1, muzzleSpeed: 220, maxRange: 500 },
    ...BASE_GEOMETRY,
    scoreValue: 150,
  },
};

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultySpec {
  readonly label: string;
  readonly detectionRange: number;
  /** Seconds before an enemy reacts to spotting the player. [min, max]. */
  readonly reactionTime: readonly [number, number];
  /** Standard deviation of aim error in radians. */
  readonly aimError: number;
  /** 0 = aim at current position, 1 = full projectile travel-time lead. */
  readonly leadFactor: number;
  readonly enemyReloadMultiplier: number;
  readonly enemySpeedMultiplier: number;
  readonly damageToPlayerMultiplier: number;
  readonly maxConcurrentEnemies: number;
  readonly spawnInterval: number;
  readonly minSpawnDistance: number;
  readonly scoreMultiplier: number;
  /** Health restored to the player when a wave is cleared. */
  readonly waveRepair: number;
}

export const DIFFICULTY: Readonly<Record<Difficulty, DifficultySpec>> = {
  easy: {
    label: 'Easy',
    detectionRange: 230,
    reactionTime: [1.0, 1.8],
    aimError: 2.6 * DEG,
    leadFactor: 0,
    enemyReloadMultiplier: 1.45,
    enemySpeedMultiplier: 0.85,
    damageToPlayerMultiplier: 0.6,
    maxConcurrentEnemies: 3,
    spawnInterval: 6,
    minSpawnDistance: 280,
    scoreMultiplier: 0.75,
    waveRepair: 40,
  },
  normal: {
    label: 'Normal',
    detectionRange: 300,
    reactionTime: [0.55, 1.1],
    aimError: 1.5 * DEG,
    leadFactor: 0.55,
    enemyReloadMultiplier: 1,
    enemySpeedMultiplier: 1,
    damageToPlayerMultiplier: 1,
    maxConcurrentEnemies: 4,
    spawnInterval: 4.5,
    minSpawnDistance: 260,
    scoreMultiplier: 1,
    waveRepair: 25,
  },
  hard: {
    label: 'Hard',
    detectionRange: 380,
    reactionTime: [0.25, 0.6],
    aimError: 0.75 * DEG,
    leadFactor: 1,
    enemyReloadMultiplier: 0.8,
    enemySpeedMultiplier: 1.12,
    damageToPlayerMultiplier: 1.25,
    maxConcurrentEnemies: 6,
    spawnInterval: 3,
    minSpawnDistance: 240,
    scoreMultiplier: 1.5,
    waveRepair: 20,
  },
};

export type MapSize = 'standard' | 'large' | 'huge';

export interface MapSizeSpec {
  readonly label: string;
  /** Multiplier on the side length of the playable square (area grows with its square). */
  readonly scale: number;
}

export const MAP_SIZES: Readonly<Record<MapSize, MapSizeSpec>> = {
  standard: { label: 'Standard', scale: 1 },
  large: { label: 'Large', scale: 2 },
  huge: { label: 'Huge', scale: 3 },
};

export const WAVES = {
  baseEnemyCount: 3,
  enemiesPerWave: 2,
  maxEnemiesPerWave: 24,
  /** Wave from which heavy tanks may appear. */
  heavyFromWave: 2,
  scoutFromWave: 3,
  heavyShareStep: 0.1,
  heavyShareMax: 0.3,
  scoutShareStep: 0.12,
  scoutShareMax: 0.35,
  /** Extra concurrent enemies allowed every N waves. */
  concurrencyStepWaves: 3,
  intermission: 6,
  waveClearBonus: 400,
  /** Score multiplier gained per wave after the first. */
  waveScoreStep: 0.1,
  /** Accuracy improvement per wave (fraction of aim error removed). */
  aimImprovementPerWave: 0.04,
  minAimErrorFactor: 0.55,
} as const;

export const DAMAGE = {
  frontMultiplier: 0.8,
  sideMultiplier: 1,
  rearMultiplier: 1.3,
  /** Hits within this angle (radians) of the hull's nose count as frontal. */
  frontArc: 50 * DEG,
  /** Hits within this angle of the hull's tail count as rear hits. */
  rearArc: 40 * DEG,
  /** Fraction of damage applied when an enemy shell hits another enemy. */
  friendlyFireMultiplier: 0,
} as const;

export const AI = {
  patrolRadius: 160,
  patrolArrivalDistance: 18,
  investigateTime: 14,
  loseTargetTime: 6,
  hearingRange: 90,
  /** Distance at which a shot fired near an enemy draws its attention. */
  gunfireAlertRange: 320,
  preferredRange: { standard: 150, heavy: 110, scout: 90 },
  fireAlignment: 2.2 * DEG,
  retreatHealthFraction: { standard: 0.3, heavy: 0, scout: 0.45 },
  retreatTime: 6,
  evadeTime: 2.6,
  flankDistance: 120,
  stuckSpeed: 0.8,
  stuckTime: 2.2,
  unstickTime: 1.6,
  avoidLookAhead: 22,
  separationRadius: 14,
} as const;

export const PROJECTILE = {
  maxLifetime: 4.5,
  poolSize: 96,
  /** Terrain test step length along a projectile's path (metres). */
  terrainStep: 1,
} as const;
