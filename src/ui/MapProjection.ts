/**
 * Pure 2D maths for the tactical map and radar (no DOM access).
 *
 * Map space is north-up in CSS pixels: world -Z is screen up, +X is screen
 * right. View-space helpers for the radar use x right / y down in metres,
 * rotated so that a chosen compass heading points up.
 */
import { clamp, TAU, wrapAngle } from '../utils/math';

/** Smallest scale the projection accepts, guarding against division by zero. */
const MIN_SAFE_SCALE = 1e-6;
const NICE_STEPS = [5, 2, 1] as const;
/** Grid columns are lettered A..Z, so at most 26 divisions are supported. */
const MAX_GRID_DIVISIONS = 26;
const LETTER_A = 65;

export class MapProjection {
  width: number;
  height: number;
  centerX: number;
  centerZ: number;
  scale: number;

  constructor(width: number, height: number, centerX: number, centerZ: number, scale: number) {
    if (!(scale > 0) || !Number.isFinite(scale)) throw new RangeError(`MapProjection scale must be positive, got ${scale}`);
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
    this.centerX = centerX;
    this.centerZ = centerZ;
    this.scale = scale;
  }

  worldToMapX(x: number): number {
    return this.width / 2 + (x - this.centerX) * this.scale;
  }

  worldToMapY(z: number): number {
    return this.height / 2 + (z - this.centerZ) * this.scale;
  }

  mapToWorldX(px: number): number {
    return this.centerX + (px - this.width / 2) / this.scale;
  }

  mapToWorldZ(py: number): number {
    return this.centerZ + (py - this.height / 2) / this.scale;
  }

  /** Changes the viewport size; the world point at the view centre is kept. */
  resize(width: number, height: number): void {
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
  }

  /** Zoom by factor keeping the world point under (px, py) fixed; clamps scale to [minScale, maxScale]. */
  zoomAt(px: number, py: number, factor: number, minScale: number, maxScale: number): void {
    if (!(factor > 0) || !Number.isFinite(factor)) return;
    const worldX = this.mapToWorldX(px);
    const worldZ = this.mapToWorldZ(py);
    const lo = Math.max(MIN_SAFE_SCALE, Math.min(minScale, maxScale));
    const hi = Math.max(lo, maxScale);
    this.scale = clamp(this.scale * factor, lo, hi);
    this.centerX = worldX - (px - this.width / 2) / this.scale;
    this.centerZ = worldZ - (py - this.height / 2) / this.scale;
  }

  /** Moves the view so the map content follows a pointer drag of (dx, dy) pixels. */
  panByPixels(dx: number, dy: number): void {
    this.centerX -= dx / this.scale;
    this.centerZ -= dy / this.scale;
  }

  /** Keeps the view centre within +-limit metres on both axes. */
  clampCenter(limit: number): void {
    const l = Math.max(0, limit);
    this.centerX = clamp(this.centerX, -l, l);
    this.centerZ = clamp(this.centerZ, -l, l);
  }
}

/** Scale (px per metre) at which a square of half-size `halfExtent` fits the viewport with `padding` px spare. */
export function fitScale(width: number, height: number, halfExtent: number, padding = 0): number {
  const available = Math.min(width, height) - 2 * padding;
  if (!(available > 0) || !(halfExtent > 0)) return MIN_SAFE_SCALE;
  return Math.max(MIN_SAFE_SCALE, available / (2 * halfExtent));
}

/** Zero-based grid cell index of coordinate `v` across [-halfSize, halfSize], clamped to the edge cells. */
export function gridIndex(v: number, halfSize: number, divisions: number): number {
  const index = Math.floor(((v + halfSize) / (2 * halfSize)) * divisions);
  if (Number.isNaN(index)) return 0;
  return index < 0 ? 0 : index >= divisions ? divisions - 1 : index;
}

/** Column letter for a zero-based grid column (0 = 'A'). */
export function gridColumnLetter(column: number): string {
  return String.fromCharCode(LETTER_A + clamp(Math.floor(column), 0, MAX_GRID_DIVISIONS - 1));
}

/**
 * Grid reference like "C7": columns A.. west->east, rows 1.. north->south,
 * `divisions` cells across the square of half-size `halfSize`. Out-of-range
 * positions clamp to the edge cell.
 */
export function gridLabel(x: number, z: number, halfSize: number, divisions = 10): string {
  const n = clamp(Math.floor(divisions), 1, MAX_GRID_DIVISIONS);
  return gridColumnLetter(gridIndex(x, halfSize, n)) + String(gridIndex(z, halfSize, n) + 1);
}

/** A 'nice' scale-bar length in metres (1/2/5 x 10^n) whose pixel length is <= maxPixels. Returns 0 for invalid input. */
export function niceScaleLength(scale: number, maxPixels: number): number {
  if (!(scale > 0) || !(maxPixels > 0)) return 0;
  const maxMetres = maxPixels / scale;
  if (!Number.isFinite(maxMetres)) return 0;
  let magnitude = Math.pow(10, Math.floor(Math.log10(maxMetres)));
  // Correct for log10 rounding either side of an exact power of ten.
  if (magnitude > maxMetres) magnitude /= 10;
  else if (magnitude * 10 <= maxMetres) magnitude *= 10;
  for (const step of NICE_STEPS) {
    const length = step * magnitude;
    if (length <= maxMetres) return length;
  }
  return magnitude;
}

/** Short distance label: "250 m", "1 km", "1.5 km". */
export function formatDistance(metres: number): string {
  if (metres >= 1000) return `${Number((metres / 1000).toFixed(1))} km`;
  return `${Number(metres.toFixed(metres < 10 ? 1 : 0))} m`;
}

/** Mutable 2D point used as an allocation-free out parameter. */
export interface Point2 {
  x: number;
  y: number;
}

/**
 * Rotates a world offset (dx, dz) into view space (x right, y down, metres)
 * for a view whose up direction is the compass heading `upHeading`.
 */
export function rotateToView(dx: number, dz: number, upHeading: number, out: Point2): Point2 {
  const c = Math.cos(upHeading);
  const s = Math.sin(upHeading);
  out.x = dx * c + dz * s;
  out.y = -dx * s + dz * c;
  return out;
}

/** Screen rotation (radians clockwise from up) of a compass heading drawn in a view whose up is `upHeading`. */
export function viewAngle(heading: number, upHeading: number): number {
  return wrapAngle(heading - upHeading);
}

/** Angle clockwise from screen up of the view-space vector (x, y). */
export function bearingOf(x: number, y: number): number {
  return Math.atan2(x, -y);
}

/** Pulls `p` back onto the circle of `radius` when it lies outside. Returns true when it was clamped. */
export function clampToRadius(p: Point2, radius: number): boolean {
  const lengthSq = p.x * p.x + p.y * p.y;
  if (lengthSq <= radius * radius) return false;
  const k = radius / Math.sqrt(lengthSq);
  p.x *= k;
  p.y *= k;
  return true;
}

/**
 * Fraction of a revolution (0..1) since a clockwise sweep now at `sweepAngle`
 * last passed `angle`; both are measured clockwise from screen up.
 */
export function sweepLag(angle: number, sweepAngle: number): number {
  let d = (sweepAngle - angle) % TAU;
  if (d < 0) d += TAU;
  return d / TAU;
}
