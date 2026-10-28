/** Deterministic seeded pseudo-random number generator (mulberry32). */
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Random.pick called with an empty array');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Signed value in [-1, 1). */
  signed(): number {
    return this.next() * 2 - 1;
  }

  /** Approximately normal distribution (mean 0, sd 1) via Box-Muller. */
  gaussian(): number {
    const u = Math.max(this.next(), 1e-9);
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = result[i] as T;
      result[i] = result[j] as T;
      result[j] = tmp;
    }
    return result;
  }
}

/** Converts arbitrary text to a 32-bit seed (FNV-1a). */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
