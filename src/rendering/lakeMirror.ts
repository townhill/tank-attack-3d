/**
 * Planar mirror reflections on lakes: which lake gets the one reflection a
 * frame can afford, the mirrored camera that renders it with everything under
 * the surface clipped away, and the lake each water vertex belongs to. Lakes
 * and ponds are level, so one plane mirrors a whole lake; rivers fall along
 * their course and are never mirrored.
 */
import type { Frustum, PerspectiveCamera } from 'three';
import { Matrix4, Plane, Sphere, Vector3, Vector4 } from 'three';
import type { Terrain } from '../world/Terrain';
import type { Lake } from '../world/Water';

/** Lakes whose shore is further than this from the eye are never reflected (metres). */
export const REFLECT_RANGE = 700;
/** The eye must be at least this far above a lake's surface to see a reflection in it (metres). */
export const MIN_EYE_HEIGHT = 0.3;

const UP = new Vector3(0, 1, 0);
/** Maps clip coordinates in [-1, 1] to texture coordinates in [0, 1]. */
const CLIP_TO_TEXTURE = new Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

const sphere = new Sphere();
const eye = new Vector3();
const ahead = new Vector3();
const rotation = new Matrix4();
const surfacePoint = new Vector3();
const plane = new Plane();
const clip = new Vector4();
const corner = new Vector4();

/** Furthest the shoreline of `lake` reaches from its centre. */
export function lakeReach(lake: Lake): number {
  let widest = 0;
  for (const m of lake.shape) widest = Math.max(widest, m);
  return lake.radius * widest;
}

/**
 * Index of the lake to reflect this frame: of the lakes in view whose surface
 * lies below the eye, the one whose shore is nearest, within REFLECT_RANGE.
 * Returns -1 when there is none.
 */
export function pickReflectedLake(lakes: readonly Lake[], eyePosition: Vector3, frustum: Frustum, range = REFLECT_RANGE): number {
  let best = -1;
  let bestDistance = Infinity;
  for (let k = 0; k < lakes.length; k++) {
    const lake = lakes[k]!;
    if (eyePosition.y - lake.surfaceY < MIN_EYE_HEIGHT) continue;
    const reach = lakeReach(lake);
    const distance = Math.max(0, Math.hypot(lake.x - eyePosition.x, lake.z - eyePosition.z) - reach);
    if (distance > range || distance >= bestDistance) continue;
    sphere.center.set(lake.x, lake.surfaceY, lake.z);
    sphere.radius = reach;
    if (!frustum.intersectsSphere(sphere)) continue;
    best = k;
    bestDistance = distance;
  }
  return best;
}

/**
 * Sets `out` up as the mirror image of `camera` in the horizontal plane at
 * `level`, with an oblique near plane on the water so nothing beneath it is
 * drawn, and writes into `textureMatrix` the transform from world positions
 * to coordinates in the texture `out` renders. Returns false, leaving both
 * untouched, when the eye is not above the plane.
 */
export function mirrorCamera(camera: PerspectiveCamera, level: number, out: PerspectiveCamera, textureMatrix: Matrix4): boolean {
  camera.updateMatrixWorld();
  eye.setFromMatrixPosition(camera.matrixWorld);
  if (eye.y - level < MIN_EYE_HEIGHT) return false;
  rotation.extractRotation(camera.matrixWorld);
  ahead.set(0, 0, -1).applyMatrix4(rotation).add(eye);
  out.position.set(eye.x, 2 * level - eye.y, eye.z);
  out.up.set(0, 1, 0).applyMatrix4(rotation).reflect(UP);
  out.lookAt(ahead.x, 2 * level - ahead.y, ahead.z);
  out.near = camera.near;
  out.far = camera.far;
  out.updateMatrixWorld();
  out.projectionMatrix.copy(camera.projectionMatrix);
  textureMatrix.copy(CLIP_TO_TEXTURE).multiply(out.projectionMatrix).multiply(out.matrixWorldInverse);

  // Oblique near plane (Lengyel): the water plane in view space replaces the
  // near plane, so the riverbed and anything else below it is clipped.
  surfacePoint.set(eye.x, level, eye.z);
  plane.setFromNormalAndCoplanarPoint(UP, surfacePoint).applyMatrix4(out.matrixWorldInverse);
  clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
  const p = out.projectionMatrix.elements;
  corner.set((Math.sign(clip.x) + p[8]) / p[0], (Math.sign(clip.y) + p[9]) / p[5], -1, (1 + p[10]) / p[14]);
  clip.multiplyScalar(2 / clip.dot(corner));
  p[2] = clip.x;
  p[6] = clip.y;
  p[10] = clip.z + 1;
  p[14] = clip.w;
  out.projectionMatrixInverse.copy(out.projectionMatrix).invert();
  return true;
}

/**
 * Lake of every terrain vertex: the index into `lakes` of the lake whose
 * level the vertex carries, its shoreline ring included, and -1 for rivers
 * and dry ground.
 */
export function lakeVertexIds(terrain: Terrain, level: Float32Array, lakes: readonly Lake[]): Float32Array {
  const ids = new Float32Array(level.length).fill(-1);
  const res = terrain.resolution;
  const last = res - 1;
  const toIndex = (v: number): number => Math.round((v + terrain.halfSize) / terrain.cellSize);
  lakes.forEach((lake, k) => {
    const surface = Math.fround(lake.surfaceY);
    const reach = lakeReach(lake) + 2 * terrain.cellSize;
    const i0 = Math.max(0, toIndex(lake.x - reach));
    const i1 = Math.min(last, toIndex(lake.x + reach));
    const j0 = Math.max(0, toIndex(lake.z - reach));
    const j1 = Math.min(last, toIndex(lake.z + reach));
    for (let j = j0; j <= j1; j++) {
      const dz = terrain.vertexZ(j) - lake.z;
      for (let i = i0; i <= i1; i++) {
        const v = j * res + i;
        if (level[v] !== surface) continue;
        const dx = terrain.vertexX(i) - lake.x;
        if (dx * dx + dz * dz <= reach * reach) ids[v] = k;
      }
    }
  });
  return ids;
}
