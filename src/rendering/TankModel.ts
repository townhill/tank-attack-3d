/**
 * Procedural tank models in model space (forward = -Z, unscaled). Each rigid
 * part (hull, turret, mantlet, barrel) gets an occluding solid, structural
 * crease edges and optional panel-detail lines. Pivot offsets match the
 * physics in TankSpec so the drawn muzzle is where shells spawn.
 */
import type { BufferGeometry } from 'three';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { TankKind } from '../config/settings';
import { TANK_SPECS } from '../config/settings';
import type { Vec2 } from './geometry';
import { box, edgePositions, extrudeProfileX, loft, mergeParts, polygon, prismAlongZ, scalePolygon, SegmentList } from './geometry';

export interface PartGeometry {
  readonly solid: BufferGeometry;
  readonly edges: LineSegmentsGeometry;
  readonly detail: LineSegmentsGeometry | null;
}

export interface WheelLayout {
  readonly z: number;
  readonly y: number;
  readonly r: number;
}

export interface TrackLayout {
  readonly endZ: number;
  readonly centreY: number;
  readonly radius: number;
  readonly innerX: number;
  readonly outerX: number;
  readonly cleats: number;
  readonly wheels: readonly WheelLayout[];
  readonly length: number;
}

export interface TankGeometry {
  readonly hull: PartGeometry;
  readonly turret: PartGeometry;
  readonly mantlet: PartGeometry;
  readonly barrel: PartGeometry;
  readonly track: TrackLayout;
}

const HALF_WIDTH = 1.95;
const TRACK_INNER = 1.15;
const TRACK_END_Z = 2.95;
const TRACK_CENTRE_Y = 0.55;
const TRACK_RADIUS = 0.5;
const DECK_Y = 1.75;
const LINE_LIFT = 0.018;
const EDGE_ANGLE = 18;
const CURVED_EDGE_ANGLE = 38;

export const TRACK_LAYOUT: TrackLayout = {
  endZ: TRACK_END_Z,
  centreY: TRACK_CENTRE_Y,
  radius: TRACK_RADIUS,
  innerX: TRACK_INNER,
  outerX: HALF_WIDTH,
  cleats: 24,
  wheels: [
    { z: -TRACK_END_Z, y: TRACK_CENTRE_Y, r: 0.42 },
    { z: -1.75, y: 0.47, r: 0.4 },
    { z: -0.6, y: 0.47, r: 0.4 },
    { z: 0.6, y: 0.47, r: 0.4 },
    { z: 1.75, y: 0.47, r: 0.4 },
    { z: TRACK_END_Z, y: TRACK_CENTRE_Y, r: 0.42 },
  ],
  length: 4 * TRACK_END_Z + 2 * Math.PI * TRACK_RADIUS,
};

function lineGeometry(values: readonly number[]): LineSegmentsGeometry {
  return new LineSegmentsGeometry().setPositions(new Float32Array(values));
}

function part(pieces: readonly { geo: BufferGeometry; angle: number }[], detail: SegmentList | null, extraEdges?: SegmentList): PartGeometry {
  const edges = new SegmentList();
  for (const p of pieces) edges.append(edgePositions(p.geo, p.angle));
  if (extraEdges) edges.append(extraEdges.data);
  return {
    solid: mergeParts(pieces.map((p) => p.geo)),
    edges: lineGeometry(edges.data),
    detail: detail && detail.data.length > 0 ? lineGeometry(detail.data) : null,
  };
}

function stadiumProfile(): Vec2[] {
  const pts: Vec2[] = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * Math.PI;
    pts.push([TRACK_END_Z + Math.cos(a) * TRACK_RADIUS, TRACK_CENTRE_Y + Math.sin(a) * TRACK_RADIUS]);
  }
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI / 2 + (i / steps) * Math.PI;
    pts.push([-TRACK_END_Z + Math.cos(a) * TRACK_RADIUS, TRACK_CENTRE_Y + Math.sin(a) * TRACK_RADIUS]);
  }
  return pts;
}

