/**
 * Water surfaces built from the shared per-vertex water level over the same
 * triangles as the terrain and chunked like it, plus shoreline edges where
 * the water meets the ground. In Classic the surface is an opaque occluder,
 * so edges under the water stay hidden like any other hidden line.
 */
import type { BufferGeometry } from 'three';
import { BufferAttribute, BufferGeometry as Geometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { shorelineSegments } from '../world/shoreline';
import type { Terrain } from '../world/Terrain';
import type { World } from '../world/World';
import type { GraphicsModeSpec } from './GraphicsModes';
import type { MaterialLibrary } from './Materials';

const CHUNK_CELLS = 36;
/** Shoreline edges float this far above the waterline (metres). */
const SHORE_LIFT = 0.06;

export class WaterView {
  readonly group = new Group();
  private readonly material = new MeshStandardMaterial({ color: 0x000000, roughness: 0.2, metalness: 0.1 });
  private readonly disposables: { dispose(): void }[] = [];

  constructor(world: World, private readonly materials: MaterialLibrary) {
    const water = world.water;
    if (water.maxLevel === -Infinity) return;
    const terrain = world.terrain;
    const cells = terrain.resolution - 1;
    for (let cj = 0; cj < cells; cj += CHUNK_CELLS) {
      for (let ci = 0; ci < cells; ci += CHUNK_CELLS) {
        const geo = buildChunk(terrain, water.level, ci, cj, Math.min(CHUNK_CELLS, cells - ci), Math.min(CHUNK_CELLS, cells - cj));
        if (!geo) continue;
        this.disposables.push(geo);
        const mesh = new Mesh(geo, this.material);
        mesh.receiveShadow = true;
        mesh.name = 'water-chunk';
        this.group.add(mesh);
      }
    }
    const shore = shorelineSegments(terrain, water.level, SHORE_LIFT);
    if (shore.length > 0) {
      const geo = new LineSegmentsGeometry().setPositions(new Float32Array(shore));
      this.disposables.push(geo);
      const lines = new LineSegments2(geo, materials.edges.shore);
      lines.name = 'shoreline';
      this.group.add(lines);
    }
  }

  applyMode(spec: GraphicsModeSpec): void {
    const look = spec.water;
    const opaque = look.opacity >= 1;
    const m = this.material;
    m.color.setHex(look.surface);
    m.opacity = look.opacity;
    m.transparent = !opaque;
    m.depthWrite = opaque;
    m.envMapIntensity = spec.envIntensity;
    // Classic's see-through wireframe hides every occluder, the water included.
    m.visible = !this.materials.hidesSolids;
    m.needsUpdate = true;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }
}

/** Water triangles of one chunk: those with a level at every corner and water above the ground at one at least. */
function buildChunk(terrain: Terrain, level: Float32Array, i0: number, j0: number, cw: number, ch: number): BufferGeometry | null {
  const res = terrain.resolution;
  const positions: number[] = [];
  const push = (k: number): void => {
    const i = k % res;
    positions.push(terrain.vertexX(i), level[k]!, terrain.vertexZ((k - i) / res));
  };
  const triangle = (p: number, q: number, r: number): void => {
    const lp = level[p]!;
    const lq = level[q]!;
    const lr = level[r]!;
    if (Number.isNaN(lp) || Number.isNaN(lq) || Number.isNaN(lr)) return;
    const h = terrain.heights;
    if (lp <= h[p]! && lq <= h[q]! && lr <= h[r]!) return;
    push(p);
    push(q);
    push(r);
  };
  for (let j = j0; j < j0 + ch; j++) {
    for (let i = i0; i < i0 + cw; i++) {
      const a = j * res + i;
      const b = a + 1;
      const d = a + res;
      const c = d + 1;
      // Same triangulation and winding as the terrain mesh.
      triangle(a, c, b);
      triangle(a, d, c);
    }
  }
  if (positions.length === 0) return null;
  const geo = new Geometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
