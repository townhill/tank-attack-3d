import { describe, expect, it } from 'vitest';
import { MinHeap } from '../src/utils/heap';
import { Random } from '../src/utils/random';

describe('MinHeap', () => {
  it('pops ids in ascending key order, growing past its initial capacity', () => {
    const heap = new MinHeap(2);
    const rng = new Random(3);
    const keys = Array.from({ length: 200 }, () => rng.range(-50, 50));
    keys.forEach((key, id) => {
      heap.push(id, key);
    });
    expect(heap.size).toBe(200);
    let previous = -Infinity;
    while (heap.size > 0) {
      const key = heap.peekKey();
      const id = heap.pop();
      expect(keys[id]).toBe(key);
      expect(key).toBeGreaterThanOrEqual(previous);
      previous = key;
    }
  });

  it('reports an empty heap', () => {
    const heap = new MinHeap();
    expect(heap.pop()).toBe(-1);
    expect(heap.peekKey()).toBe(Infinity);
    heap.push(4, 1);
    heap.clear();
    expect(heap.size).toBe(0);
  });

  it('keeps repeated ids as separate entries', () => {
    const heap = new MinHeap();
    heap.push(7, 5);
    heap.push(7, 2);
    expect(heap.pop()).toBe(7);
    expect(heap.peekKey()).toBe(5);
  });
});
