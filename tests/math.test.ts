import { describe, expect, it } from 'vitest';
import {
  angleDiff,
  clamp,
  damp,
  dampAngle,
  DEG,
  distance2D,
  distanceSq2D,
  forwardX,
  forwardZ,
  headingOf,
  inverseLerp,
  lerp,
  lerpAngle,
  moveTowards,
  moveTowardsAngle,
  smoothstep,
  TAU,
  toCompassDegrees,
  wrapAngle,
} from '../src/utils/math';
import { SimplexNoise2D } from '../src/utils/noise';
import { hashSeed, Random } from '../src/utils/random';

describe('scalar helpers', () => {
  it('clamp limits a value to the given range', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-5, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('lerp and inverseLerp are inverse operations', () => {
    const value = lerp(10, 20, 0.25);
    expect(value).toBeCloseTo(12.5, 12);
    expect(inverseLerp(10, 20, value)).toBeCloseTo(0.25, 12);
  });

  it('inverseLerp returns 0 for a degenerate range instead of dividing by zero', () => {
    expect(inverseLerp(4, 4, 9)).toBe(0);
  });

  it('smoothstep is 0 below, 1 above and 0.5 at the midpoint of its edges', () => {
    expect(smoothstep(0, 10, -3)).toBe(0);
    expect(smoothstep(0, 10, 13)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5, 12);
  });

  it('moveTowards steps by at most maxDelta and never overshoots', () => {
    expect(moveTowards(0, 10, 3)).toBe(3);
    expect(moveTowards(0, 10, 30)).toBe(10);
    expect(moveTowards(10, 0, 4)).toBe(6);
    expect(moveTowards(5, 5, 1)).toBe(5);
  });

  it('distance helpers agree with each other', () => {
    expect(distance2D(0, 0, 3, 4)).toBe(5);
    expect(distanceSq2D(0, 0, 3, 4)).toBe(25);
    expect(distance2D(1, 1, 1, 1)).toBe(0);
  });
});

describe('wrapAngle', () => {
  it('leaves angles inside [-PI, PI) unchanged', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(1.25)).toBeCloseTo(1.25, 12);
    expect(wrapAngle(-2.5)).toBeCloseTo(-2.5, 12);
  });

  it('folds whole turns away in both directions', () => {
    expect(wrapAngle(TAU + 0.5)).toBeCloseTo(0.5, 12);
    expect(wrapAngle(-TAU - 0.5)).toBeCloseTo(-0.5, 12);
    expect(wrapAngle(5 * TAU + 1)).toBeCloseTo(1, 9);
    expect(wrapAngle(-7 * TAU - 1)).toBeCloseTo(-1, 9);
  });

  it('always returns a value in [-PI, PI)', () => {
    for (let a = -20; a <= 20; a += 0.37) {
      const wrapped = wrapAngle(a);
      expect(wrapped).toBeGreaterThanOrEqual(-Math.PI);
      expect(wrapped).toBeLessThan(Math.PI);
      expect(Math.cos(wrapped)).toBeCloseTo(Math.cos(a), 9);
      expect(Math.sin(wrapped)).toBeCloseTo(Math.sin(a), 9);
    }
  });

  it('maps +PI to -PI, the inclusive lower edge of the range', () => {
    expect(wrapAngle(Math.PI)).toBeCloseTo(-Math.PI, 12);
  });
});

describe('angleDiff', () => {
  it('returns the signed shortest difference across the 0/360 seam', () => {
    expect(angleDiff(350 * DEG, 10 * DEG)).toBeCloseTo(20 * DEG, 12);
    expect(angleDiff(10 * DEG, 350 * DEG)).toBeCloseTo(-20 * DEG, 12);
  });

  it('is zero between identical headings and between headings a full turn apart', () => {
    expect(angleDiff(1, 1)).toBe(0);
    expect(angleDiff(0.3, 0.3 + TAU)).toBeCloseTo(0, 9);
  });

  it('never exceeds half a turn in magnitude', () => {
    for (let from = -4; from <= 4; from += 0.9) {
      for (let to = -4; to <= 4; to += 0.7) {
        expect(Math.abs(angleDiff(from, to))).toBeLessThanOrEqual(Math.PI + 1e-12);
      }
    }
  });
});

