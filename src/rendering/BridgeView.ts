/**
 * Bridges as faceted occluding solids with crease edges: a deck slab that
 * follows the road's arch, parapets along both kerbs, piers with cutwater
 * noses standing on the riverbed and abutments at each bank, dressed with
 * railings, lamp posts, a dashed centreline and stringers drawn as lines.
 * All bridges share one merged mesh and one set of lines.
 */
import type { BufferGeometry } from 'three';
import { Group, Matrix4, Mesh, Vector3 } from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { Bridge } from '../world/Bridge';
import { DECK_THICKNESS, deckHeightAt, PARAPET_HEIGHT, PARAPET_THICKNESS, PIER_HALF_ALONG, PIER_INSET } from '../world/Bridge';
import { toWorldX, toWorldZ } from '../world/Obstacle';
import type { Terrain } from '../world/Terrain';
import type { World } from '../world/World';
import { bridgeDetailSegments, pierFootprint } from './bridgeDetail';
import { box, edgePositions, loft, mergeParts, SegmentList, transformSegments } from './geometry';
import type { MaterialLibrary } from './Materials';

/** Length of each straight deck segment approximating the arch (metres). */
const DECK_SEGMENT = 4;
/** Abutment depth along the deck, reaching back under the span (metres). */
const ABUTMENT_DEPTH = 2.5;
/** Abutments sink this far below the lowest ground they stand on (metres). */
const ABUTMENT_FOOTING = 0.5;
const EDGE_ANGLE = 20;

export class BridgeView {
  readonly group = new Group();
  private readonly disposables: { dispose(): void }[] = [];

  constructor(world: World, materials: MaterialLibrary) {
    if (world.bridges.length === 0) return;
    const solids: BufferGeometry[] = [];
    const edges = new SegmentList();
    const matrix = new Matrix4();
    const axis = new Vector3(0, 1, 0);
    for (const b of world.bridges) {
      matrix.makeRotationAxis(axis, -b.yaw).setPosition(b.x, 0, b.z);
      for (const piece of bridgePieces(b, world.terrain)) {
        edges.append(transformSegments(edgePositions(piece, EDGE_ANGLE), matrix));
        piece.applyMatrix4(matrix);
        solids.push(piece);
      }
      edges.append(transformSegments(bridgeDetailSegments(b), matrix));
    }
    const merged = mergeParts(solids);
    for (const s of solids) s.dispose();
    this.disposables.push(merged);
    const mesh = new Mesh(merged, materials.solidFor('bridge'));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'bridges';
    this.group.add(mesh);
    const lineGeo = new LineSegmentsGeometry().setPositions(edges.toFloat32());
    this.disposables.push(lineGeo);
    this.group.add(new LineSegments2(lineGeo, materials.edges.bridge));
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.group.removeFromParent();
  }
}

/** Solid pieces of one bridge in its own frame: x across the deck, z along it, y in world height. */
function bridgePieces(b: Bridge, terrain: Terrain): BufferGeometry[] {
  const pieces: BufferGeometry[] = [];
  const outer = b.halfWidth + PARAPET_THICKNESS;
  const segments = Math.max(2, Math.ceil((2 * b.halfLength) / DECK_SEGMENT));
  for (let k = 0; k < segments; k++) {
    const z0 = -b.halfLength + (2 * b.halfLength * k) / segments;
    const z1 = -b.halfLength + (2 * b.halfLength * (k + 1)) / segments;
    const road = deckHeightAt(b, (z0 + z1) / 2);
    pieces.push(box(-outer, road - DECK_THICKNESS, z0, outer, road, z1));
    pieces.push(box(-outer, road, z0, -b.halfWidth, road + PARAPET_HEIGHT, z1));
    pieces.push(box(b.halfWidth, road, z0, outer, road + PARAPET_HEIGHT, z1));
  }
  const footprint = pierFootprint(b.halfWidth - PIER_INSET, PIER_HALF_ALONG);
  for (const along of b.piers) {
    const underside = deckHeightAt(b, along) - DECK_THICKNESS;
    const pier = footprint.map(([x, z]) => [x, z + along] as const);
    pieces.push(loft(pier, pier, b.footY, underside));
  }
  for (const side of [-1, 1]) {
    const near = side * (b.halfSpan - ABUTMENT_DEPTH);
    const far = side * b.halfSpan;
    let lowest = Infinity;
    for (const lateral of [-outer, 0, outer]) {
      for (const along of [near, far]) {
        lowest = Math.min(lowest, terrain.heightAt(b.x + toWorldX(lateral, along, b.yaw), b.z + toWorldZ(lateral, along, b.yaw)));
      }
    }
    const underside = deckHeightAt(b, far) - DECK_THICKNESS;
    if (lowest - ABUTMENT_FOOTING >= underside) continue;
    pieces.push(box(-outer, lowest - ABUTMENT_FOOTING, Math.min(near, far), outer, underside, Math.max(near, far)));
  }
  return pieces;
}
