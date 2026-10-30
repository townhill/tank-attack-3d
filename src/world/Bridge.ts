/**
 * Road bridges that carry tanks over rivers: the deck's local frame and road
 * profile, the kerb constraint for tanks crossing, and the solid volume that
 * shells and sight lines collide with.
 */
import type { PushResult } from './Collision';
import { marchToSurface, NO_HIT, segmentVsAabb } from './Collision';
import { toLocalX, toLocalZ, toWorldX, toWorldZ } from './Obstacle';

/** Depth of the deck slab under the road (metres). */
export const DECK_THICKNESS = 1.1;
/** Parapet height above the road (metres). */
export const PARAPET_HEIGHT = 1;
/** Parapet thickness outside each kerb (metres). */
export const PARAPET_THICKNESS = 0.5;
/** Half a pier's thickness along the deck (metres). */
export const PIER_HALF_ALONG = 0.9;
/** How much narrower than the road a pier is on each side (metres). */
export const PIER_INSET = 1.2;

export interface Bridge {
  readonly id: number;
  /** River the bridge crosses. */
  readonly riverId: number;
  readonly x: number;
  readonly z: number;
  /** Compass heading of the deck's long axis (its local -Z), as for obstacles. */
  readonly yaw: number;
  /** Half the deck length, end to end, including the stretch resting on each bank. */
  readonly halfLength: number;
  /** Half the length over the river and its banks, where crossing tanks are held between the kerbs. */
  readonly halfSpan: number;
  /** Half the road width between the kerbs. */
  readonly halfWidth: number;
  /** Road height at both ends, where it meets the graded approaches. */
  readonly endY: number;
  /** Extra road height at mid-span. */
  readonly arch: number;
  /** Length of the earth ramp beyond each end of the deck. */
  readonly rampLength: number;
  /** Along-deck offsets of the piers. */
  readonly piers: readonly number[];
  /** Riverbed height the piers stand on. */
  readonly footY: number;
}

/** A point in a bridge's frame: `along` the deck axis and `lateral` across it. */
export interface BridgeLocal {
  along: number;
  lateral: number;
}

export function createBridgeLocal(): BridgeLocal {
  return { along: 0, lateral: 0 };
}

/** Converts world (x, z) into the bridge's frame. Writes into `out` and returns it. */
export function toBridgeLocal(b: Bridge, x: number, z: number, out: BridgeLocal): BridgeLocal {
  const dx = x - b.x;
  const dz = z - b.z;
  out.along = toLocalZ(dx, dz, b.yaw);
  out.lateral = toLocalX(dx, dz, b.yaw);
  return out;
}

/** Road height at `along`; beyond the deck it stays at the end height. */
export function deckHeightAt(b: Bridge, along: number): number {
  const u = along / b.halfLength;
  return u <= -1 || u >= 1 ? b.endY : b.endY + b.arch * (1 - u * u);
}

/** True on the road between the kerbs, optionally widened by `margin` on each side. */
export function isOnDeck(b: Bridge, local: BridgeLocal, margin = 0): boolean {
  return Math.abs(local.along) <= b.halfLength && Math.abs(local.lateral) <= b.halfWidth + margin;
}

/**
 * Keeps the centre of a tank of `radius` on the deck far enough from the
 * kerbs that its hull stays on the road, from one end of the deck to the
 * other. Writes the push and returns true when the centre has to move.
 */
export function kerbPush(b: Bridge, local: BridgeLocal, radius: number, out: PushResult): boolean {
  if (Math.abs(local.along) > b.halfLength) return false;
  const excess = Math.abs(local.lateral) - (b.halfWidth - radius);
  if (excess <= 0) return false;
  const side = local.lateral > 0 ? -1 : 1;
  out.nx = toWorldX(side, 0, b.yaw);
  out.nz = toWorldZ(side, 0, b.yaw);
  out.depth = excess;
  return true;
}

/**
 * Keeps a tank that is not on the deck outside the parapets, which run its
 * whole length: tanks get on and off a bridge only over its ends. A centre
 * already on the road is left alone, as it is joining the deck from an end.
 */
export function parapetPush(b: Bridge, local: BridgeLocal, radius: number, out: PushResult): boolean {
  if (Math.abs(local.along) > b.halfLength) return false;
  const lateral = Math.abs(local.lateral);
  const clear = b.halfWidth + PARAPET_THICKNESS + radius;
  if (lateral <= b.halfWidth || lateral >= clear) return false;
  const side = local.lateral > 0 ? 1 : -1;
  out.nx = toWorldX(side, 0, b.yaw);
  out.nz = toWorldZ(side, 0, b.yaw);
  out.depth = clear - lateral;
  return true;
}

/** Radius of a circle around the bridge centre that encloses its footprint. */
export function bridgeBoundRadius(b: Bridge): number {
  return Math.hypot(b.halfLength, b.halfWidth + PARAPET_THICKNESS);
}

/** True when the world point lies inside the deck slab, a parapet or a pier. */
export function pointInsideBridge(b: Bridge, x: number, y: number, z: number): boolean {
  const dx = x - b.x;
  const dz = z - b.z;
  const along = toLocalZ(dx, dz, b.yaw);
  if (along < -b.halfLength || along > b.halfLength) return false;
  const lateral = Math.abs(toLocalX(dx, dz, b.yaw));
  if (lateral > b.halfWidth + PARAPET_THICKNESS) return false;
  const road = deckHeightAt(b, along);
  const underside = road - DECK_THICKNESS;
  if (y >= underside) return y <= (lateral > b.halfWidth ? road + PARAPET_HEIGHT : road);
  if (y < b.footY || lateral > b.halfWidth - PIER_INSET) return false;
  for (const pier of b.piers) {
    if (Math.abs(along - pier) <= PIER_HALF_ALONG) return true;
  }
  return false;
}

const exitScratch = { t: 1 };

/** Segment against the bridge's solid volume; returns t in [0, 1] or NO_HIT. */
export function segmentVsBridge(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  b: Bridge,
): number {
  const top = b.endY + b.arch + PARAPET_HEIGHT;
  const midY = (b.footY + top) / 2;
  const tEnter = segmentVsAabb(
    toLocalX(ax - b.x, az - b.z, b.yaw), ay - midY, toLocalZ(ax - b.x, az - b.z, b.yaw),
    toLocalX(bx - b.x, bz - b.z, b.yaw), by - midY, toLocalZ(bx - b.x, bz - b.z, b.yaw),
    b.halfWidth + PARAPET_THICKNESS, (top - b.footY) / 2, b.halfLength,
    exitScratch,
  );
  if (tEnter === NO_HIT) return NO_HIT;
  return marchToSurface(ax, ay, az, bx, by, bz, tEnter, exitScratch.t, b, pointInsideBridge);
}
