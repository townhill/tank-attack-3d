/**
 * Signed Euclidean distance field on a grid of square cells, sampled at cell
 * centres: negative inside the marked region, positive outside, and zero
 * halfway between a marked cell and its unmarked neighbour.
 */

/** Distance reported when the other region does not exist at all. */
export const FAR_DISTANCE = 1e6;
/** Stand-in for infinity inside the transform; finite so the arithmetic never yields NaN. */
const INF = 1e20;

export interface PlanarVector {
  x: number;
  z: number;
}

export class DistanceField {
  constructor(
    /** World X of the grid's west edge. */
    readonly minX: number,
    /** World Z of the grid's north edge. */
    readonly minZ: number,
    readonly cellSize: number,
    readonly cols: number,
    readonly rows: number,
    readonly values: Float32Array,
  ) {
    if (values.length !== cols * rows) {
      throw new Error(`Distance field values length ${values.length} does not match ${cols * rows}`);
    }
  }

  /** Builds the field from a row-major `cols` x `rows` mask in which 1 marks the region. */
  static fromMask(mask: Uint8Array, cols: number, rows: number, minX: number, minZ: number, cellSize: number): DistanceField {
    const toMarked = squaredDistances(mask, cols, rows, 1);
    const toClear = squaredDistances(mask, cols, rows, 0);
    const values = new Float32Array(cols * rows);
    const half = cellSize / 2;
    for (let k = 0; k < values.length; k++) {
      if (mask[k] === 1) {
        values[k] = toClear[k]! >= INF ? -FAR_DISTANCE : half - Math.sqrt(toClear[k]!) * cellSize;
      } else {
        values[k] = toMarked[k]! >= INF ? FAR_DISTANCE : Math.sqrt(toMarked[k]!) * cellSize - half;
      }
    }
    return new DistanceField(minX, minZ, cellSize, cols, rows, values);
  }

  /** A field with nothing marked anywhere. */
  static empty(): DistanceField {
    return new DistanceField(0, 0, 1, 1, 1, new Float32Array([FAR_DISTANCE]));
  }

  /** Bilinear sample between cell centres; points off the grid take the nearest edge value. */
  sample(x: number, z: number): number {
    const cols = this.cols;
    const rows = this.rows;
    const gx = (x - this.minX) / this.cellSize - 0.5;
    const gz = (z - this.minZ) / this.cellSize - 0.5;
    const cx = gx < 0 ? 0 : gx > cols - 1 ? cols - 1 : gx;
    const cz = gz < 0 ? 0 : gz > rows - 1 ? rows - 1 : gz;
    const i = Math.min(Math.floor(cx), Math.max(0, cols - 2));
    const j = Math.min(Math.floor(cz), Math.max(0, rows - 2));
    const i1 = Math.min(i + 1, cols - 1);
    const j1 = Math.min(j + 1, rows - 1);
    const fx = cx - i;
    const fz = cz - j;
    const v = this.values;
    const top = v[j * cols + i]! + (v[j * cols + i1]! - v[j * cols + i]!) * fx;
    const bottom = v[j1 * cols + i]! + (v[j1 * cols + i1]! - v[j1 * cols + i]!) * fx;
    return top + (bottom - top) * fz;
  }

  /**
   * Unit direction of steepest increase (away from the marked region), via
   * central differences. Writes into `out` and returns it.
   */
  gradient<T extends PlanarVector>(x: number, z: number, out: T): T {
    const h = this.cellSize;
    const dx = this.sample(x + h, z) - this.sample(x - h, z);
    const dz = this.sample(x, z + h) - this.sample(x, z - h);
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) {
      out.x = 1;
      out.z = 0;
    } else {
      out.x = dx / len;
      out.z = dz / len;
    }
    return out;
  }
}

/** Squared distance, in cells, from every cell to the nearest cell whose mask equals `target`. */
function squaredDistances(mask: Uint8Array, cols: number, rows: number, target: number): Float64Array {
  const grid = new Float64Array(cols * rows);
  for (let k = 0; k < grid.length; k++) grid[k] = mask[k] === target ? 0 : INF;
  const n = Math.max(cols, rows);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) f[j] = grid[j * cols + i]!;
    lowerEnvelope(f, rows, d, v, z);
    for (let j = 0; j < rows; j++) grid[j * cols + i] = d[j]!;
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) f[i] = grid[j * cols + i]!;
    lowerEnvelope(f, cols, d, v, z);
    for (let i = 0; i < cols; i++) grid[j * cols + i] = d[i]!;
  }
  return grid;
}

/**
 * One-dimensional distance transform (Felzenszwalb and Huttenlocher):
 * d[q] = min over p of (q - p)^2 + f[p], via the lower envelope of parabolas.
 */
function lowerEnvelope(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s: number;
    for (;;) {
      const p = v[k]!;
      s = (f[q]! + q * q - (f[p]! + p * p)) / (2 * q - 2 * p);
      if (s > z[k]!) break;
      k--;
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    const p = v[k]!;
    d[q] = (q - p) * (q - p) + f[p]!;
  }
}
