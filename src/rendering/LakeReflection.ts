/**
 * The one planar lake reflection a frame affords: the nearest lake in view is
 * mirrored at reduced resolution into a texture the water shader samples with
 * projective coordinates. It renders before the main pass with the water
 * hidden, and reuses the shadow map the previous main pass left behind.
 */
import type { Object3D, Scene, Texture, WebGLRenderer } from 'three';
import { Frustum, HalfFloatType, Matrix4, PerspectiveCamera, Vector2, Vector3, WebGLRenderTarget } from 'three';
import type { Lake } from '../world/Water';
import { mirrorCamera, pickReflectedLake } from './lakeMirror';

/** Reflection texture size as a fraction of the drawing buffer on each side. */
export const REFLECT_SCALE = 0.5;

/** Uniforms the water shader reads the reflection through. */
export interface ReflectionUniforms {
  readonly uReflectMap: { value: Texture };
  /** World position to reflection texture coordinates. */
  readonly uReflectMatrix: { value: Matrix4 };
  /** Index of the lake mirrored this frame, or -1 for none. */
  readonly uReflectLake: { value: number };
  /** Strength of the mirror image; set from the graphics mode. */
  readonly uReflectStrength: { value: number };
}

export class LakeReflection {
  readonly uniforms: ReflectionUniforms;
  /** Whether lakes are mirrored at all: the quality, the graphics mode and auto-quality allowing. */
  enabled = false;
  private readonly target = new WebGLRenderTarget(1, 1, { type: HalfFloatType });
  private readonly mirrored = new PerspectiveCamera();
  private readonly frustum = new Frustum();
  private readonly viewProjection = new Matrix4();
  private readonly eye = new Vector3();
  private readonly size = new Vector2();

  constructor(private lakes: readonly Lake[]) {
    this.uniforms = {
      uReflectMap: { value: this.target.texture },
      uReflectMatrix: { value: new Matrix4() },
      uReflectLake: { value: -1 },
      uReflectStrength: { value: 0 },
    };
  }

  setLakes(lakes: readonly Lake[]): void {
    this.lakes = lakes;
    this.uniforms.uReflectLake.value = -1;
  }

  /** Index of the lake mirrored in the latest frame, or -1. */
  get lake(): number {
    return this.uniforms.uReflectLake.value;
  }

  /** Renders this frame's reflection of `scene` seen from `camera`, leaving `hidden` (the water) out of it. */
  render(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera, hidden: Object3D): void {
    const u = this.uniforms;
    u.uReflectLake.value = -1;
    if (!this.enabled || this.lakes.length === 0) return;
    camera.updateMatrixWorld();
    this.eye.setFromMatrixPosition(camera.matrixWorld);
    this.frustum.setFromProjectionMatrix(this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const k = pickReflectedLake(this.lakes, this.eye, this.frustum);
    if (k < 0 || !mirrorCamera(camera, this.lakes[k]!.surfaceY, this.mirrored, u.uReflectMatrix.value)) return;
    renderer.getDrawingBufferSize(this.size);
    const width = Math.max(1, Math.floor(this.size.x * REFLECT_SCALE));
    const height = Math.max(1, Math.floor(this.size.y * REFLECT_SCALE));
    if (this.target.width !== width || this.target.height !== height) this.target.setSize(width, height);
    const previousTarget = renderer.getRenderTarget();
    const autoShadows = renderer.shadowMap.autoUpdate;
    const visible = hidden.visible;
    hidden.visible = false;
    renderer.shadowMap.autoUpdate = false;
    try {
      renderer.setRenderTarget(this.target);
      renderer.clear();
      renderer.render(scene, this.mirrored);
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.shadowMap.autoUpdate = autoShadows;
      hidden.visible = visible;
    }
    u.uReflectLake.value = k;
  }

  dispose(): void {
    this.target.dispose();
  }
}