/** Point along the glacis plate (t = 0 top edge, 1 bottom edge), lifted off the surface. */
function glacisPoint(x: number, t: number): [number, number, number] {
  const top: Vec2 = [-1.9, DECK_Y];
  const bottom: Vec2 = [-3.6, 1.2];
  const nz = -0.308;
  const ny = 0.951;
  return [x, top[1] + (bottom[1] - top[1]) * t + ny * LINE_LIFT, top[0] + (bottom[0] - top[0]) * t + nz * LINE_LIFT];
}

function buildHull(kind: TankKind): PartGeometry {
  const profile: Vec2[] = [[3.5, 1.05], [3.55, 1.6], [2.7, DECK_Y], [-1.9, DECK_Y], [-3.6, 1.2], [-3.55, 1.05]];
  const pieces: { geo: BufferGeometry; angle: number }[] = [
    { geo: extrudeProfileX(profile, -HALF_WIDTH, HALF_WIDTH), angle: EDGE_ANGLE },
    { geo: box(-1.12, 0.35, -3.1, 1.12, 1.06, 3.15), angle: EDGE_ANGLE },
    { geo: extrudeProfileX(stadiumProfile(), TRACK_INNER, HALF_WIDTH), angle: CURVED_EDGE_ANGLE },
    { geo: extrudeProfileX(stadiumProfile(), -HALF_WIDTH, -TRACK_INNER), angle: CURVED_EDGE_ANGLE },
  ];
  const detail = new SegmentList();
  if (kind === 'heavy') {
    pieces.push({ geo: box(HALF_WIDTH, 0.5, -3.05, HALF_WIDTH + 0.17, 1.12, 3.05), angle: EDGE_ANGLE });
    pieces.push({ geo: box(-HALF_WIDTH - 0.17, 0.5, -3.05, -HALF_WIDTH, 1.12, 3.05), angle: EDGE_ANGLE });
    for (const side of [-1, 1]) {
      const x = side * (HALF_WIDTH + 0.17 + LINE_LIFT);
      for (let z = -1.8; z <= 1.9; z += 1.22) detail.add(x, 0.55, z, x, 1.08, z);
    }
  }

  // Glacis inset panel and headlamp blocks.
  const g0 = glacisPoint(-1.55, 0.15);
  const g1 = glacisPoint(1.55, 0.15);
  const g2 = glacisPoint(1.55, 0.82);
  const g3 = glacisPoint(-1.55, 0.82);
  detail.loop([g0, g1, g2, g3]);
  detail.add(...glacisPoint(0, 0.15), ...glacisPoint(0, 0.82));
  // Hull side armour panels.
  for (const side of [-1, 1]) {
    const x = side * (HALF_WIDTH + LINE_LIFT);
    detail.loop([[x, 1.18, -2.9], [x, 1.18, 2.95], [x, 1.62, 2.95], [x, 1.62, -1.95]]);
    detail.add(x, 1.18, 0.45, x, 1.68, 0.45);
  }
  // Engine deck grille behind the turret ring.
  const deck = DECK_Y + LINE_LIFT;
  for (const z of [2.1, 2.3, 2.5]) detail.add(-1.1, deck, z, 1.1, deck, z);
  detail.loop([[-1.25, deck, 1.98], [1.25, deck, 1.98], [1.25, deck, 2.62], [-1.25, deck, 2.62]]);
  // Rear plate.
  detail.loop([[-1.5, 1.2, 3.52 + LINE_LIFT], [1.5, 1.2, 3.52 + LINE_LIFT], [1.5, 1.5, 3.54 + LINE_LIFT], [-1.5, 1.5, 3.54 + LINE_LIFT]]);
  return part(pieces, detail);
}

type TurretStyle = 'wedge' | 'box' | 'compact';

const TURRET_FOOTPRINTS: Readonly<Record<TurretStyle, readonly Vec2[]>> = {
  wedge: [[-0.6, -1.65], [0.6, -1.65], [1.35, -0.85], [1.45, 1.0], [1.0, 1.6], [-1.0, 1.6], [-1.45, 1.0], [-1.35, -0.85]],
  box: [[-1.0, -1.7], [1.0, -1.7], [1.55, -1.1], [1.55, 1.4], [1.2, 1.75], [-1.2, 1.75], [-1.55, 1.4], [-1.55, -1.1]],
  compact: [[-0.5, -1.5], [0.5, -1.5], [1.1, -0.6], [1.1, 0.9], [0.6, 1.3], [-0.6, 1.3], [-1.1, 0.9], [-1.1, -0.6]],
};