describe('moveTowardsAngle', () => {
  it('takes the short way round the 0/360 seam', () => {
    // 350 deg -> 10 deg is +20 deg clockwise, so a 5 deg step lands on 355 deg (-5 deg).
    const next = moveTowardsAngle(350 * DEG, 10 * DEG, 5 * DEG);
    expect(next).toBeCloseTo(-5 * DEG, 12);
  });

  it('turns anticlockwise when that is the shorter way', () => {
    const next = moveTowardsAngle(10 * DEG, 350 * DEG, 5 * DEG);
    expect(next).toBeCloseTo(5 * DEG, 12);
  });

  it('lands exactly on the target without overshooting when maxDelta is large', () => {
    expect(moveTowardsAngle(350 * DEG, 10 * DEG, 90 * DEG)).toBeCloseTo(10 * DEG, 12);
    expect(moveTowardsAngle(0.2, 0.25, 1)).toBeCloseTo(0.25, 12);
  });

  it('does not move when maxDelta is zero and the target is elsewhere', () => {
    expect(moveTowardsAngle(1, 2, 0)).toBeCloseTo(1, 12);
  });

  it('converges on the target in a bounded number of steps', () => {
    let angle = 170 * DEG;
    const target = -170 * DEG;
    // The short way round is +20 deg, so four 5 deg steps must finish the job.
    for (let i = 0; i < 4; i++) angle = moveTowardsAngle(angle, target, 5 * DEG);
    expect(angleDiff(angle, target)).toBeCloseTo(0, 9);
  });
});

describe('damping and interpolation of angles', () => {
  it('damp returns the current value for lambda 0 and approaches the target for large lambda', () => {
    expect(damp(3, 9, 0, 0.1)).toBe(3);
    expect(damp(3, 9, 1000, 1)).toBeCloseTo(9, 9);
  });

  it('damp is frame-rate independent: two half steps equal one full step', () => {
    const full = damp(0, 10, 4, 0.2);
    const half = damp(damp(0, 10, 4, 0.1), 10, 4, 0.1);
    expect(half).toBeCloseTo(full, 12);
  });

  it('damp never overshoots the target', () => {
    let value = 0;
    for (let i = 0; i < 100; i++) {
      value = damp(value, 5, 3, 0.05);
      expect(value).toBeLessThanOrEqual(5);
    }
  });

  it('dampAngle approaches the target across the seam', () => {
    const next = dampAngle(350 * DEG, 10 * DEG, 5, 0.1);
    expect(angleDiff(350 * DEG, next)).toBeGreaterThan(0);
    expect(angleDiff(next, 10 * DEG)).toBeGreaterThan(0);
  });

  it('lerpAngle interpolates the short way round', () => {
    expect(lerpAngle(350 * DEG, 10 * DEG, 0.5)).toBeCloseTo(0, 12);
    expect(lerpAngle(10 * DEG, 350 * DEG, 0.5)).toBeCloseTo(0, 12);
  });
});

describe('compass heading conventions', () => {
  it('maps the cardinal directions to the documented headings', () => {
    expect(headingOf(0, -1)).toBeCloseTo(0, 12); // north is -Z
    expect(headingOf(1, 0)).toBeCloseTo(Math.PI / 2, 12); // east is +X
    expect(angleDiff(headingOf(0, 1), Math.PI)).toBeCloseTo(0, 12); // south (atan2 gives +PI)
    expect(headingOf(-1, 0)).toBeCloseTo(-Math.PI / 2, 12); // west
  });

  it('forward(h) points at the cardinal directions for the cardinal headings', () => {
    expect(forwardX(0)).toBeCloseTo(0, 12);
    expect(forwardZ(0)).toBeCloseTo(-1, 12);
    expect(forwardX(Math.PI / 2)).toBeCloseTo(1, 12);
    expect(forwardZ(Math.PI / 2)).toBeCloseTo(0, 12);
  });

  it('headingOf inverts forward for every heading', () => {
    for (let h = -Math.PI; h < Math.PI; h += 0.3) {
      const recovered = headingOf(forwardX(h), forwardZ(h));
      expect(angleDiff(h, recovered)).toBeCloseTo(0, 9);
    }
  });

  it('headingOf ignores the length of the direction vector', () => {
    expect(headingOf(30, -30)).toBeCloseTo(headingOf(1, -1), 12);
  });

  it('forward(h) is a unit vector', () => {
    for (let h = 0; h < TAU; h += 0.5) {
      expect(Math.hypot(forwardX(h), forwardZ(h))).toBeCloseTo(1, 12);
    }
  });
});

