import type { Object3D, PerspectiveCamera as Camera, Scene, WebGLRenderer, WebGLRenderTarget } from 'three';
import { Group, PerspectiveCamera, Scene as ThreeScene, Vector2 } from 'three';
import { describe, expect, it } from 'vitest';
import { LakeReflection, REFLECT_SCALE } from '../src/rendering/LakeReflection';
import type { Lake } from '../src/world/Water';

const LAKE: Lake = { id: 0, kind: 'lake', x: 0, z: -200, surfaceY: -1, radius: 50, maxDepth: 4, shape: new Array<number>(12).fill(1) };

/** Records what a reflection pass asks of the renderer, and the state it renders in. */
class FakeRenderer {
  readonly shadowMap = { autoUpdate: true };
  readonly log: string[] = [];
  private target: WebGLRenderTarget | null = null;
  constructor(private readonly hidden: Object3D) {}
  getDrawingBufferSize(out: Vector2): Vector2 {
    return out.set(1600, 900);
  }
  getRenderTarget(): WebGLRenderTarget | null {
    return this.target;
  }
  setRenderTarget(target: WebGLRenderTarget | null): void {
    this.target = target;
    this.log.push(target ? `target ${target.width}x${target.height}` : 'screen');
  }
  clear(): void {
    this.log.push('clear');
  }
  render(_scene: Scene, camera: Camera): void {
    this.log.push(`render water=${this.hidden.visible} shadows=${this.shadowMap.autoUpdate} below=${camera.position.y < 0}`);
  }
}

function setup(): { reflection: LakeReflection; renderer: FakeRenderer; water: Group; camera: PerspectiveCamera } {
  const water = new Group();
  const renderer = new FakeRenderer(water);
  const camera = new PerspectiveCamera(70, 16 / 9, 0.1, 9000);
  camera.position.set(0, 6, 0);
  camera.lookAt(0, 0, -100);
  return { reflection: new LakeReflection([LAKE]), renderer, water, camera };
}

function pass(s: ReturnType<typeof setup>): void {
  s.reflection.render(s.renderer as unknown as WebGLRenderer, new ThreeScene(), s.camera, s.water);
}

describe('LakeReflection', () => {
  it('renders nothing until enabled', () => {
    const s = setup();
    pass(s);
    expect(s.renderer.log).toEqual([]);
    expect(s.reflection.uniforms.uReflectLake.value).toBe(-1);
  });

  it('mirrors the lake in view at reduced resolution, without the water and without redrawing shadows', () => {
    const s = setup();
    s.reflection.enabled = true;
    pass(s);
    const w = 1600 * REFLECT_SCALE;
    const h = 900 * REFLECT_SCALE;
    expect(s.renderer.log).toEqual([`target ${w}x${h}`, 'clear', 'render water=false shadows=false below=true', 'screen']);
    expect(s.reflection.uniforms.uReflectLake.value).toBe(0);
    expect(s.reflection.uniforms.uReflectMap.value).toBeDefined();
  });

  it('puts back the water, the shadow updates and the render target afterwards', () => {
    const s = setup();
    s.reflection.enabled = true;
    pass(s);
    expect(s.water.visible).toBe(true);
    expect(s.renderer.shadowMap.autoUpdate).toBe(true);
    expect(s.renderer.getRenderTarget()).toBeNull();
  });

  it('skips the pass and mirrors no lake when none is in view', () => {
    const s = setup();
    s.reflection.enabled = true;
    pass(s);
    s.renderer.log.length = 0;
    s.camera.lookAt(0, 0, 100);
    pass(s);
    expect(s.renderer.log).toEqual([]);
    expect(s.reflection.uniforms.uReflectLake.value).toBe(-1);
  });

  it('forgets the lakes of the previous battlefield', () => {
    const s = setup();
    s.reflection.enabled = true;
    pass(s);
    s.reflection.setLakes([]);
    expect(s.reflection.uniforms.uReflectLake.value).toBe(-1);
    s.renderer.log.length = 0;
    pass(s);
    expect(s.renderer.log).toEqual([]);
  });
});
