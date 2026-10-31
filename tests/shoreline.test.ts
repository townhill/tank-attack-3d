import { describe, expect, it } from 'vitest';
import { shoreWetness, shorelineSegments } from '../src/world/shoreline';
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

describe('shoreWetness', () => {
  // Ground 0.2|x| - 3 with water at -1 meets the ground exactly on the vertices at |x| = 10.
  const { terrain, level } = makeTrough(60, 0.2, 3, -1);
  const wetness = shoreWetness(terrain, level);
  const j = Math.floor(terrain.resolution / 2);
  const at = (x: number): number => wetness[terrain.index(Math.round((x + terrain.halfSize) / terrain.cellSize), j)]!;

  it('soaks the ground most at the waterline and fades up the bank and down into deep water', () => {
    expect(at(10)).toBe(1);
    expect(at(-10)).toBe(1);
    expect(at(15)).toBeGreaterThan(0);
    expect(at(15)).toBeLessThan(at(10));
    expect(at(20)).toBeGreaterThan(0);
    expect(at(20)).toBeLessThan(at(15));
    expect(at(25)).toBe(0);
    expect(at(5)).toBeLessThan(at(10));
    expect(at(0)).toBe(0);
  });

  it('stays within 0..1 and is symmetric about the channel', () => {
    for (const w of wetness) {
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    }
    for (const x of [5, 15, 20]) expect(at(-x)).toBeCloseTo(at(x), 6);
  });

  it('soaks one vertex beyond the water level along rows and columns, never wrapping round the grid', () => {
    // Flat ground at 0 with water level 0 on two columns at the west edge and two rows in the middle.
    const flat = new Terrain(30, 5);
    const res = flat.resolution;
    const strips = new Float32Array(res * res).fill(Number.NaN);
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        if (i <= 1 || j === 5 || j === 6) strips[flat.index(i, j)] = 0;
      }
    }
    const w = shoreWetness(flat, strips);
    const away = 10;
    expect(w[flat.index(1, 0)]).toBe(1);
    expect(w[flat.index(2, 0)]).toBeCloseTo(0.5, 6);
    expect(w[flat.index(3, 0)]).toBe(0);
    expect(w[flat.index(away, 4)]).toBeCloseTo(0.5, 6);
    expect(w[flat.index(away, 7)]).toBeCloseTo(0.5, 6);
    expect(w[flat.index(away, 3)]).toBe(0);
    expect(w[flat.index(away, 8)]).toBe(0);
    // The east edge sits next to the next row's west edge in memory, but not on the ground.
    expect(w[flat.index(res - 1, 0)]).toBe(0);
  });

  it('leaves dry ground dry', () => {
    const dry = new Terrain(30, 5);
    expect(shoreWetness(dry, new Float32Array(dry.heights.length).fill(Number.NaN)).every((w) => w === 0)).toBe(true);
  });
});
