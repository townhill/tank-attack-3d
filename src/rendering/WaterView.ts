/**
 * Water surfaces built from the shared per-vertex water level over the same
 * triangles as the terrain and chunked like it, plus shoreline edges where
 * the water meets the ground. The surface stays flat and still, exactly
 * where the simulation puts it; the fragment shader paints it instead: a
 * lighter, glowing tint over the shallows, ripple lines drifting with each
 * river's flow, a sheen at grazing angles and, at High quality, the mirror
 * image of the scenery on the nearest lake (see LakeReflection). In Classic
 * the surface is an opaque occluder, so edges under the water stay hidden
 * like any other hidden line.
 */
import type { BufferGeometry, WebGLProgramParametersWithUniforms } from 'three';
import { BufferAttribute, BufferGeometry as Geometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { QualityLevel } from '../config/userSettings';
import { riverFlowField } from '../world/riverFlow';
import { shorelineSegments } from '../world/shoreline';
import type { Terrain } from '../world/Terrain';
import type { World } from '../world/World';
import type { GraphicsModeSpec } from './GraphicsModes';
import type { ReflectionUniforms } from './LakeReflection';
import { lakeVertexIds } from './lakeMirror';
import type { MaterialLibrary } from './Materials';
import { REFLECT_DEFINE, RIPPLES_DEFINE, SHEEN_DEFINE, waterShaderDefines } from './waterDetail';

const CHUNK_CELLS = 36;
/** Shoreline edges float this far above the waterline (metres). */
const SHORE_LIFT = 0.06;
/** Water this deep takes the full surface colour; shallower water is tinted towards the shallow colour (metres). */
const DEEP_DEPTH = 2.5;
/** The shallows glow out to this depth (metres). */
const GLOW_DEPTH = 0.7;
/** Spatial period of the ripple pattern (metres). */
const RIPPLE_WAVELENGTH = 14;
/** Largest shift of the reflection by the moving surface, in texture coordinates. */
const REFLECT_WOBBLE = 0.004;

const VERTEX_DECL = /* glsl */ `
attribute float aDepth;
attribute vec2 aFlow;
varying vec3 vWaterWorld;
varying float vWaterDepth;
varying vec2 vWaterFlow;
#ifdef ${REFLECT_DEFINE}
attribute float aLake;
uniform mat4 uReflectMatrix;
varying float vWaterLake;
varying vec4 vReflectCoord;
#endif
`;
const VERTEX_BODY = /* glsl */ `
vWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWaterDepth = aDepth;
vWaterFlow = aFlow;
#ifdef ${REFLECT_DEFINE}
vWaterLake = aLake;
vReflectCoord = uReflectMatrix * vec4(vWaterWorld, 1.0);
#endif
`;
const FRAGMENT_DECL = /* glsl */ `
varying vec3 vWaterWorld;
varying float vWaterDepth;
varying vec2 vWaterFlow;
uniform float uTime;
uniform vec3 uShallowColor;
uniform vec3 uDeepColor;
uniform float uDeepDepth;
uniform vec3 uRippleColor;
uniform float uRippleIntensity;
uniform float uRippleWavelength;
uniform vec3 uGlowColor;
uniform float uGlowIntensity;
uniform float uGlowDepth;
uniform float uSheen;
#ifdef ${REFLECT_DEFINE}
uniform sampler2D uReflectMap;
uniform float uReflectLake;
uniform float uReflectStrength;
uniform float uReflectWobble;
varying float vWaterLake;
varying vec4 vReflectCoord;
#endif

// Arcs around the crests of three travelling waves, carried downstream by
// the flow: one thin line where the summed field crosses a fixed level. The
// pattern fades out once a wavelength covers only a few pixels, before it
// could alias into noise. No early return: every derivative is taken in
// uniform control flow, where GLSL defines it.
#ifdef ${RIPPLES_DEFINE}
float vtRipple(vec2 p, vec2 flow, float t) {
  vec2 q = (p - flow * t) * (6.2831853 / uRippleWavelength);
  float perPixel = max(length(fwidth(q)), 1e-4);
  float fade = 1.0 - smoothstep(0.25, 0.9, perPixel);
  float field = sin(dot(q, vec2(0.83, 0.56)) + t * 0.9)
    + sin(dot(q, vec2(-0.47, 0.88)) * 1.37 - t * 0.7)
    + 0.6 * sin(dot(q, vec2(0.31, -0.95)) * 0.71 + t * 1.3);
  float w = max(fwidth(field), 1e-4);
  float line = 1.0 - smoothstep(0.0, w * 1.5 + 0.12, abs(field - 1.5));
  return line * fade;
}
#endif
`;
const FRAGMENT_TINT = /* glsl */ `
#include <color_fragment>
diffuseColor.rgb *= mix(uShallowColor, uDeepColor, smoothstep(0.0, uDeepDepth, vWaterDepth));
`;
const FRAGMENT_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += uGlowColor * ((1.0 - smoothstep(0.0, uGlowDepth, vWaterDepth)) * uGlowIntensity);
#ifdef ${RIPPLES_DEFINE}
float vtWet = smoothstep(0.0, 0.3, vWaterDepth);
totalEmissiveRadiance += uRippleColor * (vtRipple(vWaterWorld.xz, vWaterFlow, uTime) * uRippleIntensity * vtWet);
#endif
#ifdef ${SHEEN_DEFINE}
vec3 vtToEye = normalize(cameraPosition - vWaterWorld);
float vtGrazing = pow(1.0 - max(vtToEye.y, 0.0), 3.0);
totalEmissiveRadiance += uRippleColor * (vtGrazing * uSheen);
#endif
#ifdef ${REFLECT_DEFINE}
// The mirrored scenery over the lake reflected this frame, shifted a little
// by the moving surface and strongest at grazing angles, as off real water.
// The branch depends on a uniform only, so every fragment takes it alike.
if (uReflectLake >= 0.0) {
  float vtMine = 1.0 - step(0.5, abs(vWaterLake - uReflectLake));
  vec2 vtWobble = vec2(sin(vWaterWorld.z * 0.31 + uTime * 1.1), cos(vWaterWorld.x * 0.27 + uTime * 0.9)) * uReflectWobble;
  vec3 vtMirror = texture2D(uReflectMap, vReflectCoord.xy / vReflectCoord.w + vtWobble).rgb;
  vec3 vtEye = normalize(cameraPosition - vWaterWorld);
  float vtFresnel = mix(0.35, 1.0, pow(1.0 - max(vtEye.y, 0.0), 2.0));
  totalEmissiveRadiance += vtMirror * (uReflectStrength * vtFresnel * vtMine);
}
#endif
`;

export class WaterView {
  readonly group = new Group();
  private readonly material: MeshStandardMaterial;
  private readonly uniforms = {
    uTime: { value: 0 },
    uShallowColor: { value: new Color() },
    uDeepColor: { value: new Color() },
    uDeepDepth: { value: DEEP_DEPTH },
    uRippleColor: { value: new Color() },
    uRippleIntensity: { value: 0 },
    uRippleWavelength: { value: RIPPLE_WAVELENGTH },
    uGlowColor: { value: new Color() },
    uGlowIntensity: { value: 0 },
    uGlowDepth: { value: GLOW_DEPTH },
    uSheen: { value: 0 },
    uReflectWobble: { value: REFLECT_WOBBLE },
  };
  private readonly disposables: { dispose(): void }[] = [];
  private quality: QualityLevel | null = null;
  private reflect = false;

  constructor(world: World, private readonly materials: MaterialLibrary, reflection: ReflectionUniforms) {
    this.material = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1 });
    this.material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms): void => {
      Object.assign(shader.uniforms, this.uniforms, reflection);
      shader.vertexShader = VERTEX_DECL + shader.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>\n${VERTEX_BODY}`);
      shader.fragmentShader = FRAGMENT_DECL + shader.fragmentShader
        .replace('#include <color_fragment>', FRAGMENT_TINT)
        .replace('#include <emissivemap_fragment>', FRAGMENT_EMISSIVE);
    };
    this.material.customProgramCacheKey = (): string => 'vt-water';
    const water = world.water;
    if (water.maxLevel === -Infinity) return;
    const terrain = world.terrain;
    const flow = riverFlowField(terrain, water.level, world.rivers);
    const lakes = lakeVertexIds(terrain, water.level, world.lakes);
    const cells = terrain.resolution - 1;
    for (let cj = 0; cj < cells; cj += CHUNK_CELLS) {
      for (let ci = 0; ci < cells; ci += CHUNK_CELLS) {
        const geo = buildChunk(terrain, water.level, flow, lakes, ci, cj, Math.min(CHUNK_CELLS, cells - ci), Math.min(CHUNK_CELLS, cells - cj));
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
    m.opacity = look.opacity;
    m.transparent = !opaque;
    m.depthWrite = opaque;
    m.envMapIntensity = spec.envIntensity;
    // Classic's see-through wireframe hides every occluder, the water included.
    m.visible = !this.materials.hidesSolids;
    m.needsUpdate = true;
    const u = this.uniforms;
    u.uShallowColor.value.setHex(look.shallow);
    u.uDeepColor.value.setHex(look.surface);
    u.uRippleColor.value.setHex(look.ripple);
    u.uRippleIntensity.value = look.rippleIntensity;
    u.uGlowColor.value.setHex(look.shore);
    u.uGlowIntensity.value = look.glowIntensity;
    u.uSheen.value = look.sheen;
  }

  /**
   * Compiles in the shader features `quality` draws (see WATER_DETAIL), the
   * lake reflection only when `reflect`; recompiles only when either changes.
   */
  setQuality(quality: QualityLevel, reflect: boolean): void {
    if (quality === this.quality && reflect === this.reflect) return;
    this.quality = quality;
    this.reflect = reflect;
    this.material.defines = waterShaderDefines(quality, reflect);
    this.material.needsUpdate = true;
  }

  /** Advances the ripples; `time` is the game clock in seconds. */
  update(time: number): void {
    this.uniforms.uTime.value = time;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }
}

