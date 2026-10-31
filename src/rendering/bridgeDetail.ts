/**
 * Details that dress a bridge beyond its slab, parapets and piers, all in the
 * bridge's own frame (x across the deck, z along it, y up): cutwater noses on
 * the piers, railings along the parapets, lamp posts at the four corners and
 * a dashed centreline on the road, then either a through truss over the
 * river with stringers under the slab, or stiffened plate girders. The lines
 * are depth-tested like every other edge, so the hidden-line look is kept.
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
/** Height of a through truss above its parapets (metres): its overhead struts clear the tallest tank. */
export const TRUSS_HEIGHT = 5.5;
/** Preferred truss panel length (metres); the span is split into an even number of equal panels near it. */
export const TRUSS_PANEL = 6;
/**
 * Depth of the plate girders under the slab (metres). Girders and trusses
 * are scenery only: shells and sight lines meet the deck, parapets and piers
 * as before.
 */
export const GIRDER_DEPTH = 1.4;
/** Distance of each girder from the centreline, as a fraction of the half width. */
export const GIRDER_OFFSET = 0.6;
/** Half the thickness of a girder's solid web (metres). */
export const GIRDER_HALF_WEB = 0.2;
/** Longest gap between the stiffeners on a girder web (metres). */
export const STIFFENER_SPACING = 2.5;
/** Stiffeners stand this far proud of each web face, so the solid web never hides them (metres). */
const STIFFENER_PROUD = 0.02;

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

/**
 * How a bridge carries its deck: a through truss standing on the parapets
 * over the river, or plate girders under the slab.
 */
export type BridgeStyle = 'girder' | 'truss';

/**
 * Style of each bridge: the longest crossing on each river is a through
 * truss (the first of equals, so the choice never depends on ties) and the
 * rest are plate girders, so a battlefield shows both.
 */
export function bridgeStyles(bridges: readonly Bridge[]): BridgeStyle[] {
  const longest = new Map<number, number>();
  bridges.forEach((b, k) => {
    const best = longest.get(b.riverId);
    if (best === undefined || b.halfSpan > bridges[best]!.halfSpan) longest.set(b.riverId, k);
  });
  return bridges.map((b, k) => (longest.get(b.riverId) === k ? 'truss' : 'girder'));
}

/** Line details of one bridge as flat [x0, y0, z0, x1, y1, z1, ...] in its frame. */
export function bridgeDetailSegments(b: Bridge, style: BridgeStyle): number[] {
  const lines = new SegmentList();
  addRailings(b, lines);
  addLamps(b, lines);
  addCentreline(b, lines);
  if (style === 'truss') {
    addTrusses(b, lines);
    addStringers(b, lines);
  } else {
    addStiffeners(b, lines);
  }
  return lines.data;
}

/**
 * Along-deck panel points of a through truss, from one end of the span over
 * the river to the other: an even number of equal panels close to
 * TRUSS_PANEL long, at least two each side of mid-span.
 */
export function trussPanelPoints(b: Bridge): number[] {
  const panels = 2 * Math.max(2, Math.round(b.halfSpan / TRUSS_PANEL));
  const points: number[] = [];
  for (let k = 0; k <= panels; k++) points.push(-b.halfSpan + (2 * b.halfSpan * k) / panels);
  return points;
}

/** Lateral positions of the two plate girders under a girder bridge's slab, over the piers. */
export function girderOffsets(b: Bridge): [number, number] {
  return [-b.halfWidth * GIRDER_OFFSET, b.halfWidth * GIRDER_OFFSET];
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

/**
 * A Pratt truss on each parapet: end posts sloping up from the ends of the
 * span, a top chord following the arch, verticals at the panel points and
 * diagonals sloping down towards mid-span, with struts and sway bracing
 * between the two trusses overhead.
 */
function addTrusses(b: Bridge, lines: SegmentList): void {
  const points = trussPanelPoints(b);
  const n = points.length - 1;
  const top = (z: number): number => parapetTopAt(b, z) + TRUSS_HEIGHT;
  for (const side of [-1, 1]) {
    const x = parapetCentre(b, side);
    const z = (k: number): number => points[k]!;
    lines.add(x, parapetTopAt(b, z(0)), z(0), x, top(z(1)), z(1));
    lines.add(x, parapetTopAt(b, z(n)), z(n), x, top(z(n - 1)), z(n - 1));
    for (let k = 1; k < n; k++) {
      lines.add(x, parapetTopAt(b, z(k)), z(k), x, top(z(k)), z(k));
      if (k === n - 1) continue;
      lines.add(x, top(z(k)), z(k), x, top(z(k + 1)), z(k + 1));
      if (k < n / 2) lines.add(x, top(z(k)), z(k), x, parapetTopAt(b, z(k + 1)), z(k + 1));
      else lines.add(x, parapetTopAt(b, z(k)), z(k), x, top(z(k + 1)), z(k + 1));
    }
  }
  const across = parapetCentre(b, 1);
  for (let k = 1; k < n; k++) {
    const zk = points[k]!;
    lines.add(-across, top(zk), zk, across, top(zk), zk);
    if (k === n - 1) continue;
    const zn = points[k + 1]!;
    const from = k % 2 === 0 ? -across : across;
    lines.add(from, top(zk), zk, -from, top(zn), zn);
  }
}

/** Vertical stiffeners down both faces of each girder web, evenly spaced the full length of the deck. */
function addStiffeners(b: Bridge, lines: SegmentList): void {
  const count = Math.max(2, Math.ceil((2 * b.halfLength) / STIFFENER_SPACING));
  for (const web of girderOffsets(b)) {
    for (const face of [-1, 1]) {
      const x = web + face * (GIRDER_HALF_WEB + STIFFENER_PROUD);
      for (let k = 0; k <= count; k++) {
        const z = -b.halfLength + (2 * b.halfLength * k) / count;
        const top = deckHeightAt(b, z) - DECK_THICKNESS;
        lines.add(x, top, z, x, top - GIRDER_DEPTH, z);
      }
    }
  }
}

function undersideAt(b: Bridge, along: number): number {
  return deckHeightAt(b, along) - DECK_THICKNESS - STRINGER_DROP;
}
