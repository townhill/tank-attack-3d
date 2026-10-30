/**
 * A* search over the navigation grid: eight-connected without cutting
 * corners, with a cap on the cells one search may expand. The cell path is
 * pulled taut into a few waypoints wherever a straight run stays on walkable
 * cells, checked with an exact grid traversal.
 */
import { NAV } from '../config/settings';
import { MinHeap } from '../utils/heap';
import type { NavGrid } from '../world/NavGrid';

/** Most waypoints a route holds; a longer path keeps its first ones and is re-planned on arrival. */
const MAX_WAYPOINTS = 48;

const NEIGHBOURS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** A route as world waypoints, possibly ending in a bridge crossing. */
export class Route {
  readonly xs = new Float32Array(MAX_WAYPOINTS);
  readonly zs = new Float32Array(MAX_WAYPOINTS);
  count = 0;
  /** Bridge the route crosses, or -1. */
  bridgeId = -1;
  /** Index of the first waypoint of the crossing, where the tank lines up on the approach. */
  crossingStart = -1;
  /** Direction of travel along the deck: the sign of the change in `along`. */
  direction = 0;

  clear(): void {
    this.count = 0;
    this.bridgeId = -1;
    this.crossingStart = -1;
    this.direction = 0;
  }

  /** Appends a waypoint; false when the route is already full. */
  push(x: number, z: number): boolean {
    if (this.count >= MAX_WAYPOINTS) return false;
    this.xs[this.count] = x;
    this.zs[this.count] = z;
    this.count++;
    return true;
  }
}

export class PathFinder {
  /** Cells expanded by the last search. */
  lastExpanded = 0;
  private readonly g: Float64Array;
  private readonly parent: Int32Array;
  private readonly opened: Uint32Array;
  private readonly closed: Uint32Array;
  private readonly heap = new MinHeap(256);
  private readonly cells: number[] = [];
  private stamp = 0;

  constructor(private readonly nav: NavGrid, private readonly budget: number = NAV.searchBudget) {
    const n = nav.cols * nav.cols;
    this.g = new Float64Array(n);
    this.parent = new Int32Array(n);
    this.opened = new Uint32Array(n);
    this.closed = new Uint32Array(n);
  }