/**
 * Water triangles of one chunk: those with a level at every corner and water
 * above the ground at one at least, each vertex carrying its depth, its flow
 * and the lake it belongs to (-1 for none).
 */
function buildChunk(
  terrain: Terrain, level: Float32Array, flow: Float32Array, lakeIds: Float32Array,
  i0: number, j0: number, cw: number, ch: number,
): BufferGeometry | null {
  const res = terrain.resolution;
  const h = terrain.heights;
  const positions: number[] = [];
  const depths: number[] = [];
  const flows: number[] = [];
  const lakes: number[] = [];
  const push = (k: number): void => {
    const i = k % res;
    positions.push(terrain.vertexX(i), level[k]!, terrain.vertexZ((k - i) / res));
    depths.push(Math.max(0, level[k]! - h[k]!));
    flows.push(flow[2 * k]!, flow[2 * k + 1]!);
    lakes.push(lakeIds[k]!);
  };
  const triangle = (p: number, q: number, r: number): void => {
    const lp = level[p]!;
    const lq = level[q]!;
    const lr = level[r]!;
    if (Number.isNaN(lp) || Number.isNaN(lq) || Number.isNaN(lr)) return;
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
  geo.setAttribute('aDepth', new BufferAttribute(new Float32Array(depths), 1));
  geo.setAttribute('aFlow', new BufferAttribute(new Float32Array(flows), 2));
  geo.setAttribute('aLake', new BufferAttribute(new Float32Array(lakes), 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
