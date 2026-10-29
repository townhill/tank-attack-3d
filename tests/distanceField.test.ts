import { describe, expect, it } from 'vitest';
import { Random } from '../src/utils/random';
import { DistanceField, FAR_DISTANCE } from '../src/world/distanceField';

/** Brute-force signed distance at cell centres, using the field's half-cell boundary convention. */
function bruteForce(mask: Uint8Array, cols: number, rows: number, cell: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const inside = mask[j * cols + i] === 1;
      let best = Infinity;
      for (let q = 0; q < rows; q++) {
        for (let p = 0; p < cols; p++) {
          if ((mask[q * cols + p] === 1) !== inside) best = Math.min(best, Math.hypot(p - i, q - j));
        }
      }
      const d = best * cell - cell / 2;
      out.push(inside ? -d : d);
    }
  }
  return out;
}

function randomMask(cols: number, rows: number, seed: number, density: number): Uint8Array {
  const rng = new Random(seed);
  const mask = new Uint8Array(cols * rows);
  for (let k = 0; k < mask.length; k++) mask[k] = rng.chance(density) ? 1 : 0;
  return mask;
}

describe('DistanceField.fromMask', () => {
  it.each([[3, 0.08], [9, 0.3], [21, 0.6]])('matches a brute-force signed distance on a random mask (seed %i)', (seed, density) => {
    const cols = 23;
    const rows = 17;
    const mask = randomMask(cols, rows, seed, density);
    const field = DistanceField.fromMask(mask, cols, rows, -10, 4, 2.5);
    const expected = bruteForce(mask, cols, rows, 2.5);
    expected.forEach((value, k) => {
      expect(field.values[k]).toBeCloseTo(value, 4);
    });
  });

  it('is far and positive everywhere when nothing is marked', () => {
    const field = DistanceField.fromMask(new Uint8Array(12), 4, 3, 0, 0, 1);
    for (const v of field.values) expect(v).toBe(FAR_DISTANCE);
  });

  it('is far and negative everywhere when everything is marked', () => {
    const field = DistanceField.fromMask(new Uint8Array(12).fill(1), 4, 3, 0, 0, 1);
    for (const v of field.values) expect(v).toBe(-FAR_DISTANCE);
  });

  it('puts the boundary halfway between a marked cell and its unmarked neighbour', () => {
    const mask = new Uint8Array([0, 0, 1, 1]);
    const field = DistanceField.fromMask(mask, 4, 1, 0, 0, 2);
    // Cell centres at x = 1, 3, 5, 7; the boundary is x = 4.
    expect(field.sample(4, 1)).toBeCloseTo(0, 9);
    expect(field.sample(1, 1)).toBeCloseTo(3, 9);
    expect(field.sample(7, 1)).toBeCloseTo(-3, 9);
  });

  it('rejects a value array that does not match the grid', () => {
    expect(() => new DistanceField(0, 0, 1, 3, 3, new Float32Array(8))).toThrow(/does not match/);
  });
});

describe('DistanceField sampling', () => {
  // A half-plane: everything with x > 20 is marked.
  const cols = 20;
  const rows = 10;
  const mask = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 10; i < cols; i++) mask[j * cols + i] = 1;
  const field = DistanceField.fromMask(mask, cols, rows, 0, 0, 2);

  it('returns the signed distance to the boundary and interpolates between cell centres', () => {
    for (const x of [3, 9.5, 14, 19, 20, 22.4, 31]) {
      expect(field.sample(x, 7)).toBeCloseTo(20 - x, 6);
    }
  });

  it('clamps outside the grid to the nearest edge cell', () => {
    expect(field.sample(-50, 7)).toBeCloseTo(field.sample(1, 7), 9);
    expect(field.sample(5, -40)).toBeCloseTo(field.sample(5, 1), 9);
  });

  it('gradient is a unit vector pointing away from the marked region', () => {
    const out = { x: 0, z: 0 };
    for (const x of [6, 18, 25]) {
      field.gradient(x, 9, out);
      expect(out.x).toBeCloseTo(-1, 6);
      expect(out.z).toBeCloseTo(0, 6);
    }
  });

  it('gradient falls back to a unit vector where the field is flat', () => {
    const flat = DistanceField.fromMask(new Uint8Array(9), 3, 3, 0, 0, 1);
    const out = flat.gradient(1.5, 1.5, { x: 0, z: 0 });
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(1, 9);
  });

  it('an empty field is far from everything', () => {
    expect(DistanceField.empty().sample(123, -456)).toBe(FAR_DISTANCE);
  });
});
