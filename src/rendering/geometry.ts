/**
 * Procedural geometry helpers for faceted vector-style models. Solids are
 * built as convex pieces with outward-facing triangles; edges are extracted
 * with a crease-angle threshold so only meaningful outlines are drawn.
 */
import { BufferAttribute, BufferGeometry, EdgesGeometry, Matrix4 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Vec2 = readonly [number, number];

/** Collects triangles, flipping any that face towards the piece's centroid. */
class TriangleBuilder {
  private readonly positions: number[] = [];

  constructor(private readonly cx: number, private readonly cy: number, private readonly cz: number) {}

  tri(ax: number, ay: number, az: number, bx: number, by: number, bz: number, px: number, py: number, pz: number): void {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = px - ax;
    const vy = py - ay;
    const vz = pz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const mx = (ax + bx + px) / 3 - this.cx;
    const my = (ay + by + py) / 3 - this.cy;
    const mz = (az + bz + pz) / 3 - this.cz;
    if (nx * mx + ny * my + nz * mz < 0) this.positions.push(ax, ay, az, px, py, pz, bx, by, bz);
    else this.positions.push(ax, ay, az, bx, by, bz, px, py, pz);
  }

  quad(a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[]): void {
    this.tri(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!, c[0]!, c[1]!, c[2]!);
    this.tri(a[0]!, a[1]!, a[2]!, c[0]!, c[1]!, c[2]!, d[0]!, d[1]!, d[2]!);
  }

  build(): BufferGeometry {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geo.computeVertexNormals();
    return geo;
  }
}

function centroid2(points: readonly Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p[0];
    y += p[1];
  }
  return [x / points.length, y / points.length];
}

/**
 * Lofts a convex footprint `bottom` (x, z) at height y0 to `top` at y1.
 * Both polygons must have the same vertex count and winding.
 */
export function loft(bottom: readonly Vec2[], top: readonly Vec2[], y0: number, y1: number): BufferGeometry {
  if (bottom.length !== top.length || bottom.length < 3) throw new Error('loft requires matching polygons');
  const cb = centroid2(bottom);
  const ct = centroid2(top);
  const b = new TriangleBuilder((cb[0] + ct[0]) / 2, (y0 + y1) / 2, (cb[1] + ct[1]) / 2);
  const n = bottom.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const b0 = bottom[i]!;
    const b1 = bottom[j]!;
    const t0 = top[i]!;
    const t1 = top[j]!;
    b.quad([b0[0], y0, b0[1]], [b1[0], y0, b1[1]], [t1[0], y1, t1[1]], [t0[0], y1, t0[1]]);
    b.tri(cb[0], y0, cb[1], b0[0], y0, b0[1], b1[0], y0, b1[1]);
    b.tri(ct[0], y1, ct[1], t1[0], y1, t1[1], t0[0], y1, t0[1]);
  }
  return b.build();
}

/** Extrudes a convex side profile given as (z, y) points along X from x0 to x1. */
export function extrudeProfileX(profile: readonly Vec2[], x0: number, x1: number): BufferGeometry {
  const c = centroid2(profile);
  const b = new TriangleBuilder((x0 + x1) / 2, c[1], c[0]);
  const n = profile.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const p0 = profile[i]!;
    const p1 = profile[j]!;
    b.quad([x0, p0[1], p0[0]], [x1, p0[1], p0[0]], [x1, p1[1], p1[0]], [x0, p1[1], p1[0]]);
    b.tri(x0, c[1], c[0], x0, p0[1], p0[0], x0, p1[1], p1[0]);
    b.tri(x1, c[1], c[0], x1, p1[1], p1[0], x1, p0[1], p0[0]);
  }
  return b.build();
}

/** Axis-aligned box from min to max corners. */
export function box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): BufferGeometry {
  return loft(
    [[x0, z0], [x1, z0], [x1, z1], [x0, z1]],
    [[x0, z0], [x1, z0], [x1, z1], [x0, z1]],
    y0,
    y1,
  );
}

/** Regular polygon in the XZ plane. */
export function polygon(sides: number, radius: number, cx = 0, cz = 0, phase = 0): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < sides; i++) {
    const a = phase + (i / sides) * Math.PI * 2;
    out.push([cx + Math.cos(a) * radius, cz + Math.sin(a) * radius]);
  }
  return out;
}

export function scalePolygon(points: readonly Vec2[], sx: number, sz: number, dx = 0, dz = 0): Vec2[] {
  return points.map((p) => [p[0] * sx + dx, p[1] * sz + dz] as const);
}

/** Cylinder along -Z from z0 to z1 (z1 < z0 extends forward), built as a faceted prism. */
export function prismAlongZ(sides: number, radius: number, z0: number, z1: number, cx = 0, cy = 0): BufferGeometry {
  // Loft in XZ then rotate so the axis lies along Z.
  const ring = polygon(sides, radius, 0, 0, Math.PI / sides);
  const geo = loft(ring, ring, z0, z1);
  const m = new Matrix4().set(
    1, 0, 0, cx,
    0, 0, 1, cy,
    0, 1, 0, 0,
    0, 0, 0, 1,
  );
  // The swap above mirrors the winding; flip triangles back to face outwards.
  geo.applyMatrix4(m);
  flipWinding(geo);
  return geo;
}

export function flipWinding(geo: BufferGeometry): void {
  const pos = geo.getAttribute('position') as BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < arr.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const tmp = arr[i + 3 + k]!;
      arr[i + 3 + k] = arr[i + 6 + k]!;
      arr[i + 6 + k] = tmp;
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

/** Merges non-indexed position/normal geometries into one. */
export function mergeParts(parts: readonly BufferGeometry[]): BufferGeometry {
  const cleaned = parts.map((g) => {
    const geo = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(geo.attributes)) {
      if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    }
    if (!geo.hasAttribute('normal')) geo.computeVertexNormals();
    return geo;
  });
  // Every part is reduced to position + normal above, so the merge is always compatible.
  return mergeGeometries(cleaned, false);
}

/** Edge line positions (pairs of xyz) for creases sharper than `thresholdDeg`. */
export function edgePositions(geo: BufferGeometry, thresholdDeg: number): number[] {
  const edges = new EdgesGeometry(geo, thresholdDeg);
  const arr = Array.from(edges.getAttribute('position').array as Float32Array);
  edges.dispose();
  return arr;
}

/** Accumulates line segments as a flat xyz-xyz array. */
export class SegmentList {
  readonly data: number[] = [];

  add(ax: number, ay: number, az: number, bx: number, by: number, bz: number): this {
    this.data.push(ax, ay, az, bx, by, bz);
    return this;
  }

  /** Closed polyline through the given points. */
  loop(points: readonly (readonly [number, number, number])[]): this {
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      this.add(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    return this;
  }

  append(values: readonly number[]): this {
    for (const v of values) this.data.push(v);
    return this;
  }

  toFloat32(): Float32Array {
    return new Float32Array(this.data);
  }
}

export function transformSegments(values: number[], matrix: Matrix4): number[] {
  const e = matrix.elements;
  const out = new Array<number>(values.length);
  for (let i = 0; i < values.length; i += 3) {
    const x = values[i]!;
    const y = values[i + 1]!;
    const z = values[i + 2]!;
    out[i] = e[0] * x + e[4] * y + e[8] * z + e[12];
    out[i + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
    out[i + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
  }
  return out;
}
