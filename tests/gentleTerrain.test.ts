import { describe, expect, it } from 'vitest';
import type { MapSize } from '../src/config/settings';
import { generateWorld, worldOptionsFor } from '../src/world/WorldGenerator';
import { worldFingerprint } from './worldFingerprint';

interface GoldenWorld {
  readonly seed: number;
  readonly size: MapSize;
  readonly fords: boolean;
  readonly fingerprint: number;
}

/**
 * Fingerprints of battlefields as they were before terrain types existed.
 * Gentle terrain must keep generating exactly these worlds.
 */
const GOLDEN: readonly GoldenWorld[] = [
  { seed: 1, size: 'standard', fords: false, fingerprint: 2572958248 },
  { seed: 42, size: 'standard', fords: false, fingerprint: 3441263879 },
  { seed: 2026, size: 'standard', fords: false, fingerprint: 3839655951 },
  { seed: 42, size: 'standard', fords: true, fingerprint: 570792867 },
  { seed: 7, size: 'large', fords: false, fingerprint: 1301436684 },
  { seed: 3, size: 'huge', fords: false, fingerprint: 2959476597 },
];

/** A Huge battlefield can take over five seconds to generate under coverage instrumentation (ms). */
const GENERATION_TIMEOUT = 30_000;

describe('Gentle terrain', () => {
  for (const g of GOLDEN) {
    it(`generates the same ${g.size} battlefield for seed ${g.seed}${g.fords ? ' with fords' : ''} as before terrain types`, () => {
      expect(worldFingerprint(generateWorld(g.seed, worldOptionsFor(g.size, g.fords)))).toBe(g.fingerprint);
    }, GENERATION_TIMEOUT);
  }
});
