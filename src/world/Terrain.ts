/**
 * Heightfield terrain. Height queries interpolate over exactly the same
 * triangles the renderer draws, so tanks and shells meet the visible surface.
 *
 * Each grid cell is split along the diagonal from (i, j) to (i + 1, j + 1).
 */
export class Terrain {
  /** Vertices per side. */
  readonly resolution: number;
  readonly heights: Float32Array;

  constructor(
    readonly halfSize: number,
    readonly cellSize: number,
    heights?: Float32Array,
  ) {
    const cells = Math.round((halfSize * 2) / cellSize);
    this.resolution = cells + 1;
    const expected = this.resolution * this.resolution;
    if (heights && heights.length !== expected) {
      throw new Error(`Terrain heights length ${heights.length} does not match ${expected}`);
    }
    this.heights = heights ?? new Float32Array(expected);
  }

  vertexX(i: number): number {
    return -this.halfSize + i * this.cellSize;
  }

  vertexZ(j: number): number {
    return -this.halfSize + j * this.cellSize;
  }

  index(i: number, j: number): number {
    return j * this.resolution + i;
  }

  vertexHeight(i: number, j: number): number {
    const n = this.resolution - 1;
    const ci = i < 0 ? 0 : i > n ? n : i;
    const cj = j < 0 ? 0 : j > n ? n : j;
    return this.heights[cj * this.resolution + ci]!;
  }

  /** Height of the rendered surface at world position (x, z). */
  heightAt(x: number, z: number): number {
    const gx = (x + this.halfSize) / this.cellSize;
    const gz = (z + this.halfSize) / this.cellSize;
    const max = this.resolution - 1;
    const cx = gx < 0 ? 0 : gx > max ? max : gx;
    const cz = gz < 0 ? 0 : gz > max ? max : gz;
    let i = Math.floor(cx);
    let j = Math.floor(cz);
    if (i >= max) i = max - 1;
    if (j >= max) j = max - 1;
    const fx = cx - i;
    const fz = cz - j;
    const h00 = this.vertexHeight(i, j);
    const h11 = this.vertexHeight(i + 1, j + 1);
    if (fx >= fz) {
      const h10 = this.vertexHeight(i + 1, j);
      return h00 + fx * (h10 - h00) + fz * (h11 - h10);
    }
    const h01 = this.vertexHeight(i, j + 1);
    return h00 + fz * (h01 - h00) + fx * (h11 - h01);
  }

  /**
   * Smoothed surface normal via central differences. Writes into `out`
   * (any object with x/y/z) and returns it, so callers can avoid allocation.
   */
  normalAt<T extends { x: number; y: number; z: number }>(x: number, z: number, out: T, sampleDistance = 2): T {
    const d = sampleDistance;
    const dhdx = (this.heightAt(x + d, z) - this.heightAt(x - d, z)) / (2 * d);
    const dhdz = (this.heightAt(x, z + d) - this.heightAt(x, z - d)) / (2 * d);
    const len = Math.sqrt(dhdx * dhdx + 1 + dhdz * dhdz);
    out.x = -dhdx / len;
    out.y = 1 / len;
    out.z = -dhdz / len;
    return out;
  }

  /** Gradient magnitude (rise over run) at (x, z). */
  slopeAt(x: number, z: number, sampleDistance = 2): number {
    const d = sampleDistance;
    const dhdx = (this.heightAt(x + d, z) - this.heightAt(x - d, z)) / (2 * d);
    const dhdz = (this.heightAt(x, z + d) - this.heightAt(x, z - d)) / (2 * d);
    return Math.sqrt(dhdx * dhdx + dhdz * dhdz);
  }

  minMax(): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (const h of this.heights) {
      if (h < min) min = h;
      if (h > max) max = h;
    }
    return { min, max };
  }
}