const TURRET_BASE_Y = -0.3;
const TURRET_TOP_Y = 0.8;

function turretStyle(kind: TankKind): TurretStyle {
  if (kind === 'heavy') return 'box';
  if (kind === 'scout') return 'compact';
  return 'wedge';
}

function buildTurret(kind: TankKind): PartGeometry {
  const style = turretStyle(kind);
  const bottom = TURRET_FOOTPRINTS[style];
  const taper = style === 'box' ? 0.9 : 0.82;
  const top = scalePolygon(bottom, taper, taper, 0, 0.12);
  const pieces: { geo: BufferGeometry; angle: number }[] = [{ geo: loft(bottom, top, TURRET_BASE_Y, TURRET_TOP_Y), angle: EDGE_ANGLE }];
  const detail = new SegmentList();
  const roof = TURRET_TOP_Y + LINE_LIFT;
  const inset = scalePolygon(top, 0.7, 0.7, 0, 0.1);
  detail.loop(inset.map((p) => [p[0], roof, p[1]] as [number, number, number]));

  if (kind !== 'scout') {
    // Commander's cupola.
    pieces.push({ geo: loft(polygon(8, 0.34, 0.55, 0.65), polygon(8, 0.28, 0.55, 0.65), TURRET_TOP_Y - 0.02, TURRET_TOP_Y + 0.3), angle: 30 });
  } else {
    // Sensor mast with a scanning head.
    pieces.push({ geo: box(-0.66, TURRET_TOP_Y - 0.02, 0.75, -0.54, TURRET_TOP_Y + 0.95, 0.87), angle: EDGE_ANGLE });
    pieces.push({ geo: loft(polygon(6, 0.24, -0.6, 0.81), polygon(6, 0.24, -0.6, 0.81), TURRET_TOP_Y + 0.95, TURRET_TOP_Y + 1.12), angle: 30 });
  }
  if (kind === 'player' || kind === 'standard') {
    // Whip antenna drawn as a single vector line.
    detail.add(-0.9, TURRET_TOP_Y, 1.25, -0.95, TURRET_TOP_Y + 2.1, 1.35);
  }
  if (kind === 'heavy') {
    // Add-on armour slabs on the turret cheeks.
    pieces.push({ geo: box(-1.75, -0.1, -1.4, -1.5, 0.55, 0.6), angle: EDGE_ANGLE });
    pieces.push({ geo: box(1.5, -0.1, -1.4, 1.75, 0.55, 0.6), angle: EDGE_ANGLE });
  }
  // Vision slits on the turret flanks.
  for (const side of [-1, 1]) {
    const x = side * (style === 'compact' ? 1.04 : style === 'box' ? 1.5 : 1.38);
    detail.add(x + side * LINE_LIFT, 0.45, -0.4, x + side * LINE_LIFT, 0.45, 0.5);
  }
  return part(pieces, detail);
}

function buildMantlet(kind: TankKind): PartGeometry {
  const w = kind === 'heavy' ? 0.55 : kind === 'scout' ? 0.34 : 0.45;
  return part([{ geo: box(-w, -0.3, -0.62, w, 0.3, 0.08), angle: EDGE_ANGLE }], null);
}

function buildBarrel(kind: TankKind): PartGeometry {
  const spec = TANK_SPECS[kind];
  const length = spec.barrelLength;
  const r = kind === 'heavy' ? 0.17 : kind === 'scout' ? 0.1 : 0.13;
  const sides = 6;
  const pieces = [
    { geo: prismAlongZ(sides, r, -0.55, -length), angle: 50 },
    { geo: prismAlongZ(sides, r * 1.55, -length + 0.42, -length), angle: 50 },
    { geo: prismAlongZ(sides, r * 1.45, -length * 0.52, -length * 0.52 - 0.5), angle: 50 },
  ];
  return part(pieces, null);
}

