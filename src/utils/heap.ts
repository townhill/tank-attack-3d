/**
 * Binary min-heap of integer ids keyed by number, for shortest-path searches.
 * An id may be pushed more than once; callers skip stale entries by comparing
 * `peekKey()` with their own best-known cost before popping.
 */
export class MinHeap {
  private ids: Int32Array;
  private keys: Float64Array;
  private count = 0;

  constructor(capacity = 64) {
    this.ids = new Int32Array(Math.max(1, capacity));
    this.keys = new Float64Array(Math.max(1, capacity));
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.count = 0;
  }

  push(id: number, key: number): void {
    if (this.count === this.ids.length) this.grow();
    let i = this.count++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent]! <= key) break;
      this.ids[i] = this.ids[parent]!;
      this.keys[i] = this.keys[parent]!;
      i = parent;
    }
    this.ids[i] = id;
    this.keys[i] = key;
  }

  /** Smallest key in the heap; Infinity when empty. */
  peekKey(): number {
    return this.count > 0 ? this.keys[0]! : Infinity;
  }

  /** Removes and returns the id with the smallest key; -1 when empty. */
  pop(): number {
    if (this.count === 0) return -1;
    const top = this.ids[0]!;
    const n = --this.count;
    const id = this.ids[n]!;
    const key = this.keys[n]!;
    let i = 0;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= n) break;
      if (child + 1 < n && this.keys[child + 1]! < this.keys[child]!) child++;
      if (this.keys[child]! >= key) break;
      this.ids[i] = this.ids[child]!;
      this.keys[i] = this.keys[child]!;
      i = child;
    }
    this.ids[i] = id;
    this.keys[i] = key;
    return top;
  }

  private grow(): void {
    const ids = new Int32Array(this.ids.length * 2);
    const keys = new Float64Array(this.keys.length * 2);
    ids.set(this.ids);
    keys.set(this.keys);
    this.ids = ids;
    this.keys = keys;
  }
}
