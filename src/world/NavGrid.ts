/**
 * Coarse navigation grid over the playable square. Cells where the largest
 * tank can stand clear of blocked water (and of obstacles, when given) are
 * walkable, at a travel cost raised on steep ground and in shallow water.
 * Walkable cells form banks, which rivers keep apart, and regions, in which
 * crossings join banks. Each bridge and each ford is a portal between the
 * ground beyond its two ends; the shallows of a ford are left out of the
 * banks, so the river still parts them there and routes cross it on purpose.
 */
import type { Bridge } from './Bridge';
import { circleVsObstacle, createPushResult } from './Collision';
import type { PlanarVector } from './distanceField';
import { FORD_TAPER } from './FordPlacer';
import type { Obstacle } from './Obstacle';
import { toWorldX, toWorldZ } from './Obstacle';
import type { Terrain } from './Terrain';
import type { Ford, WaterMap } from './Water';

/** Grid cell size (metres). */
export const NAV_CELL_SIZE = 10;
/** Distance from blocked water a cell centre needs to be walkable: the largest tank radius plus a little. */
const WALK_CLEARANCE = 5;
/** Clearance around obstacles within which cell centres are unwalkable (metres). */
const OBSTACLE_CLEARANCE = 4;
/** Ground steeper than this is avoided by steering, so routes avoid it too, at this cost. */
const STEEP_SLOPE = 0.42;
const STEEP_COST = 6;
/** Cost of a cell in shallow water. */
const WADING_COST = 3;
/** How far beyond each deck end a bridge joins the ground (metres). */
export const BRIDGE_LINK_OFFSET = 6;
/** How far beyond the river's edge on each bank a ford joins the ground (metres). */
export const FORD_LINK_OFFSET = 8;
/** Cells searched on each side when a point falls on an unwalkable cell: enough to reach land from mid-span on the longest bridge. */
const SNAP_CELLS = 5;
/** Spacing of the samples along a straight line checked for water, and along a goal projected onto a bank (metres). */
const LINE_STEP = 2.5;

/** Ground the navigation grid takes into account besides water. */
export interface NavSurroundings {
  readonly terrain: Terrain;
  readonly obstacles: readonly Obstacle[];
}

/** Where a crossing meets the ground beyond one of its ends. */
export interface PortalEnd {
  /** Sign of `along` at this end of a bridge deck, or of the offset across the river at this bank of a ford. */
  readonly sign: number;
  /** World position of the link point on the approach. */
  readonly x: number;
  readonly z: number;
  /** Nearest walkable cell to it, and the bank that cell is on. */
  readonly cell: number;
  readonly side: number;
}

/** A river crossing: a bridge or a ford. */
export interface Portal {
  /** Bridge crossed, or -1 at a ford. */
  readonly bridgeId: number;
  /** Ford waded, or -1 on a bridge. */
  readonly fordId: number;
  /** Distance between the two ends (metres). */
  readonly length: number;
  /** The ends with `sign` +1 and -1. */
  readonly ends: readonly [PortalEnd, PortalEnd];
}

const pushScratch = createPushResult();

export class NavGrid {
  readonly cols: number;
  readonly minX: number;
  /** 1 where a tank can stand, row-major from the north-west corner. */
  readonly walkable: Uint8Array;
  /** 1 where the ground is clear of blocked water; obstacles do not count, so they never split a bank. */
  private readonly open: Uint8Array;
  /** Travel cost per metre through each cell; 0 where unwalkable. */
  readonly cost: Float32Array;
  /** Bank id per cell (bridges ignored), or -1 where unwalkable. */
  readonly side: Int32Array;
  /** Region id per cell (banks joined by bridges), or -1 where unwalkable. */
  readonly region: Int32Array;
  readonly portals: readonly Portal[];
  private readonly fords: readonly Ford[];
  private readonly regionSizes = new Map<number, number>();
  private readonly openCount: number;

