import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings, SettingsStore } from '../src/config/userSettings';
import type { KeyValueStore } from '../src/game/Scoring';

class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('sanitizeSettings', () => {
  it('returns defaults for non-object input', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it('defaults to the Modern Neon Vector mode', () => {
    expect(DEFAULT_SETTINGS.graphicsMode).toBe('neon');
  });

  it('keeps valid values', () => {
    const s = sanitizeSettings({ graphicsMode: 'classic', difficulty: 'hard', quality: 'low', fov: 80, invertY: true, radarOrientation: 'north-up' });
    expect(s.graphicsMode).toBe('classic');
    expect(s.difficulty).toBe('hard');
    expect(s.quality).toBe('low');
    expect(s.fov).toBe(80);
    expect(s.invertY).toBe(true);
    expect(s.radarOrientation).toBe('north-up');
  });

  it('replaces unknown enum values and wrong types with defaults', () => {
    const s = sanitizeSettings({ graphicsMode: 'vaporwave', difficulty: 3, muted: 'yes', mapIntel: 'psychic' });
    expect(s.graphicsMode).toBe(DEFAULT_SETTINGS.graphicsMode);
    expect(s.difficulty).toBe(DEFAULT_SETTINGS.difficulty);
    expect(s.muted).toBe(DEFAULT_SETTINGS.muted);
    expect(s.mapIntel).toBe(DEFAULT_SETTINGS.mapIntel);
  });

  it('defaults to the standard map size and keeps a valid one', () => {
    expect(DEFAULT_SETTINGS.mapSize).toBe('standard');
    expect(sanitizeSettings({ mapSize: 'large' }).mapSize).toBe('large');
    expect(sanitizeSettings({ mapSize: 'huge' }).mapSize).toBe('huge');
  });

  it('falls back to the standard map size for missing or unknown values', () => {
    expect(sanitizeSettings({}).mapSize).toBe('standard');
    expect(sanitizeSettings({ mapSize: 'galactic' }).mapSize).toBe('standard');
    expect(sanitizeSettings({ mapSize: 3 }).mapSize).toBe('standard');
  });

  it('defaults to gentle terrain and keeps a valid terrain type', () => {
    expect(DEFAULT_SETTINGS.terrain).toBe('gentle');
    expect(sanitizeSettings({ terrain: 'hilly' }).terrain).toBe('hilly');
  });

  it('falls back to gentle terrain for missing or unknown values', () => {
    expect(sanitizeSettings({}).terrain).toBe('gentle');
    expect(sanitizeSettings({ terrain: 'mountainous' }).terrain).toBe('gentle');
    expect(sanitizeSettings({ terrain: 1 }).terrain).toBe('gentle');
  });

  it('clamps numbers into range and rejects non-finite numbers', () => {
    const s = sanitizeSettings({ fov: 500, masterVolume: -2, mouseSensitivity: Number.NaN, bloomStrength: Number.POSITIVE_INFINITY });
    expect(s.fov).toBe(100);
    expect(s.masterVolume).toBe(0);
    expect(s.mouseSensitivity).toBe(DEFAULT_SETTINGS.mouseSensitivity);
    expect(s.bloomStrength).toBe(DEFAULT_SETTINGS.bloomStrength);
  });
});

describe('SettingsStore', () => {
  it('round-trips settings through storage', () => {
    const store = new SettingsStore(new MemoryStore());
    const custom = { ...DEFAULT_SETTINGS, graphicsMode: 'hybrid' as const, fov: 90 };
    store.save(custom);
    expect(store.load()).toEqual(custom);
  });

  it('returns defaults when nothing is stored or storage is missing', () => {
    expect(new SettingsStore(new MemoryStore()).load()).toEqual(DEFAULT_SETTINGS);
    expect(new SettingsStore(null).load()).toEqual(DEFAULT_SETTINGS);
  });

  it('survives corrupt JSON and throwing storage', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const corrupt = new MemoryStore();
    corrupt.setItem('vectorTanks.settings.v1', '{not json');
    expect(new SettingsStore(corrupt).load()).toEqual(DEFAULT_SETTINGS);
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const store = new SettingsStore(broken);
    expect(store.load()).toEqual(DEFAULT_SETTINGS);
    expect(() => {
      store.save(DEFAULT_SETTINGS);
    }).not.toThrow();
    warn.mockRestore();
  });
});