  /**
   * Cheapest walkable route from (sx, sz) to (gx, gz), smoothed into
   * waypoints written to `out` (the start itself is not included). Returns
   * true when the goal was reached; otherwise `out` holds a partial route
   * towards the cell found nearest the goal.
   */
  find(sx: number, sz: number, gx: number, gz: number, out: Route): boolean {
    out.clear();
    this.lastExpanded = 0;
    const nav = this.nav;
    const start = nav.nearestWalkableCell(sx, sz);
    const goal = nav.nearestWalkableCell(gx, gz);
    if (start < 0 || goal < 0) return false;

    const cols = nav.cols;
    const walkable = nav.walkable;
    const cost = nav.cost;
    const { g, parent, opened, closed, heap } = this;
    const stamp = this.nextStamp();
    const goalI = goal % cols;
    const goalJ = (goal - goalI) / cols;
    const heuristic = (k: number): number => {
      const i = k % cols;
      const di = Math.abs(i - goalI);
      const dj = Math.abs((k - i) / cols - goalJ);
      return nav.cellSize * (di + dj + (Math.SQRT2 - 2) * Math.min(di, dj));
    };

    heap.clear();
    g[start] = 0;
    parent[start] = -1;
    opened[start] = stamp;
    heap.push(start, heuristic(start));
    let best = start;
    let bestH = heuristic(start);
    let found = false;
    while (heap.size > 0) {
      const k = heap.pop();
      if (closed[k] === stamp) continue;
      closed[k] = stamp;
      if (k === goal) {
        found = true;
        break;
      }
      if (this.lastExpanded >= this.budget) break;
      this.lastExpanded++;
      const h = heuristic(k);
      if (h < bestH) {
        bestH = h;
        best = k;
      }
      const i = k % cols;
      const j = (k - i) / cols;
      for (const [di, dj, len] of NEIGHBOURS) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= cols) continue;
        const nk = nj * cols + ni;
        if (walkable[nk] !== 1 || closed[nk] === stamp) continue;
        if (di !== 0 && dj !== 0 && (walkable[j * cols + ni] !== 1 || walkable[nj * cols + i] !== 1)) continue;
        const next = g[k]! + len * nav.cellSize * 0.5 * (cost[k]! + cost[nk]!);
        if (opened[nk] === stamp && next >= g[nk]!) continue;
        opened[nk] = stamp;
        g[nk] = next;
        parent[nk] = k;
        heap.push(nk, next + heuristic(nk));
      }
    }

    const cells = this.cells;
    cells.length = 0;
    for (let k = found ? goal : best; k !== -1; k = parent[k]!) cells.push(k);
    cells.reverse();
    // A tank pressed against water or an obstacle starts by backing onto the nearest walkable cell.
    let ax = sx;
    let az = sz;
    if (nav.cellAt(sx, sz) !== start) {
      ax = nav.cellX(start);
      az = nav.cellZ(start);
      out.push(ax, az);
    }
    // A route cut short at its waypoint limit is only partial, however the search ended.
    if (!this.smooth(ax, az, out)) return false;
    // Finish on the goal itself when it lies on walkable ground.
    if (found && nav.cellAt(gx, gz) === goal) {
      if (out.count > 0 && cells.length > 1) {
        out.xs[out.count - 1] = gx;
        out.zs[out.count - 1] = gz;
      } else {
        out.push(gx, gz);
      }
    }
    return found;
  }

  private nextStamp(): number {
    this.stamp = (this.stamp + 1) >>> 0;
    if (this.stamp === 0) {
      this.opened.fill(0);
      this.closed.fill(0);
      this.stamp = 1;
    }
    return this.stamp;
  }

  /**
   * Pulls the cell path taut: from each waypoint, on to the farthest cell
   * reachable in a straight run. False when the route ran out of waypoints.
   */
  private smooth(sx: number, sz: number, out: Route): boolean {
    const nav = this.nav;
    const cells = this.cells;
    let ax = sx;
    let az = sz;
    let i = 0;
    while (i < cells.length - 1) {
      let j = i + 1;
      while (j + 1 < cells.length && this.lineWalkable(ax, az, nav.cellX(cells[j + 1]!), nav.cellZ(cells[j + 1]!))) j++;
      ax = nav.cellX(cells[j]!);
      az = nav.cellZ(cells[j]!);
      if (!out.push(ax, az)) return false;
      i = j;
    }
    return true;
  }

  /** True when every cell the segment A->B passes through is walkable (an exact grid traversal). */
  private lineWalkable(ax: number, az: number, bx: number, bz: number): boolean {
    const nav = this.nav;
    const cols = nav.cols;
    const size = nav.cellSize;
    const min = nav.minX;
    const walkable = nav.walkable;
    const open = (ci: number, cj: number): boolean => ci >= 0 && cj >= 0 && ci < cols && cj < cols && walkable[cj * cols + ci] === 1;
    let i = Math.floor((ax - min) / size);
    let j = Math.floor((az - min) / size);
    const ti = Math.floor((bx - min) / size);
    const tj = Math.floor((bz - min) / size);
    const dx = bx - ax;
    const dz = bz - az;
    const stepI = dx > 0 ? 1 : -1;
    const stepJ = dz > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? size / Math.abs(dx) : Infinity;
    const tDeltaZ = dz !== 0 ? size / Math.abs(dz) : Infinity;
    let tMaxX = dx !== 0 ? (stepI > 0 ? min + (i + 1) * size - ax : ax - (min + i * size)) / Math.abs(dx) : Infinity;
    let tMaxZ = dz !== 0 ? (stepJ > 0 ? min + (j + 1) * size - az : az - (min + j * size)) / Math.abs(dz) : Infinity;
    for (let guard = 0; guard <= 4 * cols; guard++) {
      if (!open(i, j)) return false;
      if (i === ti && j === tj) return true;
      if (tMaxX < tMaxZ) {
        tMaxX += tDeltaX;
        i += stepI;
      } else if (tMaxZ < tMaxX) {
        tMaxZ += tDeltaZ;
        j += stepJ;
      } else {
        // Exactly through a corner: both cells beside it must be open too.
        if (!open(i + stepI, j) || !open(i, j + stepJ)) return false;
        tMaxX += tDeltaX;
        tMaxZ += tDeltaZ;
        i += stepI;
        j += stepJ;
      }
    }
    return false;
  }
}