  constructor(
    readonly playableHalfSize: number,
    readonly water: WaterMap,
    bridges: readonly Bridge[],
    surroundings: NavSurroundings | null = null,
    readonly cellSize: number = NAV_CELL_SIZE,
    fords: readonly Ford[] = [],
  ) {
    const cols = Math.ceil((2 * playableHalfSize) / cellSize);
    this.cols = cols;
    this.minX = -playableHalfSize;
    this.fords = fords;
    this.walkable = new Uint8Array(cols * cols);
    this.cost = new Float32Array(cols * cols);
    for (let j = 0; j < cols; j++) {
      for (let i = 0; i < cols; i++) {
        const x = this.centre(i);
        const z = this.centre(j);
        if (water.blockedDistance(x, z) > WALK_CLEARANCE && this.fordAt(x, z) < 0) this.walkable[j * cols + i] = 1;
      }
    }
    this.open = this.walkable.slice();
    if (surroundings) this.blockObstacles(surroundings.obstacles);
    let count = 0;
    for (let k = 0; k < this.walkable.length; k++) {
      if (this.open[k] === 1) count++;
      if (this.walkable[k] !== 1) continue;
      const i = k % cols;
      const x = this.centre(i);
      const z = this.centre((k - i) / cols);
      let c = 1;
      if (surroundings && surroundings.terrain.slopeAt(x, z, 3) > STEEP_SLOPE) c *= STEEP_COST;
      if (water.depthAt(x, z) > 0) c *= WADING_COST;
      this.cost[k] = c;
    }
    this.openCount = count;

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
    // Banks are shaped by water alone. Orthogonal neighbours suffice: a diagonal step is only
    // allowed when both sides are open anyway.
    for (let j = 0; j < cols; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        if (this.open[k] !== 1) continue;
        if (i + 1 < cols && this.open[k + 1] === 1) union(k, k + 1);
        if (j + 1 < cols && this.open[k + cols] === 1) union(k, k + cols);
      }
    }
    this.side = new Int32Array(cols * cols);
    for (let k = 0; k < parent.length; k++) this.side[k] = this.open[k] === 1 ? find(k) : -1;

    const portals: Portal[] = [];
    bridges.forEach((b, bridgeId) => {
      const plus = this.portalEnd(b, 1);
      const minus = this.portalEnd(b, -1);
      if (!plus || !minus) return;
      union(plus.cell, minus.cell);
      portals.push({ bridgeId, fordId: -1, length: 2 * b.halfLength, ends: [plus, minus] });
    });
    fords.forEach((f, fordId) => {
      const plus = this.fordEnd(f, 1);
      const minus = this.fordEnd(f, -1);
      if (!plus || !minus) return;
      union(plus.cell, minus.cell);
      portals.push({ bridgeId: -1, fordId, length: 2 * (f.halfWidth + FORD_LINK_OFFSET), ends: [plus, minus] });
    });
    this.portals = portals;

