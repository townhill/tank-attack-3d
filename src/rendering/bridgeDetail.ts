/**
 * Details that dress a bridge beyond its slab, parapets and piers, all in the
 * bridge's own frame (x across the deck, z along it, y up): cutwater noses on
 * the piers, railings along the parapets, lamp posts at the four corners, a
 * dashed centreline on the road and stringers under the slab. The lines are
 * depth-tested like every other edge, so the hidden-line look is kept.
 */
import type { Bridge } from '../world/Bridge';
import { DECK_THICKNESS, deckHeightAt, PARAPET_HEIGHT, PARAPET_THICKNESS } from '../world/Bridge';
import type { Vec2 } from './geometry';
import { SegmentList } from './geometry';

/** Longest gap between railing posts (metres); posts are spaced evenly with one at each end. */
export const RAIL_SPACING = 4;
/** Railing height above the parapet (metres). */
export const RAIL_HEIGHT = 0.9;
/** Lamp post height above the parapet, and the arm reaching over the road (metres). */
export const LAMP_HEIGHT = 3.4;
export const LAMP_ARM = 1.3;
/** Half size of the lamp head hanging from the arm (metres). */
export const LAMP_HEAD = 0.28;
/** Lamp posts stand this far in from each end of the deck (metres). */
export const LAMP_INSET = 1.5;
/** Centreline dashes and the gaps between them (metres), floating just above the road. */
export const DASH_LENGTH = 2;
export const DASH_GAP = 2.5;
export const DASH_LIFT = 0.05;
/** Stringers hang this far below the slab, at this fraction of the half width either side (metres). */
export const STRINGER_DROP = 0.03;
export const STRINGER_OFFSET = 0.5;
/** Length of the pointed nose on each end of a pier, where the river meets it (metres). */
export const CUTWATER_LENGTH = 1.5;

/**
 * Footprint of a pier with cutwaters: a hexagon the river flows round, pointed
 * at both ends across the deck, inscribed in the pier's collision box so the
 * drawn pier never reaches beyond what shells hit.
 */
export function pierFootprint(halfWidth: number, halfAlong: number, nose = CUTWATER_LENGTH): Vec2[] {
  const n = Math.min(nose, halfWidth * 0.45);
  return [
    [-halfWidth, 0],
    [-halfWidth + n, -halfAlong],
    [halfWidth - n, -halfAlong],
    [halfWidth, 0],
    [halfWidth - n, halfAlong],
    [-halfWidth + n, halfAlong],
  ];
}

/** Line details of one bridge as flat [x0, y0, z0, x1, y1, z1, ...] in its frame. */
export function bridgeDetailSegments(b: Bridge): number[] {
  const lines = new SegmentList();
  addRailings(b, lines);
  addLamps(b, lines);
  addCentreline(b, lines);
  addStringers(b, lines);
  return lines.data;
}

/** Height of the parapet top at `along`. */
function parapetTopAt(b: Bridge, along: number): number {
  return deckHeightAt(b, along) + PARAPET_HEIGHT;
}

/** Lateral position of the railing and lamps, in the middle of each parapet. */
function parapetCentre(b: Bridge, side: number): number {
  return side * (b.halfWidth + PARAPET_THICKNESS / 2);
}

function addRailings(b: Bridge, lines: SegmentList): void {
  const count = Math.max(1, Math.floor((2 * b.halfLength) / RAIL_SPACING));
  for (const side of [-1, 1]) {
    const x = parapetCentre(b, side);
    let prevZ = -b.halfLength;
    let prevTop = parapetTopAt(b, prevZ) + RAIL_HEIGHT;
    for (let k = 0; k <= count; k++) {
      const z = -b.halfLength + (2 * b.halfLength * k) / count;
      const base = parapetTopAt(b, z);
      const top = base + RAIL_HEIGHT;
      lines.add(x, base, z, x, top, z);
      if (k > 0) lines.add(x, prevTop, prevZ, x, top, z);
      prevZ = z;
      prevTop = top;
    }
  }
}

function addLamps(b: Bridge, lines: SegmentList): void {
  for (const side of [-1, 1]) {
    for (const end of [-1, 1]) {
      const x = parapetCentre(b, side);
      const z = end * (b.halfLength - LAMP_INSET);
      const base = parapetTopAt(b, z);
      const top = base + LAMP_HEIGHT;
      const armX = x - side * LAMP_ARM;
      lines.add(x, base, z, x, top, z);
      lines.add(x, top, z, armX, top, z);
      // A diamond head hanging under the arm, in the plane across the deck.
      const cy = top - LAMP_HEAD;
      lines.loop([
        [armX, top, z],
        [armX + LAMP_HEAD, cy, z],
        [armX, cy - LAMP_HEAD, z],
        [armX - LAMP_HEAD, cy, z],
      ]);
    }
  }
}

function addCentreline(b: Bridge, lines: SegmentList): void {
  const period = DASH_LENGTH + DASH_GAP;
  for (let z0 = -b.halfLength + DASH_GAP / 2; z0 + DASH_LENGTH <= b.halfLength; z0 += period) {
    const z1 = z0 + DASH_LENGTH;
    lines.add(0, deckHeightAt(b, z0) + DASH_LIFT, z0, 0, deckHeightAt(b, z1) + DASH_LIFT, z1);
  }
}

function addStringers(b: Bridge, lines: SegmentList): void {
  const count = Math.max(2, Math.ceil((2 * b.halfLength) / RAIL_SPACING));
  for (const side of [-1, 1]) {
    const x = side * b.halfWidth * STRINGER_OFFSET;
    for (let k = 0; k < count; k++) {
      const z0 = -b.halfLength + (2 * b.halfLength * k) / count;
      const z1 = -b.halfLength + (2 * b.halfLength * (k + 1)) / count;
      lines.add(x, undersideAt(b, z0), z0, x, undersideAt(b, z1), z1);
    }
  }
}

function undersideAt(b: Bridge, along: number): number {
  return deckHeightAt(b, along) - DECK_THICKNESS - STRINGER_DROP;
}
