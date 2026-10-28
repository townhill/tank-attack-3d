/**
 * Chunked terrain mesh using the simulation's exact triangulation, with
 * neon grid and contour lines computed in the fragment shader. Because the
 * lines are part of the surface they are naturally hidden-line correct and
 * can never z-fight.
 */
import type { WebGLProgramParametersWithUniforms } from 'three';
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial, Vector2, Vector3 } from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { World } from '../world/World';
import type { GraphicsModeSpec } from './GraphicsModes';
import type { MaterialLibrary } from './Materials';

const CHUNK_CELLS = 36;
const BOUNDARY_STEP = 8;
const BOUNDARY_POST_SPACING = 40;
const BOUNDARY_LIFT = 0.35;

const VERTEX_DECL = /* glsl */ `
varying vec3 vTerrainWorld;
`;
const VERTEX_BODY = /* glsl */ `
vTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
`;
const FRAGMENT_DECL = /* glsl */ `
varying vec3 vTerrainWorld;
uniform vec3 uLowColor;
uniform vec3 uHighColor;
uniform vec2 uHeightRange;
uniform vec3 uGridColor;
uniform float uGridSpacing;
uniform float uGridIntensity;
uniform vec3 uContourColor;
uniform float uContourSpacing;
uniform float uContourIntensity;

float vtGrid(vec2 p, float spacing) {
  vec2 coord = p / spacing;
  vec2 w = max(fwidth(coord), vec2(1e-4));
  vec2 g = abs(fract(coord - 0.5) - 0.5) / (w * 1.3);
  float line = 1.0 - min(min(g.x, g.y), 1.0);
  return line * (1.0 - smoothstep(0.06, 0.4, max(w.x, w.y)));
}

float vtContour(float h, float spacing) {
  float coord = h / spacing;
  float w = max(fwidth(coord), 1e-4);
  float g = abs(fract(coord - 0.5) - 0.5) / (w * 1.2);
  return (1.0 - min(g, 1.0)) * (1.0 - smoothstep(0.12, 0.5, w));
}
`;
const FRAGMENT_TINT = /* glsl */ `
#include <color_fragment>
diffuseColor.rgb *= mix(uLowColor, uHighColor, smoothstep(uHeightRange.x, uHeightRange.y, vTerrainWorld.y));
`;
const FRAGMENT_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += uGridColor * (vtGrid(vTerrainWorld.xz, uGridSpacing) * uGridIntensity);
totalEmissiveRadiance += uContourColor * (vtContour(vTerrainWorld.y, uContourSpacing) * uContourIntensity);
`;

export class TerrainView {
  readonly group = new Group();
  private readonly material: MeshStandardMaterial;
  private readonly uniforms = {
    uLowColor: { value: new Color() },
    uHighColor: { value: new Color() },
    uHeightRange: { value: new Vector2(-10, 60) },
    uGridColor: { value: new Color() },
    uGridSpacing: { value: 20 },
    uGridIntensity: { value: 0.5 },
    uContourColor: { value: new Color() },
    uContourSpacing: { value: 4 },
    uContourIntensity: { value: 0.3 },
  };
  private readonly geometries: BufferGeometry[] = [];
  private readonly boundaryGeometry: LineSegmentsGeometry;

  constructor(world: World, materials: MaterialLibrary) {
    this.material = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0.05 });
    this.material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms): void => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = VERTEX_DECL + shader.vertexShader.replace('#include <fog_vertex>', `#include <fog_vertex>\n${VERTEX_BODY}`);
      shader.fragmentShader = FRAGMENT_DECL + shader.fragmentShader
        .replace('#include <color_fragment>', FRAGMENT_TINT)
        .replace('#include <emissivemap_fragment>', FRAGMENT_EMISSIVE);
    };
    this.material.customProgramCacheKey = (): string => 'vt-terrain';
    const range = world.terrain.minMax();
    this.uniforms.uHeightRange.value.set(range.min, Math.min(range.max, range.min + 80));

    const terrain = world.terrain;
    const cells = terrain.resolution - 1;
    for (let cj = 0; cj < cells; cj += CHUNK_CELLS) {
      for (let ci = 0; ci < cells; ci += CHUNK_CELLS) {
        const geo = this.buildChunk(world, ci, cj, Math.min(CHUNK_CELLS, cells - ci), Math.min(CHUNK_CELLS, cells - cj));
        this.geometries.push(geo);
        const mesh = new Mesh(geo, this.material);
        mesh.receiveShadow = true;
        mesh.name = 'terrain-chunk';
        this.group.add(mesh);
      }
    }

    this.boundaryGeometry = new LineSegmentsGeometry().setPositions(new Float32Array(this.buildBoundary(world)));
    const boundary = new LineSegments2(this.boundaryGeometry, materials.edges.boundary);
    boundary.name = 'boundary';
    this.group.add(boundary);
  }

  private buildChunk(world: World, i0: number, j0: number, cw: number, ch: number): BufferGeometry {
    const terrain = world.terrain;
    const vw = cw + 1;
    const vh = ch + 1;
    const positions = new Float32Array(vw * vh * 3);
    const normals = new Float32Array(vw * vh * 3);
    const n = new Vector3();
    for (let j = 0; j < vh; j++) {
      for (let i = 0; i < vw; i++) {
        const gi = i0 + i;
        const gj = j0 + j;
        const x = terrain.vertexX(gi);
        const z = terrain.vertexZ(gj);
        const k = (j * vw + i) * 3;
        positions[k] = x;
        positions[k + 1] = terrain.vertexHeight(gi, gj);
        positions[k + 2] = z;
        terrain.normalAt(x, z, n, terrain.cellSize);
        normals[k] = n.x;
        normals[k + 1] = n.y;
        normals[k + 2] = n.z;
      }
    }
    const indices = new Uint32Array(cw * ch * 6);
    let o = 0;
    for (let j = 0; j < ch; j++) {
      for (let i = 0; i < cw; i++) {
        const a = j * vw + i;
        const b = a + 1;
        const d = a + vw;
        const c = d + 1;
        // Diagonal a->c matches Terrain.heightAt.
        indices[o++] = a;
        indices[o++] = c;
        indices[o++] = b;
        indices[o++] = a;
        indices[o++] = d;
        indices[o++] = c;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('normal', new BufferAttribute(normals, 3));
    geo.setIndex(new BufferAttribute(indices, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }

  private buildBoundary(world: World): number[] {
    const h = world.playableHalfSize;
    const out: number[] = [];
    const corners: [number, number][] = [[-h, -h], [h, -h], [h, h], [-h, h]];
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c]!;
      const [bx, bz] = corners[(c + 1) % 4]!;
      const len = Math.hypot(bx - ax, bz - az);
      const steps = Math.ceil(len / BOUNDARY_STEP);
      for (let s = 0; s < steps; s++) {
        const x0 = ax + ((bx - ax) * s) / steps;
        const z0 = az + ((bz - az) * s) / steps;
        const x1 = ax + ((bx - ax) * (s + 1)) / steps;
        const z1 = az + ((bz - az) * (s + 1)) / steps;
        out.push(x0, world.heightAt(x0, z0) + BOUNDARY_LIFT, z0, x1, world.heightAt(x1, z1) + BOUNDARY_LIFT, z1);
      }
      const posts = Math.round(len / BOUNDARY_POST_SPACING);
      for (let p = 0; p < posts; p++) {
        const x = ax + ((bx - ax) * p) / posts;
        const z = az + ((bz - az) * p) / posts;
        const y = world.heightAt(x, z);
        out.push(x, y, z, x, y + 5, z);
        out.push(x, y + 5, z, x + (bx - ax) / len * 3, y + 4, z + (bz - az) / len * 3);
      }
    }
    return out;
  }

  applyMode(spec: GraphicsModeSpec, gridEnabled: boolean): void {
    const t = spec.terrain;
    const u = this.uniforms;
    u.uLowColor.value.setHex(t.low);
    u.uHighColor.value.setHex(t.high);
    u.uGridColor.value.setHex(t.grid);
    u.uGridSpacing.value = t.gridSpacing;
    // Classic mode keeps its sparse grid even when the optional neon grid is off.
    u.uGridIntensity.value = gridEnabled || spec.id === 'classic' ? t.gridIntensity : 0;
    u.uContourColor.value.setHex(t.contour);
    u.uContourSpacing.value = t.contourSpacing;
    u.uContourIntensity.value = t.contourIntensity;
    this.material.roughness = spec.solidStyle === 'shaded' ? 0.9 : 0.75;
    this.material.metalness = spec.solidStyle === 'dark' ? 0.25 : 0.05;
    this.material.envMapIntensity = spec.envIntensity * 0.4;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    this.boundaryGeometry.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }
}
