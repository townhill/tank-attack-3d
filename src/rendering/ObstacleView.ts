/**
 * Static obstacles merged into spatial chunks (few draw calls, still frustum
 * culled per chunk). Each obstacle is a faceted occluding solid with crease
 * edges, plus optional structural detail lines.
 */
import type { BufferGeometry } from 'three';
import { Group, Matrix4, Mesh, Vector3 } from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { Random } from '../utils/random';
import type { Obstacle } from '../world/Obstacle';
import type { World } from '../world/World';
import type { Vec2 } from './geometry';
import { box, edgePositions, loft, mergeParts, polygon, SegmentList, transformSegments } from './geometry';
import type { GraphicsModeSpec } from './GraphicsModes';
import type { MaterialLibrary } from './Materials';

const CHUNK_SIZE = 250;
const LIFT = 0.03;

interface Piece {
  readonly geo: BufferGeometry;
  readonly angle: number;
}

interface ObstacleModel {
  readonly pieces: Piece[];
  readonly detail: SegmentList;
}

function rect(hx: number, hz: number): Vec2[] {
  return [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
}

/** Faceted boulder: a jittered low-poly dome whose top narrows like its collision profile. */
function rockModel(ob: Obstacle): ObstacleModel {
  const rng = new Random(ob.seed);
  const r = ob.shape.type === 'circle' ? ob.shape.radius : ob.boundRadius;
  const h = ob.height;
  const sides = 7;
  const rings = [
    { y: 0, s: 1.0 },
    { y: 0.45, s: 0.92 },
    { y: 0.8, s: 0.62 },
    { y: 1.0, s: 0.2 },
  ];
  const jitter = Array.from({ length: rings.length }, () => Array.from({ length: sides }, () => rng.range(0.82, 1.08)));
  const phase = rng.range(0, Math.PI);
  const pieces: Piece[] = [];
  for (let k = 0; k < rings.length - 1; k++) {
    const a = rings[k]!;
    const b = rings[k + 1]!;
    const ringA = polygon(sides, r * a.s, 0, 0, phase).map((p, i) => [p[0] * jitter[k]![i]!, p[1] * jitter[k]![i]!] as const);
    const ringB = polygon(sides, r * b.s, 0, 0, phase).map((p, i) => [p[0] * jitter[k + 1]![i]!, p[1] * jitter[k + 1]![i]!] as const);
    pieces.push({ geo: loft(ringA, ringB, a.y * h, b.y * h), angle: 22 });
  }
  return { pieces, detail: new SegmentList() };
}

function structureModel(ob: Obstacle): ObstacleModel {
  const h = ob.height;
  const detail = new SegmentList();
  const pieces: Piece[] = [];
  switch (ob.kind) {
    case 'pyramid': {
      const s = ob.shape.type === 'box' ? ob.shape.halfX : ob.boundRadius;
      pieces.push({ geo: loft(rect(s, s), rect(s * 0.02, s * 0.02), 0, h), angle: 20 });
      break;
    }
    case 'block': {
      const hx = ob.shape.type === 'box' ? ob.shape.halfX : 4;
      const hz = ob.shape.type === 'box' ? ob.shape.halfZ : 4;
      pieces.push({ geo: box(-hx, 0, -hz, hx, h, hz), angle: 20 });
      for (const y of [h * 0.33, h * 0.66]) {
        detail.loop([[-hx - LIFT, y, -hz - LIFT], [hx + LIFT, y, -hz - LIFT], [hx + LIFT, y, hz + LIFT], [-hx - LIFT, y, hz + LIFT]]);
      }
      break;
    }
    case 'bunker': {
      const hx = ob.shape.type === 'box' ? ob.shape.halfX : 8;
      const hz = ob.shape.type === 'box' ? ob.shape.halfZ : 6;
      pieces.push({ geo: loft(rect(hx, hz), rect(hx * 0.72, hz * 0.6), 0, h), angle: 20 });
      // Firing slit on the front face and a roof hatch.
      const slitY = h * 0.62;
      const frontZ = -hz + (hz - hz * 0.6) * 0.62 - LIFT;
      detail.loop([[-hx * 0.5, slitY, frontZ], [hx * 0.5, slitY, frontZ], [hx * 0.5, slitY + 0.35, frontZ + 0.1], [-hx * 0.5, slitY + 0.35, frontZ + 0.1]]);
      detail.loop(rect(hx * 0.3, hz * 0.25).map((p) => [p[0], h + LIFT, p[1]] as [number, number, number]));
      detail.add(hx * 0.5, h, hz * 0.3, hx * 0.5, h + 4, hz * 0.3);
      break;
    }
    case 'tower': {
      const r = ob.shape.type === 'circle' ? ob.shape.radius : 3;
      pieces.push({ geo: loft(polygon(8, r), polygon(8, r * 0.65), 0, h), angle: 30 });
      pieces.push({ geo: loft(polygon(8, r * 0.9), polygon(8, r * 0.9), h, h + 1.2), angle: 30 });
      for (let y = 6; y < h - 2; y += 6) {
        const rr = r * (1 - (0.35 * y) / h) + LIFT;
        detail.loop(polygon(8, rr).map((p) => [p[0], y, p[1]] as [number, number, number]));
      }
      detail.add(0, h + 1.2, 0, 0, h + 6, 0);
      break;
    }
    case 'wall': {
      const hx = ob.shape.type === 'box' ? ob.shape.halfX : 15;
      const hz = ob.shape.type === 'box' ? ob.shape.halfZ : 1.4;
      pieces.push({ geo: box(-hx, 0, -hz, hx, h, hz), angle: 20 });
      for (let x = -hx + 4; x < hx; x += 4) {
        detail.add(x, 0, -hz - LIFT, x, h, -hz - LIFT);
        detail.add(x, 0, hz + LIFT, x, h, hz + LIFT);
      }
      break;
    }
    case 'pylon':
    case 'rock': {
      const r = ob.shape.type === 'circle' ? ob.shape.radius : 1.5;
      pieces.push({ geo: loft(rect(r, r), rect(r * 0.35, r * 0.35), 0, h), angle: 20 });
      // Lattice cross-bracing.
      for (let y = 0; y < h - 2; y += 3) {
        const s0 = r * (1 - (0.65 * y) / h) + LIFT;
        const s1 = r * (1 - (0.65 * (y + 3)) / h) + LIFT;
        detail.add(-s0, y, -s0, s1, y + 3, -s1).add(s0, y, -s0, -s1, y + 3, -s1);
        detail.add(-s0, y, s0, s1, y + 3, s1).add(s0, y, s0, -s1, y + 3, s1);
      }
      break;
    }
  }
  return { pieces, detail };
}

interface ChunkBuild {
  rockSolids: BufferGeometry[];
  rockEdges: number[];
  structureSolids: BufferGeometry[];
  structureEdges: number[];
  structureDetail: number[];
}

export class ObstacleView {
  readonly group = new Group();
  private readonly detailObjects: LineSegments2[] = [];
  private readonly disposables: { dispose(): void }[] = [];

  constructor(world: World, private readonly materials: MaterialLibrary) {
    const chunks = new Map<string, ChunkBuild>();
    const matrix = new Matrix4();
    const axis = new Vector3(0, 1, 0);
    for (const ob of world.obstacles) {
      const key = `${Math.floor(ob.x / CHUNK_SIZE)}:${Math.floor(ob.z / CHUNK_SIZE)}`;
      let chunk = chunks.get(key);
      if (!chunk) {
        chunk = { rockSolids: [], rockEdges: [], structureSolids: [], structureEdges: [], structureDetail: [] };
        chunks.set(key, chunk);
      }
      const model = ob.kind === 'rock' ? rockModel(ob) : structureModel(ob);
      matrix.makeRotationAxis(axis, -ob.yaw).setPosition(ob.x, ob.baseY, ob.z);
      const isRock = ob.kind === 'rock';
      for (const piece of model.pieces) {
        const edges = transformSegments(edgePositions(piece.geo, piece.angle), matrix);
        piece.geo.applyMatrix4(matrix);
        (isRock ? chunk.rockSolids : chunk.structureSolids).push(piece.geo);
        (isRock ? chunk.rockEdges : chunk.structureEdges).push(...edges);
      }
      if (model.detail.data.length > 0) chunk.structureDetail.push(...transformSegments(model.detail.data, matrix));
    }

    for (const chunk of chunks.values()) {
      this.addChunkLayer(chunk.rockSolids, chunk.rockEdges, 'rock');
      this.addChunkLayer(chunk.structureSolids, chunk.structureEdges, 'structure');
      if (chunk.structureDetail.length > 0) {
        const geo = new LineSegmentsGeometry().setPositions(new Float32Array(chunk.structureDetail));
        this.disposables.push(geo);
        const lines = new LineSegments2(geo, materials.edges.structure);
        this.detailObjects.push(lines);
        this.group.add(lines);
      }
    }
  }

  private addChunkLayer(solids: BufferGeometry[], edges: number[], role: 'rock' | 'structure'): void {
    if (solids.length === 0) return;
    const merged = mergeParts(solids);
    for (const s of solids) s.dispose();
    this.disposables.push(merged);
    const mesh = new Mesh(merged, this.materials.solidFor(role));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    const lineGeo = new LineSegmentsGeometry().setPositions(new Float32Array(edges));
    this.disposables.push(lineGeo);
    this.group.add(new LineSegments2(lineGeo, this.materials.edges[role]));
  }

  applyMode(spec: GraphicsModeSpec): void {
    for (const d of this.detailObjects) d.visible = spec.panelDetail;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}