describe('toCompassDegrees', () => {
  it('reports whole degrees for the cardinal headings', () => {
    expect(toCompassDegrees(0)).toBe(0);
    expect(toCompassDegrees(Math.PI / 2)).toBe(90);
    expect(toCompassDegrees(Math.PI)).toBe(180);
    expect(toCompassDegrees(-Math.PI / 2)).toBe(270);
  });

  it('wraps negative and multi-turn headings into [0, 360)', () => {
    expect(toCompassDegrees(-10 * DEG)).toBe(350);
    expect(toCompassDegrees(370 * DEG)).toBe(10);
    expect(toCompassDegrees(-370 * DEG)).toBe(350);
  });

  it('never returns 360 for headings just below a full turn', () => {
    expect(toCompassDegrees(359.6 * DEG)).toBe(0);
    for (let h = -10; h <= 10; h += 0.0137) {
      const deg = toCompassDegrees(h);
      expect(deg).toBeGreaterThanOrEqual(0);
      expect(deg).toBeLessThan(360);
    }
  });
});

describe('Random', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new Random(1234);
    const b = new Random(1234);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });

  it('produces different sequences for different seeds', () => {
    const a = new Random(1);
    const b = new Random(2);
    const first = Array.from({ length: 8 }, () => a.next());
    const second = Array.from({ length: 8 }, () => b.next());
    expect(first).not.toEqual(second);
  });

  it('next stays in [0, 1)', () => {
    const rng = new Random(99);
    for (let i = 0; i < 2000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range stays within [min, max)', () => {
    const rng = new Random(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(-3, 8);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(8);
    }
  });

  it('range with equal bounds always returns that value', () => {
    const rng = new Random(7);
    expect(rng.range(2.5, 2.5)).toBe(2.5);
  });

  it('int is inclusive at both ends and never leaves the range', () => {
    const rng = new Random(42);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(3, 6);
      expect(Number.isInteger(v)).toBe(true);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('int with equal bounds returns that value', () => {
    const rng = new Random(42);
    for (let i = 0; i < 20; i++) expect(rng.int(5, 5)).toBe(5);
  });

  it('chance(0) never fires and chance(1) always fires', () => {
    const rng = new Random(5);
    for (let i = 0; i < 200; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('chance(p) fires roughly p of the time', () => {
    const rng = new Random(11);
    let hits = 0;
    const trials = 4000;
    for (let i = 0; i < trials; i++) if (rng.chance(0.3)) hits++;
    expect(hits / trials).toBeGreaterThan(0.25);
    expect(hits / trials).toBeLessThan(0.35);
  });

  it('signed stays in [-1, 1)', () => {
    const rng = new Random(3);
    for (let i = 0; i < 1000; i++) {
      const v = rng.signed();
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThan(1);
    }
  });

  it('gaussian is approximately standard normal and always finite', () => {
    const rng = new Random(1);
    const n = 5000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const g = rng.gaussian();
      expect(Number.isFinite(g)).toBe(true);
      sum += g;
      sumSq += g * g;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSq / n - mean * mean);
    expect(Math.abs(mean)).toBeLessThan(0.1);
    expect(sd).toBeGreaterThan(0.9);
    expect(sd).toBeLessThan(1.1);
  });

  it('pick returns members of the array and throws on an empty array', () => {
    const rng = new Random(8);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 50; i++) expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow(/empty array/);
  });

  it('shuffle returns a permutation of the input', () => {
    const rng = new Random(21);
    const input = Array.from({ length: 30 }, (_, i) => i);
    const shuffled = rng.shuffle(input);
    expect(shuffled).toHaveLength(input.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(input);
  });

  it('shuffle does not mutate its input', () => {
    const rng = new Random(21);
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
    const snapshot = [...input];
    const shuffled = rng.shuffle(input);
    expect(input).toEqual(snapshot);
    expect(shuffled).not.toBe(input);
  });

  it('shuffle is deterministic for a given seed and actually reorders', () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const a = new Random(77).shuffle(input);
    const b = new Random(77).shuffle(input);
    expect(a).toEqual(b);
    expect(a).not.toEqual(input);
  });

  it('shuffle handles empty and single-element arrays', () => {
    const rng = new Random(1);
    expect(rng.shuffle([])).toEqual([]);
    expect(rng.shuffle([9])).toEqual([9]);
  });
});

describe('hashSeed', () => {
  it('is stable across calls', () => {
    expect(hashSeed('vector tanks')).toBe(hashSeed('vector tanks'));
  });

  it('matches the published FNV-1a 32-bit reference values', () => {
    expect(hashSeed('')).toBe(0x811c9dc5);
    expect(hashSeed('a')).toBe(0xe40c292c);
    expect(hashSeed('foobar')).toBe(0xbf9cf968);
  });

  it('gives different seeds for different text and always an unsigned 32-bit integer', () => {
    const texts = ['alpha', 'beta', 'gamma', 'Alpha', 'alpha '];
    const hashes = texts.map(hashSeed);
    expect(new Set(hashes).size).toBe(texts.length);
    for (const h of hashes) {
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
});

describe('SimplexNoise2D', () => {
  const samplePoints: [number, number][] = [];
  for (let i = 0; i < 400; i++) samplePoints.push([(i * 0.37) % 53 - 26, (i * 0.91) % 47 - 23]);

  it('is deterministic for a given seed', () => {
    const a = new SimplexNoise2D(5);
    const b = new SimplexNoise2D(5);
    for (const [x, y] of samplePoints) {
      expect(a.noise(x, y)).toBe(b.noise(x, y));
      expect(a.fbm(x, y, 4)).toBe(b.fbm(x, y, 4));
      expect(a.ridged(x, y, 4)).toBe(b.ridged(x, y, 4));
    }
  });

  it('differs between seeds', () => {
    const a = new SimplexNoise2D(5);
    const b = new SimplexNoise2D(6);
    const differing = samplePoints.filter(([x, y]) => a.noise(x, y) !== b.noise(x, y));
    expect(differing.length).toBeGreaterThan(samplePoints.length / 2);
  });

  it('keeps raw noise within [-1, 1]', () => {
    const noise = new SimplexNoise2D(5);
    for (const [x, y] of samplePoints) {
      const v = noise.noise(x, y);
      expect(v).toBeGreaterThanOrEqual(-1.0001);
      expect(v).toBeLessThanOrEqual(1.0001);
    }
  });

  it('is exactly zero at lattice origin', () => {
    expect(new SimplexNoise2D(5).noise(0, 0)).toBeCloseTo(0, 12);
  });

  it('is continuous: nearby points give nearby values', () => {
    const noise = new SimplexNoise2D(5);
    for (const [x, y] of samplePoints) {
      expect(Math.abs(noise.noise(x, y) - noise.noise(x + 1e-4, y + 1e-4))).toBeLessThan(0.01);
    }
  });

  it('keeps fbm within [-1, 1] after normalisation', () => {
    const noise = new SimplexNoise2D(9);
    for (const [x, y] of samplePoints) {
      const v = noise.fbm(x, y, 4);
      expect(v).toBeGreaterThanOrEqual(-1.0001);
      expect(v).toBeLessThanOrEqual(1.0001);
    }
  });

  it('fbm with one octave equals the raw noise', () => {
    const noise = new SimplexNoise2D(9);
    expect(noise.fbm(3.3, -7.1, 1)).toBeCloseTo(noise.noise(3.3, -7.1), 12);
  });

  it('keeps ridged noise within [0, 1]', () => {
    const noise = new SimplexNoise2D(9);
    for (const [x, y] of samplePoints) {
      const v = noise.ridged(x, y, 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