    this.region = new Int32Array(cols * cols);
    for (let k = 0; k < parent.length; k++) {
      if (this.open[k] !== 1) {
        this.region[k] = -1;
        continue;
      }
      const root = find(k);
      this.region[k] = root;
      this.regionSizes.set(root, (this.regionSizes.get(root) ?? 0) + 1);
    }
  }

  /**
   * Ford whose shallows (x, z) lies in, or -1: within the river's width of
   * its centreline, along the shallow stretch and the slope beyond each end.
   */
  fordAt(x: number, z: number): number {
    for (let k = 0; k < this.fords.length; k++) {
      const f = this.fords[k]!;
      const dx = x - f.x;
      const dz = z - f.z;
      const along = dx * f.tx + dz * f.tz;
      const across = dz * f.tx - dx * f.tz;
      if (Math.abs(across) <= f.halfWidth && Math.abs(along) <= f.halfLength + FORD_TAPER + this.cellSize) return k;
    }
    return -1;
  }

  /** Fraction of all ground clear of water that belongs to `region`. */
  regionShare(region: number): number {
    return this.openCount > 0 ? (this.regionSizes.get(region) ?? 0) / this.openCount : 0;
  }

  /** World X of the centre of cell `k`. */
  cellX(k: number): number {
    return this.centre(k % this.cols);
  }

  /** World Z of the centre of cell `k`. */
  cellZ(k: number): number {
    return this.centre(Math.floor(k / this.cols));
  }

  /** Cell under (x, z), or -1 off the playable square. */
  cellAt(x: number, z: number): number {
    const limit = this.playableHalfSize;
    if (Math.abs(x) > limit || Math.abs(z) > limit) return -1;
    const last = this.cols - 1;
    const i = Math.min(last, Math.floor((x - this.minX) / this.cellSize));
    const j = Math.min(last, Math.floor((z - this.minX) / this.cellSize));
    return j * this.cols + i;
  }

  /** True when the cell under (x, z) is walkable. */
  isWalkable(x: number, z: number): boolean {
    const k = this.cellAt(x, z);
    return k >= 0 && this.walkable[k] === 1;
  }

  /**
   * Walkable cell under (x, z), or the nearest walkable cell close by when
   * that one is not (a point on a bridge deck or in a shallow margin, say);
   * -1 when there is none or the point is off the battlefield.
   */
  nearestWalkableCell(x: number, z: number): number {
    return this.nearestCell(x, z, this.walkable);
  }

  /** Cell under (x, z) when `mask` marks it, else the nearest marked cell close by, or -1. */
  private nearestCell(x: number, z: number, mask: Uint8Array): number {
    const k = this.cellAt(x, z);
    if (k < 0 || mask[k] === 1) return k;
    const cols = this.cols;
    const ci = k % cols;
    const cj = (k - ci) / cols;
    let best = -1;
    let bestDistSq = Infinity;
    for (let j = Math.max(0, cj - SNAP_CELLS); j <= Math.min(cols - 1, cj + SNAP_CELLS); j++) {
      for (let i = Math.max(0, ci - SNAP_CELLS); i <= Math.min(cols - 1, ci + SNAP_CELLS); i++) {
        const n = j * cols + i;
        if (mask[n] !== 1) continue;
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

  /** Region of the ground at (x, z), snapping to the nearest ground clear of water; -1 when there is none. */
  regionAt(x: number, z: number): number {
    const k = this.nearestCell(x, z, this.open);
    return k >= 0 ? this.region[k]! : -1;
  }

  /** Bank of the ground at (x, z), snapping to the nearest ground clear of water; -1 when there is none. */
  sideAt(x: number, z: number): number {
    const k = this.nearestCell(x, z, this.open);
    return k >= 0 ? this.side[k]! : -1;
  }

  /** True when a straight drive from A to B keeps its centre at least `clearance` from water a tank cannot enter. */
  isWaterClear(ax: number, az: number, bx: number, bz: number, clearance: number): boolean {
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / LINE_STEP));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      if (this.water.blockedDistance(ax + (bx - ax) * t, az + (bz - az) * t) < clearance) return false;
    }
    return true;
  }

  /**
   * The point nearest (gx, gz), on the straight line back towards (fx, fz),
   * that lies on bank `side`. Writes it into `out` and returns true; when no
   * point on the line qualifies, writes (fx, fz) and returns false.
   */
  projectToSide(gx: number, gz: number, fx: number, fz: number, side: number, out: PlanarVector): boolean {
    const steps = Math.max(1, Math.ceil(Math.hypot(fx - gx, fz - gz) / LINE_STEP));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = gx + (fx - gx) * t;
      const z = gz + (fz - gz) * t;
      const k = this.cellAt(x, z);
      if (k >= 0 && this.side[k] === side) {
        out.x = x;
        out.z = z;
        return true;
      }
    }
    out.x = fx;
    out.z = fz;
    return false;
  }

  private centre(index: number): number {
    return this.minX + (index + 0.5) * this.cellSize;
  }

  private blockObstacles(obstacles: readonly Obstacle[]): void {
    const cols = this.cols;
    const last = cols - 1;
    const index = (v: number): number => Math.max(0, Math.min(last, Math.floor((v - this.minX) / this.cellSize)));
    for (const ob of obstacles) {
      const reach = ob.boundRadius + OBSTACLE_CLEARANCE;
      for (let j = index(ob.z - reach); j <= index(ob.z + reach); j++) {
        for (let i = index(ob.x - reach); i <= index(ob.x + reach); i++) {
          if (circleVsObstacle(this.centre(i), this.centre(j), OBSTACLE_CLEARANCE, ob, pushScratch)) this.walkable[j * cols + i] = 0;
        }
      }
    }
  }

  /** The bank of ford `f` on the `sign` side of the river, across its middle. */
  private fordEnd(f: Ford, sign: number): PortalEnd | null {
    const reach = sign * (f.halfWidth + FORD_LINK_OFFSET);
    const x = f.x - f.tz * reach;
    const z = f.z + f.tx * reach;
    const cell = this.nearestWalkableCell(x, z);
    return cell >= 0 ? { sign, x, z, cell, side: this.side[cell]! } : null;
  }

  private portalEnd(b: Bridge, sign: number): PortalEnd | null {
    const along = sign * (b.halfLength + BRIDGE_LINK_OFFSET);
    const x = b.x + toWorldX(0, along, b.yaw);
    const z = b.z + toWorldZ(0, along, b.yaw);
    const cell = this.nearestWalkableCell(x, z);
    return cell >= 0 ? { sign, x, z, cell, side: this.side[cell]! } : null;
  }
}
