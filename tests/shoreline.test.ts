import { describe, expect, it } from 'vitest';
import { shorelineSegments } from '../src/world/shoreline';
import { Terrain } from '../src/world/Terrain';
import { makeTrough } from './waterFixtures';

describe('shorelineSegments', () => {
  // Ground 0.2|x| - 3 with water at -1.5 meets the ground at |x| = 7.5.
  const { terrain, level } = makeTrough(60, 0.2, 3, -1.5);
  const segments = shorelineSegments(terrain, level, 0.1);

  it('traces both banks exactly where the water meets the ground, lifted clear of it', () => {
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.length % 6).toBe(0);
    for (let k = 0; k < segments.length; k += 3) {
      expect(Math.abs(segments[k]!)).toBeCloseTo(7.5, 6);
      expect(segments[k + 1]).toBeCloseTo(-1.4, 6);
    }
  });

  it('runs the full length of the channel on each bank', () => {
    let length = 0;
    for (let k = 0; k < segments.length; k += 6) {
      length += Math.hypot(segments[k + 3]! - segments[k]!, segments[k + 5]! - segments[k + 2]!);
    }
    expect(length).toBeCloseTo(2 * 120, 3);
  });

  it('has no shoreline where there is no water', () => {
    const dry = new Terrain(30, 5);
    expect(shorelineSegments(dry, new Float32Array(dry.heights.length).fill(Number.NaN), 0.1)).toEqual([]);
  });
});
