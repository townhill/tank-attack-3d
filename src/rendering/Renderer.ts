/**
 * WebGL renderer and post-processing chain:
 *   RenderPass (MSAA target) -> [phosphor persistence] -> bloom -> [CRT] -> output.
 * Quality presets trade resolution, MSAA, bloom and shadows for speed.
 */
import { HalfFloatType, NoToneMapping, PCFShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector2, WebGLRenderer, WebGLRenderTarget } from 'three';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { QualityLevel } from '../config/userSettings';
import type { GraphicsModeSpec } from './GraphicsModes';

interface QualityPreset {
  readonly pixelRatioCap: number;
  readonly postProcessing: boolean;
  readonly samples: number;
  readonly bloomScale: number;
  readonly shadows: boolean;
  readonly shadowMapSize: number;
}

export const QUALITY_PRESETS: Readonly<Record<QualityLevel, QualityPreset>> = {
  low: { pixelRatioCap: 1, postProcessing: false, samples: 0, bloomScale: 0, shadows: false, shadowMapSize: 512 },
  medium: { pixelRatioCap: 1.5, postProcessing: true, samples: 2, bloomScale: 0.5, shadows: true, shadowMapSize: 1024 },
  high: { pixelRatioCap: 2, postProcessing: true, samples: 4, bloomScale: 0.5, shadows: true, shadowMapSize: 2048 },
};

const CRT_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uScanlines: { value: 1 },
    uFlicker: { value: 1 },
    uResolution: { value: new Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uScanlines;
    uniform float uFlicker;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float hash(float n) { return fract(sin(n) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec3 col = texture2D(tDiffuse, uv).rgb;
      // Faint horizontal beam smear, like a slow phosphor.
      col += texture2D(tDiffuse, uv + vec2(1.5 / uResolution.x, 0.0)).rgb * 0.12;
      float scan = 0.5 + 0.5 * sin(uv.y * uResolution.y * 3.14159);
      col *= mix(1.0, 0.72 + 0.28 * scan, uScanlines);
      float flicker = 1.0 - uFlicker * (0.035 * hash(floor(uTime * 30.0)) + 0.015 * sin(uTime * 113.0));
      col *= flicker;
      vec2 d = uv - 0.5;
      col *= 1.0 - dot(d, d) * 0.9;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export interface RenderConfig {
  readonly quality: QualityLevel;
  readonly mode: GraphicsModeSpec;
  readonly bloomMultiplier: number;
  readonly scanlines: boolean;
  readonly flicker: boolean;
}

export class Renderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private afterimage: AfterimagePass | null = null;
  private crt: ShaderPass | null = null;
  private config: RenderConfig | null = null;
  private width = 1;
  private height = 1;
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.info.autoReset = false;
    this.camera = new PerspectiveCamera(70, 1, 0.1, 9000);
  }

  get quality(): QualityLevel {
    return this.config?.quality ?? 'high';
  }

  get preset(): QualityPreset {
    return QUALITY_PRESETS[this.quality];
  }

  get pixelSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  configure(config: RenderConfig): void {
    const previous = this.config;
    this.config = config;
    const preset = QUALITY_PRESETS[config.quality];
    if (!previous || previous.quality !== config.quality) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatioCap));
      this.rebuildComposer();
    }
    const bloom = this.bloom;
    if (bloom) {
      bloom.strength = config.mode.bloom.strength * config.bloomMultiplier;
      bloom.radius = config.mode.bloom.radius;
      bloom.threshold = config.mode.bloom.threshold;
      bloom.enabled = bloom.strength > 0.001;
    }
    const classicFx = config.mode.crt;
    if (this.afterimage) {
      this.afterimage.enabled = classicFx && config.flicker;
      (this.afterimage.uniforms as Record<string, { value: number }>).damp!.value = 0.62;
    }
    if (this.crt) {
      this.crt.enabled = classicFx && (config.scanlines || config.flicker);
      this.crt.uniforms.uScanlines!.value = config.scanlines ? 1 : 0;
      this.crt.uniforms.uFlicker!.value = config.flicker ? 1 : 0;
    }
  }

  private rebuildComposer(): void {
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    this.afterimage = null;
    this.crt = null;
    const preset = this.preset;
    if (!preset.postProcessing) return;
    const pr = this.renderer.getPixelRatio();
    const target = new WebGLRenderTarget(this.width * pr, this.height * pr, { type: HalfFloatType, samples: preset.samples });
    const composer = new EffectComposer(this.renderer, target);
    composer.setPixelRatio(pr);
    composer.setSize(this.width, this.height);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.afterimage = new AfterimagePass(0.62);
    composer.addPass(this.afterimage);
    this.bloom = new UnrealBloomPass(new Vector2(this.width * preset.bloomScale, this.height * preset.bloomScale), 0.8, 0.4, 0.1);
    composer.addPass(this.bloom);
    this.crt = new ShaderPass(CRT_SHADER);
    composer.addPass(this.crt);
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.updateCrtResolution();
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(this.width, this.height);
      const scale = this.preset.bloomScale;
      this.bloom?.setSize(this.width * scale, this.height * scale);
    }
    this.updateCrtResolution();
  }

  private updateCrtResolution(): void {
    if (!this.crt) return;
    const pr = this.renderer.getPixelRatio();
    (this.crt.uniforms.uResolution!.value as Vector2).set(this.width * pr, this.height * pr);
  }

  render(dt: number): void {
    this.time += dt;
    // Several passes render per frame, so statistics are reset once per frame.
    this.renderer.info.reset();
    if (this.crt) this.crt.uniforms.uTime!.value = this.time;
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  get stats(): { calls: number; triangles: number; lines: number; geometries: number; textures: number } {
    const info = this.renderer.info;
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      lines: info.render.lines,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    };
  }

  dispose(): void {
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
