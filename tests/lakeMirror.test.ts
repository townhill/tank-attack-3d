import { Frustum, Matrix4, PerspectiveCamera, Vector3, Vector4 } from 'three';
import { describe, expect, it } from 'vitest';
import { lakeReach, lakeVertexIds, mirrorCamera, pickReflectedLake, REFLECT_RANGE } from '../src/rendering/lakeMirror';
import { Terrain } from '../src/world/Terrain';
import type { Lake } from '../src/world/Water';
import { carveWater } from '../src/world/WaterGenerator';
import { makeStraightRiver } from './waterFixtures';

function makeLake(overrides: Partial<Lake> = {}): Lake {
  return { id: 0, kind: 'lake', x: 0, z: 0, surfaceY: -1.5, radius: 40, maxDepth: 4, shape: new Array<number>(12).fill(1), ...overrides };
}

/** A camera at `eye` looking at `target`, with its world matrices up to date. */
function cameraAt(eye: Vector3, target: Vector3): PerspectiveCamera {
  const camera = new PerspectiveCamera(70, 16 / 9, 0.1, 9000);
  camera.position.copy(eye);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
}

function frustumOf(camera: PerspectiveCamera): Frustum {
  return new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
}

/** Texture coordinates of world point `p` through a reflection texture matrix. */
function reflectionUv(matrix: Matrix4, p: Vector3): [number, number] {
  const v = new Vector4(p.x, p.y, p.z, 1).applyMatrix4(matrix);
  return [v.x / v.w, v.y / v.w];
}

/** Normalised device depth of world point `p` seen by `camera`. */
function clipDepth(camera: PerspectiveCamera, p: Vector3): number {
  const v = new Vector4(p.x, p.y, p.z, 1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  return v.z / v.w;
}

describe('lakeReach', () => {
  it('is the mean radius times the furthest shoreline multiplier', () => {
    const shape = [1, 1.1, 0.9, 1.2, 1, 1, 1, 1, 1, 1, 1, 0.85];
    expect(lakeReach(makeLake({ radius: 50, shape }))).toBeCloseTo(60);
  });
});

describe('pickReflectedLake', () => {
  // Looking north (-Z) from 8 m above the ground at the origin.
  const eye = new Vector3(0, 8, 0);
  const camera = cameraAt(eye, new Vector3(0, 0, -100));
  const frustum = frustumOf(camera);

  it('picks the nearest lake in view, by the distance to its shore', () => {
    const lakes = [
      makeLake({ id: 0, x: 0, z: -400, radius: 30 }),
      makeLake({ id: 1, x: 40, z: -300, radius: 70 }),
      makeLake({ id: 2, x: -30, z: -350, radius: 20 }),
    ];
    expect(pickReflectedLake(lakes, eye, frustum)).toBe(1);
  });

  it('ignores lakes behind the camera and beyond the reflection range', () => {
    const lakes = [
      makeLake({ id: 0, x: 0, z: 300, radius: 40 }),
      makeLake({ id: 1, x: 0, z: -(REFLECT_RANGE + 200), radius: 40 }),
      makeLake({ id: 2, x: 0, z: -500, radius: 40 }),
    ];
    expect(pickReflectedLake(lakes, eye, frustum)).toBe(2);
  });

  it('reflects nothing when the eye is not above the surface or there is no lake in view', () => {
    expect(pickReflectedLake([makeLake({ z: -200, surfaceY: 8 })], eye, frustum)).toBe(-1);
    expect(pickReflectedLake([makeLake({ z: 300 })], eye, frustum)).toBe(-1);
    expect(pickReflectedLake([], eye, frustum)).toBe(-1);
  });

  it('counts a lake the camera stands over as in reach', () => {
    expect(pickReflectedLake([makeLake({ x: 0, z: 0, radius: 60 })], eye, frustum)).toBe(0);
  });
});

describe('mirrorCamera', () => {
  const level = -1.5;
  const eye = new Vector3(10, 12, 30);
  const camera = cameraAt(eye, new Vector3(-20, -1.5, -120));
  const mirrored = new PerspectiveCamera();
  const matrix = new Matrix4();
  const ok = mirrorCamera(camera, level, mirrored, matrix);

  it('puts the virtual eye at the mirror image of the real one', () => {
    expect(ok).toBe(true);
    const at = new Vector3().setFromMatrixPosition(mirrored.matrixWorld);
    expect(at.x).toBeCloseTo(10);
    expect(at.y).toBeCloseTo(2 * level - 12);
    expect(at.z).toBeCloseTo(30);
  });

  it('maps a surface point to where the reflected scenery seen through it lies in the texture', () => {
    // Q's mirror image seen from the eye passes through the surface at P,
    // so the water at P shows Q.
    for (const q of [new Vector3(-30, 6, -150), new Vector3(25, 2, -60), new Vector3(0, 40, -400)]) {
      const image = new Vector3(q.x, 2 * level - q.y, q.z);
      const t = (eye.y - level) / (eye.y - image.y);
      const p = new Vector3().lerpVectors(eye, image, t);
      const [pu, pv] = reflectionUv(matrix, p);
      const [qu, qv] = reflectionUv(matrix, q);
      expect(pu).toBeCloseTo(qu, 5);
      expect(pv).toBeCloseTo(qv, 5);
    }
  });

  it('maps what lies straight ahead into the middle of the texture', () => {
    const ahead = new Vector3(-20, level, -120);
    const [u, v] = reflectionUv(matrix, ahead);
    expect(u).toBeGreaterThan(0);
    expect(u).toBeLessThan(1);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it('clips everything below the surface out of the reflection', () => {
    expect(Math.abs(clipDepth(mirrored, new Vector3(-20, level + 3, -120)))).toBeLessThanOrEqual(1);
    expect(Math.abs(clipDepth(mirrored, new Vector3(-20, level - 3, -120)))).toBeGreaterThan(1);
  });

  it('refuses an eye at or under the surface', () => {
    const under = cameraAt(new Vector3(0, level + 0.1, 0), new Vector3(0, level, -50));
    expect(mirrorCamera(under, level, new PerspectiveCamera(), new Matrix4())).toBe(false);
  });
});

describe('lakeVertexIds', () => {
  const terrain = new Terrain(300, 5);
  const lakes = [makeLake({ id: 0, x: 120, z: 40, radius: 40 }), makeLake({ id: 1, x: 120, z: -150, radius: 20, surfaceY: -0.8 })];
  const river = makeStraightRiver(-150, -300, -150, 300);
  const level = carveWater(terrain, [river], lakes, 250);
  const ids = lakeVertexIds(terrain, level, lakes);

  it('marks every vertex carrying a lake level with that lake, the shoreline ring included', () => {
    let marked = 0;
    for (let v = 0; v < ids.length; v++) {
      const k = ids[v]!;
      if (k < 0) continue;
      marked++;
      expect(level[v]).toBe(Math.fround(lakes[k]!.surfaceY));
    }
    expect(marked).toBeGreaterThan(100);
    // Centre of each lake.
    expect(ids[terrain.index(84, 68)]).toBe(0);
    expect(ids[terrain.index(84, 30)]).toBe(1);
  });

  it('leaves rivers and dry ground unmarked', () => {
    for (let v = 0; v < ids.length; v++) {
      const x = terrain.vertexX(v % terrain.resolution);
      if (Math.abs(x + 150) < 40) expect(ids[v]).toBe(-1);
      if (Number.isNaN(level[v]!)) expect(ids[v]).toBe(-1);
    }
  });
});
