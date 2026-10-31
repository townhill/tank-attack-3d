/**
 * Player-adjustable preferences, persisted to browser storage and validated
 * on load so corrupt or outdated data can never break the game.
 */
import type { Difficulty, MapSize, TerrainType } from './settings';
import type { KeyValueStore } from '../game/Scoring';

export type GraphicsModeId = 'classic' | 'neon' | 'hybrid';
export type QualityLevel = 'low' | 'medium' | 'high';
export type RadarOrientation = 'heading-up' | 'north-up';
export type MapIntel = 'full' | 'radar';

export interface UserSettings {
  graphicsMode: GraphicsModeId;
  difficulty: Difficulty;
  /** Battlefield size for the next new game. */
  mapSize: MapSize;
  /** Whether new battlefields get a shallow ford across each river. */
  fords: boolean;
  /** Shape of the ground on new battlefields. */
  terrain: TerrainType;
  quality: QualityLevel;
  autoQuality: boolean;
  /** Bloom multiplier applied on top of each graphics mode's own bloom (0..2). */
  bloomStrength: number;
  scanlines: boolean;
  flicker: boolean;
  /** Classic mode nostalgia: draw every edge without hidden-line removal. */
  seeThroughWireframe: boolean;
  groundGrid: boolean;
  mouseSensitivity: number;
  invertY: boolean;
  fov: number;
  masterVolume: number;
  sfxVolume: number;
  muted: boolean;
  retroSound: boolean;
  radarVisible: boolean;
  radarOrientation: RadarOrientation;
  /** When false the tactical map pauses the game while open. */
  mapRealtime: boolean;
  mapIntel: MapIntel;
  targetMarkers: boolean;
  cameraShake: boolean;
  showPerf: boolean;
}

export const DEFAULT_SETTINGS: Readonly<UserSettings> = {
  graphicsMode: 'neon',
  difficulty: 'normal',
  mapSize: 'standard',
  fords: false,
  terrain: 'gentle',
  quality: 'high',
  autoQuality: true,
  bloomStrength: 1,
  scanlines: true,
  flicker: true,
  seeThroughWireframe: false,
  groundGrid: true,
  mouseSensitivity: 1,
  invertY: false,
  fov: 70,
  masterVolume: 0.8,
  sfxVolume: 0.9,
  muted: false,
  retroSound: true,
  radarVisible: true,
  radarOrientation: 'heading-up',
  mapRealtime: false,
  mapIntel: 'full',
  targetMarkers: true,
  cameraShake: true,
  showPerf: false,
};

export const GRAPHICS_MODES: readonly GraphicsModeId[] = ['classic', 'neon', 'hybrid'];
export const QUALITY_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];
export const MAP_SIZE_IDS: readonly MapSize[] = ['standard', 'large', 'huge'];
export const TERRAIN_TYPE_IDS: readonly TerrainType[] = ['gentle', 'hilly'];

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function pickNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Builds a complete, valid settings object from untrusted input. */
export function sanitizeSettings(raw: unknown): UserSettings {
  const src = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    graphicsMode: pickEnum(src.graphicsMode, GRAPHICS_MODES, d.graphicsMode),
    difficulty: pickEnum(src.difficulty, DIFFICULTIES, d.difficulty),
    mapSize: pickEnum(src.mapSize, MAP_SIZE_IDS, d.mapSize),
    fords: pickBoolean(src.fords, d.fords),
    terrain: pickEnum(src.terrain, TERRAIN_TYPE_IDS, d.terrain),
    quality: pickEnum(src.quality, QUALITY_LEVELS, d.quality),
    autoQuality: pickBoolean(src.autoQuality, d.autoQuality),
    bloomStrength: pickNumber(src.bloomStrength, 0, 2, d.bloomStrength),
    scanlines: pickBoolean(src.scanlines, d.scanlines),
    flicker: pickBoolean(src.flicker, d.flicker),
    seeThroughWireframe: pickBoolean(src.seeThroughWireframe, d.seeThroughWireframe),
    groundGrid: pickBoolean(src.groundGrid, d.groundGrid),
    mouseSensitivity: pickNumber(src.mouseSensitivity, 0.1, 4, d.mouseSensitivity),
    invertY: pickBoolean(src.invertY, d.invertY),
    fov: pickNumber(src.fov, 50, 100, d.fov),
    masterVolume: pickNumber(src.masterVolume, 0, 1, d.masterVolume),
    sfxVolume: pickNumber(src.sfxVolume, 0, 1, d.sfxVolume),
    muted: pickBoolean(src.muted, d.muted),
    retroSound: pickBoolean(src.retroSound, d.retroSound),
    radarVisible: pickBoolean(src.radarVisible, d.radarVisible),
    radarOrientation: pickEnum<RadarOrientation>(src.radarOrientation, ['heading-up', 'north-up'], d.radarOrientation),
    mapRealtime: pickBoolean(src.mapRealtime, d.mapRealtime),
    mapIntel: pickEnum<MapIntel>(src.mapIntel, ['full', 'radar'], d.mapIntel),
    targetMarkers: pickBoolean(src.targetMarkers, d.targetMarkers),
    cameraShake: pickBoolean(src.cameraShake, d.cameraShake),
    showPerf: pickBoolean(src.showPerf, d.showPerf),
  };
}

const SETTINGS_KEY = 'vectorTanks.settings.v1';

export class SettingsStore {
  constructor(private readonly storage: KeyValueStore | null) {}

  load(): UserSettings {
    if (!this.storage) return { ...DEFAULT_SETTINGS };
    try {
      const raw = this.storage.getItem(SETTINGS_KEY);
      return sanitizeSettings(raw === null ? {} : JSON.parse(raw));
    } catch (error) {
      console.warn('Ignoring unreadable settings', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  save(settings: UserSettings): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('Unable to save settings', error);
    }
  }
}

/** Returns browser localStorage when usable (it can throw in private modes). */
export function browserStorage(): KeyValueStore | null {
  try {
    const storage = window.localStorage;
    const probe = '__vt_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
