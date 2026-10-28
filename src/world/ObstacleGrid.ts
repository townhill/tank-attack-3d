import type { Obstacle } from './Obstacle';

/** Uniform-grid spatial index for broad-phase obstacle queries. */
export class ObstacleGrid {
  private readonly cols: number;
  private readonly cells: Obstacle[][];
  private readonly stamps: Uint32Array;
  private stamp = 0;

  constructor(
    private readonly halfSize: number,
    private readonly cellSize: number,
    obstacles: readonly Obstacle[],
  ) {
    this.cols = Math.ceil((halfSize * 2) / cellSize);
    this.cells = Array.from({ length: this.cols * this.cols }, () => []);
    let maxId = 0;
    for (const ob of obstacles) {
      maxId = Math.max(maxId, ob.id);
      this.forEachCell(ob.x - ob.boundRadius, ob.z - ob.boundRadius, ob.x + ob.boundRadius, ob.z + ob.boundRadius, (cell) => {
        cell.push(ob);
      });
    }
    this.stamps = new Uint32Array(maxId + 1);
  }

  private cellIndex(v: number): number {
    const c = Math.floor((v + this.halfSize) / this.cellSize);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  private forEachCell(minX: number, minZ: number, maxX: number, maxZ: number, fn: (cell: Obstacle[]) => void): void {
    const i0 = this.cellIndex(minX);
    const i1 = this.cellIndex(maxX);
    const j0 = this.cellIndex(minZ);
    const j1 = this.cellIndex(maxZ);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) fn(this.cells[j * this.cols + i]!);
    }
  }

  /**
   * Collects unique obstacles whose cells overlap the query rectangle into `out`
   * (cleared first). Returns `out` for convenience.
   */
  queryRect(minX: number, minZ: number, maxX: number, maxZ: number, out: Obstacle[]): Obstacle[] {
    out.length = 0;
    this.stamp = (this.stamp + 1) >>> 0;
    if (this.stamp === 0) {
      this.stamps.fill(0);
      this.stamp = 1;
    }
    const stamp = this.stamp;
    const i0 = this.cellIndex(minX);
    const i1 = this.cellIndex(maxX);
    const j0 = this.cellIndex(minZ);
    const j1 = this.cellIndex(maxZ);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        for (const ob of this.cells[j * this.cols + i]!) {
          if (this.stamps[ob.id] !== stamp) {
            this.stamps[ob.id] = stamp;
            out.push(ob);
          }
        }
      }
    }
    return out;
  }

  queryCircle(x: number, z: number, radius: number, out: Obstacle[]): Obstacle[] {
    return this.queryRect(x - radius, z - radius, x + radius, z + radius, out);
  }

  querySegment(ax: number, az: number, bx: number, bz: number, out: Obstacle[]): Obstacle[] {
    return this.queryRect(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), out);
  }
}