const cache = new Map<TankKind, TankGeometry>();

export function getTankGeometry(kind: TankKind): TankGeometry {
  const cached = cache.get(kind);
  if (cached) return cached;
  const geometry: TankGeometry = {
    hull: buildHull(kind),
    turret: buildTurret(kind),
    mantlet: buildMantlet(kind),
    barrel: buildBarrel(kind),
    track: TRACK_LAYOUT,
  };
  cache.set(kind, geometry);
  return geometry;
}

export function disposeTankGeometries(): void {
  for (const g of cache.values()) {
    for (const p of [g.hull, g.turret, g.mantlet, g.barrel]) {
      p.solid.dispose();
      p.edges.dispose();
      p.detail?.dispose();
    }
  }
  cache.clear();
}

/** Total segments written by `writeTrackSegments` for both tracks. */
export const TRACK_SEGMENT_COUNT = 2 * (TRACK_LAYOUT.cleats + TRACK_LAYOUT.wheels.length * 10);

/**
 * Writes animated track cleats and rotating road-wheel lines for both tracks
 * into `out` (xyz-xyz per segment). Phases are track surface distances.
 */
export function writeTrackSegments(out: Float32Array, phaseLeft: number, phaseRight: number): void {
  const t = TRACK_LAYOUT;
  const straight = 2 * t.endZ;
  const arc = Math.PI * t.radius;
  let o = 0;
  const write = (ax: number, ay: number, az: number, bx: number, by: number, bz: number): void => {
    out[o++] = ax;
    out[o++] = ay;
    out[o++] = az;
    out[o++] = bx;
    out[o++] = by;
    out[o++] = bz;
  };
  for (const side of [-1, 1]) {
    const phase = side < 0 ? phaseLeft : phaseRight;
    const inner = side * t.innerX;
    const outer = side * (t.outerX + LINE_LIFT);
    for (let i = 0; i < t.cleats; i++) {
      let s = ((i / t.cleats) * t.length + phase) % t.length;
      if (s < 0) s += t.length;
      let z: number;
      let y: number;
      let nz: number;
      let ny: number;
      if (s < straight) {
        z = -t.endZ + s;
        y = t.centreY - t.radius;
        nz = 0;
        ny = -1;
      } else if (s < straight + arc) {
        const a = -Math.PI / 2 + (s - straight) / t.radius;
        nz = Math.cos(a);
        ny = Math.sin(a);
        z = t.endZ + nz * t.radius;
        y = t.centreY + ny * t.radius;
      } else if (s < 2 * straight + arc) {
        z = t.endZ - (s - straight - arc);
        y = t.centreY + t.radius;
        nz = 0;
        ny = 1;
      } else {
        const a = Math.PI / 2 + (s - 2 * straight - arc) / t.radius;
        nz = Math.cos(a);
        ny = Math.sin(a);
        z = -t.endZ + nz * t.radius;
        y = t.centreY + ny * t.radius;
      }
      const lift = 0.035;
      write(inner, y + ny * lift, z + nz * lift, outer, y + ny * lift, z + nz * lift);
    }
    for (const wheel of t.wheels) {
      const rot = phase / wheel.r;
      for (let k = 0; k < 8; k++) {
        const a0 = rot + (k / 8) * Math.PI * 2;
        const a1 = rot + ((k + 1) / 8) * Math.PI * 2;
        write(outer, wheel.y + Math.sin(a0) * wheel.r, wheel.z + Math.cos(a0) * wheel.r, outer, wheel.y + Math.sin(a1) * wheel.r, wheel.z + Math.cos(a1) * wheel.r);
      }
      for (let k = 0; k < 2; k++) {
        const a = rot + (k * Math.PI) / 2;
        const ca = Math.cos(a) * wheel.r * 0.85;
        const sa = Math.sin(a) * wheel.r * 0.85;
        write(outer, wheel.y - sa, wheel.z - ca, outer, wheel.y + sa, wheel.z + ca);
      }
    }
  }
}
