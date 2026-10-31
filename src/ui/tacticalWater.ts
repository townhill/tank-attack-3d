/**
 * Water features on the tactical map and radar: bridges drawn with the
 * standard bridge sign, fords with dashed lines across the river, and an
 * index of shoreline segments so the radar can draw the banks near the
 * player each frame without scanning the whole map.
 */
import { PARAPET_THICKNESS } from '../world/Bridge';
import { shorelineSegments } from '../world/shoreline';
import type { Ford } from '../world/Water';
import type { World } from '../world/World';
import type { MapProjection } from './MapProjection';
import type { TacticalTheme } from './tacticalTheme';
import { drawBridgeSymbol, drawFordSymbol } from './tacticalTheme';

/** Cell size of the shoreline index (metres). */
const SHORE_CELL = 50;
/** Smallest bridge sign drawn, as half its length and half its width (px). */
const MIN_HALF_LENGTH_PX = 5;
const MIN_HALF_WIDTH_PX = 2;
/** A ford sign reaches this far beyond each bank of the river (metres). */
export const FORD_BANK_REACH = 4;

/** Shoreline segments bucketed by the grid cell of their midpoints. */
export class ShorelineIndex {
  private readonly cols: number;
  private readonly half: number;
  private readonly cells: number[][];

  constructor(world: World) {
    this.half = world.terrain.halfSize;
    this.cols = Math.max(1, Math.ceil((2 * this.half) / SHORE_CELL));
    this.cells = Array.from({ length: this.cols * this.cols }, () => []);
    if (world.water.maxLevel === -Infinity) return;
    const segments = shorelineSegments(world.terrain, world.water.level, 0);
    for (let k = 0; k < segments.length; k += 6) {
      const x0 = segments[k]!;
      const z0 = segments[k + 2]!;
      const x1 = segments[k + 3]!;
      const z1 = segments[k + 5]!;
      this.cells[this.cell((x0 + x1) / 2) + this.cell((z0 + z1) / 2) * this.cols]!.push(x0, z0, x1, z1);
    }
  }

  /**
   * Shoreline segments in the cells within `radius` of (x, z), as flat
   * [x0, z0, x1, z1, ...] written to `out` (cleared first). Returns `out`.
   */
  query(x: number, z: number, radius: number, out: number[]): number[] {
    out.length = 0;
    const i0 = this.cell(x - radius);
    const i1 = this.cell(x + radius);
    const j0 = this.cell(z - radius);
    const j1 = this.cell(z + radius);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        for (const v of this.cells[j * this.cols + i]!) out.push(v);
      }
    }
    return out;
  }

  private cell(v: number): number {
    const c = Math.floor((v + this.half) / SHORE_CELL);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }
}

/** Draws every bridge in view on the tactical map with the bridge sign. */
export function drawMapBridges(ctx: CanvasRenderingContext2D, theme: TacticalTheme, world: World, projection: MapProjection, cullMargin: number): void {
  const p = projection;
  for (const b of world.bridges) {
    const x = p.worldToMapX(b.x);
    const y = p.worldToMapY(b.z);
    const halfLength = Math.max(MIN_HALF_LENGTH_PX, b.halfLength * p.scale);
    if (x < -cullMargin - halfLength || y < -cullMargin - halfLength || x > p.width + cullMargin + halfLength || y > p.height + cullMargin + halfLength) continue;
    drawBridgeSymbol(ctx, theme, x, y, halfLength, Math.max(MIN_HALF_WIDTH_PX, (b.halfWidth + PARAPET_THICKNESS) * p.scale), b.yaw);
  }
}

/** Draws every ford in view on the tactical map: the ford sign across the river, the smallest sign kept readable. */
export function drawMapFords(ctx: CanvasRenderingContext2D, theme: TacticalTheme, world: World, projection: MapProjection, cullMargin: number): void {
  const p = projection;
  for (const f of world.fords) {
    const x = p.worldToMapX(f.x);
    const y = p.worldToMapY(f.z);
    const halfAcross = Math.max(MIN_HALF_LENGTH_PX, (f.halfWidth + FORD_BANK_REACH) * p.scale);
    if (x < -cullMargin - halfAcross || y < -cullMargin - halfAcross || x > p.width + cullMargin + halfAcross || y > p.height + cullMargin + halfAcross) continue;
    drawFordSymbol(ctx, theme, x, y, halfAcross, Math.max(MIN_HALF_WIDTH_PX, f.halfLength * p.scale), fordSignAngle(f));
  }
}

/** Turn of a ford's sign, as for a bridge deck: the crossing runs square to the flow, along (-tz, tx). */
export function fordSignAngle(f: Ford): number {
  return Math.atan2(-f.tz, -f.tx);
}
