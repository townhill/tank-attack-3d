/**
 * Coarse walkability grid over the playable square. Cells where the largest
 * tank can stand clear of blocked water are joined into connected regions,
 * and every bridge links the ground beyond its two ends.
 */
import type { Bridge } from './Bridge';
import { toWorldX, toWorldZ } from './Obstacle';
import type { WaterMap } from './Water';

/** Grid cell size (metres). */
export const NAV_CELL_SIZE = 10;
/** Distance from blocked water a cell centre needs to be walkable: the largest tank radius plus a little. */
const WALK_CLEARANCE = 5;
/** How far beyond each deck end a bridge joins the ground (metres). */
const BRIDGE_LINK_OFFSET = 6;
/** Cells searched on each side when a point falls on an unwalkable cell: enough to reach land from mid-span on the longest bridge. */
const SNAP_CELLS = 5;

export class NavGrid {
  readonly cols: number;
  readonly minX: number;
  /** 1 where a tank can stand, row-major from the north-west corner. */
  readonly walkable: Uint8Array;
  /** Region id per cell, or -1 where unwalkable. */
  readonly region: Int32Array;
  private readonly regionSizes = new Map<number, number>();
  private readonly walkableCount: number;

  constructor(
    readonly playableHalfSize: number,
    water: WaterMap,
    bridges: readonly Bridge[],
    readonly cellSize: number = NAV_CELL_SIZE,
  ) {
    const cols = Math.ceil((2 * playableHalfSize) / cellSize);
    this.cols = cols;
    this.minX = -playableHalfSize;
    this.walkable = new Uint8Array(cols * cols);
    let count = 0;
    for (let j = 0; j < cols; j++) {
      for (let i = 0; i < cols; i++) {
        if (water.blockedDistance(this.centre(i), this.centre(j)) <= WALK_CLEARANCE) continue;
        this.walkable[j * cols + i] = 1;
        count++;
      }
    }
    this.walkableCount = count;

    const parent = new Int32Array(cols * cols);
    for (let k = 0; k < parent.length; k++) parent[k] = k;
    const find = (k: number): number => {
      let root = k;
      while (parent[root] !== root) {
        parent[root] = parent[parent[root]!]!;
        root = parent[root]!;
      }
      return root;
    };
    const union = (a: number, b: number): void => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
    };
    // Orthogonal neighbours suffice: a diagonal step is only allowed when both sides are open anyway.
    for (let j = 0; j < cols; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (this.walkable[k] !== 1) continue;
        if (i + 1 < cols && this.walkable[k + 1] === 1) union(k, k + 1);
        if (j + 1 < cols && this.walkable[k + cols] === 1) union(k, k + cols);
      }
    }
    for (const b of bridges) {
      const reach = b.halfLength + BRIDGE_LINK_OFFSET;
      const a = this.nearestWalkableCell(b.x + toWorldX(0, reach, b.yaw), b.z + toWorldZ(0, reach, b.yaw));
      const c = this.nearestWalkableCell(b.x + toWorldX(0, -reach, b.yaw), b.z + toWorldZ(0, -reach, b.yaw));
      if (a >= 0 && c >= 0) union(a, c);
    }

    this.region = new Int32Array(cols * cols);
    for (let k = 0; k < parent.length; k++) {
      if (this.walkable[k] !== 1) {
        this.region[k] = -1;
        continue;
      }
      const root = find(k);
      this.region[k] = root;
      this.regionSizes.set(root, (this.regionSizes.get(root) ?? 0) + 1);
    }
  }

  /** True when the cell under (x, z) is walkable. */
  isWalkable(x: number, z: number): boolean {
    const k = this.cellAt(x, z);
    return k >= 0 && this.walkable[k] === 1;
  }

  /**
   * Region of the ground at (x, z). A point on an unwalkable cell, such as a
   * bridge deck or a shallow margin, takes the region of the nearest walkable
   * cell close by; -1 when there is none or the point is off the battlefield.
   */
  regionAt(x: number, z: number): number {
    const k = this.nearestWalkableCell(x, z);
    return k >= 0 ? this.region[k]! : -1;
  }

  /** Fraction of all walkable cells that belong to `region`. */
  regionShare(region: number): number {
    return this.walkableCount > 0 ? (this.regionSizes.get(region) ?? 0) / this.walkableCount : 0;
  }

  private centre(index: number): number {
    return this.minX + (index + 0.5) * this.cellSize;
  }

  private cellAt(x: number, z: number): number {
    const limit = this.playableHalfSize;
    if (Math.abs(x) > limit || Math.abs(z) > limit) return -1;
    const last = this.cols - 1;
    const i = Math.min(last, Math.floor((x - this.minX) / this.cellSize));
    const j = Math.min(last, Math.floor((z - this.minX) / this.cellSize));
    return j * this.cols + i;
  }

  private nearestWalkableCell(x: number, z: number): number {
    const k = this.cellAt(x, z);
    if (k < 0 || this.walkable[k] === 1) return k;
    const cols = this.cols;
    const ci = k % cols;
    const cj = (k - ci) / cols;
    let best = -1;
    let bestDistSq = Infinity;
    for (let j = Math.max(0, cj - SNAP_CELLS); j <= Math.min(cols - 1, cj + SNAP_CELLS); j++) {
      for (let i = Math.max(0, ci - SNAP_CELLS); i <= Math.min(cols - 1, ci + SNAP_CELLS); i++) {
        const n = j * cols + i;
        if (this.walkable[n] !== 1) continue;
        const dx = this.centre(i) - x;
        const dz = this.centre(j) - z;
        const distSq = dx * dx + dz * dz;
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          best = n;
        }
      }
    }
    return best;
  }
}
