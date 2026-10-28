/**
 * Backdrop: gradient sky dome, stars, a distant ring of vector mountains and
 * a moon. Everything here ignores fog so it reads as far-away scenery.
 */
import { BackSide, BufferAttribute, BufferGeometry, Color, Group, Mesh, Points, PointsMaterial, ShaderMaterial, SphereGeometry } from 'three';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { SimplexNoise2D } from '../utils/noise';
import { Random } from '../utils/random';
import type { GraphicsModeSpec } from './GraphicsModes';
import type { MaterialLibrary } from './Materials';

const SKY_RADIUS = 5200;
const RING_RADIUS = 3000;
const RING_SEGMENTS = 180;
const STAR_COUNT = 700;

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uGround;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.45));
  col += uGlow * exp(-abs(h) * 14.0) * 0.8;
  col = mix(uGround, col, smoothstep(-0.04, 0.01, h));
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Sky {
  readonly group = new Group();
  private readonly skyMaterial: ShaderMaterial;
  private readonly starMaterial: PointsMaterial;
  private readonly stars: Points;
  private readonly mountainEdgeMaterial: LineMaterial;
  private readonly moonMaterial: LineMaterial;
  private readonly disposables: { dispose(): void }[] = [];

  constructor(seed: number, private readonly materials: MaterialLibrary) {
    this.skyMaterial = new ShaderMaterial({
      uniforms: {
        uZenith: { value: new Color() },
        uHorizon: { value: new Color() },
        uGlow: { value: new Color() },
        uGround: { value: new Color() },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: BackSide,
      depthWrite: false,
      fog: false,
    });
    const skyGeo = new SphereGeometry(SKY_RADIUS, 48, 24);
    const sky = new Mesh(skyGeo, this.skyMaterial);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.group.add(sky);
    this.disposables.push(skyGeo, this.skyMaterial);

    const rng = new Random(seed ^ 0x2545f491);
    const starPositions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = rng.range(0, Math.PI * 2);
      const y = rng.range(0.06, 1);
      const r = Math.sqrt(1 - y * y);
      const d = SKY_RADIUS * 0.95;
      starPositions[i * 3] = Math.cos(theta) * r * d;
      starPositions[i * 3 + 1] = y * d;
      starPositions[i * 3 + 2] = Math.sin(theta) * r * d;
    }
    const starGeo = new BufferGeometry();
    starGeo.setAttribute('position', new BufferAttribute(starPositions, 3));
    this.starMaterial = new PointsMaterial({ color: 0xbfd4ff, size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false });
    this.stars = new Points(starGeo, this.starMaterial);
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
    this.disposables.push(starGeo, this.starMaterial);

    this.mountainEdgeMaterial = materials.createEdgeMaterial(0xffffff, 1.6);
    this.mountainEdgeMaterial.fog = false;
    this.moonMaterial = materials.createEdgeMaterial(0xffffff, 1.6);
    this.moonMaterial.fog = false;
    this.buildMountains(seed);
    this.buildMoon();
  }

  private buildMountains(seed: number): void {
    const noise = new SimplexNoise2D(seed ^ 0x1234abcd);
    const rng = new Random(seed ^ 0x77);
    const peaks: number[] = [];
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const a = (i / RING_SEGMENTS) * Math.PI * 2;
      let h = 120 + 260 * Math.max(0, noise.fbm(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 3));
      h += 90 * Math.abs(noise.noise(Math.cos(a) * 9, Math.sin(a) * 9));
      peaks.push(h);
    }
    // A couple of volcano-like massifs give the horizon landmarks.
    for (let v = 0; v < 2; v++) {
      const centre = rng.int(0, RING_SEGMENTS - 1);
      for (let k = -6; k <= 6; k++) {
        const idx = (centre + k + RING_SEGMENTS) % RING_SEGMENTS;
        const cone = Math.max(0, 1 - Math.abs(k) / 6.5);
        peaks[idx] = Math.max(peaks[idx]!, 140 + 520 * cone * (Math.abs(k) <= 1 ? 0.9 : 1));
      }
    }

    const positions: number[] = [];
    const edges: number[] = [];
    const base = -40;
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const j = (i + 1) % RING_SEGMENTS;
      const a0 = (i / RING_SEGMENTS) * Math.PI * 2;
      const a1 = (j / RING_SEGMENTS) * Math.PI * 2;
      const r0 = RING_RADIUS + ((i * 37) % 11) * 25;
      const r1 = RING_RADIUS + ((j * 37) % 11) * 25;
      const x0 = Math.cos(a0) * r0;
      const z0 = Math.sin(a0) * r0;
      const x1 = Math.cos(a1) * r1;
      const z1 = Math.sin(a1) * r1;
      const h0 = peaks[i]!;
      const h1 = peaks[j]!;
      positions.push(x0, base, z0, x1, base, z1, x1, h1, z1, x0, base, z0, x1, h1, z1, x0, h0, z0);
      edges.push(x0, h0, z0, x1, h1, z1);
      // Ridge lines dropping from local maxima.
      const prev = peaks[(i - 1 + RING_SEGMENTS) % RING_SEGMENTS]!;
      if (h0 > prev && h0 > h1 && h0 > 160) {
        const spread = 0.012;
        for (const side of [-1, 1]) {
          const a = a0 + side * spread * 3;
          edges.push(x0, h0, z0, Math.cos(a) * r0, base + 30, Math.sin(a) * r0);
        }
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
    // Triangles are wound to face inwards, towards the battlefield.
    geo.computeVertexNormals();
    const mesh = new Mesh(geo, this.materials.solidFor('mountain'));
    mesh.frustumCulled = false;
    this.group.add(mesh);
    const lineGeo = new LineSegmentsGeometry().setPositions(new Float32Array(edges));
    const lines = new LineSegments2(lineGeo, this.mountainEdgeMaterial);
    lines.frustumCulled = false;
    this.group.add(lines);
    this.disposables.push(geo, lineGeo);
  }

  private buildMoon(): void {
    const dist = SKY_RADIUS * 0.9;
    const elevation = 0.42;
    const azimuth = -0.9;
    const cx = Math.cos(azimuth) * Math.cos(elevation) * dist;
    const cy = Math.sin(elevation) * dist;
    const cz = Math.sin(azimuth) * Math.cos(elevation) * dist;
    // Basis perpendicular to the view direction from the origin.
    const rx = -Math.sin(azimuth);
    const rz = Math.cos(azimuth);
    const radius = 95;
    const seg: number[] = [];
    const point = (u: number, v: number): [number, number, number] => [cx + rx * u, cy + v, cz + rz * u];
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const a0 = (i / steps) * Math.PI * 2;
      const a1 = ((i + 1) / steps) * Math.PI * 2;
      seg.push(...point(Math.cos(a0) * radius, Math.sin(a0) * radius), ...point(Math.cos(a1) * radius, Math.sin(a1) * radius));
    }
    // Crescent terminator arc.
    for (let i = 0; i < steps / 2; i++) {
      const a0 = -Math.PI / 2 + (i / (steps / 2)) * Math.PI;
      const a1 = -Math.PI / 2 + ((i + 1) / (steps / 2)) * Math.PI;
      seg.push(...point(Math.cos(a0) * radius * 0.45, Math.sin(a0) * radius), ...point(Math.cos(a1) * radius * 0.45, Math.sin(a1) * radius));
    }
    const geo = new LineSegmentsGeometry().setPositions(new Float32Array(seg));
    const moon = new LineSegments2(geo, this.moonMaterial);
    moon.frustumCulled = false;
    this.group.add(moon);
    this.disposables.push(geo);
  }

  applyMode(spec: GraphicsModeSpec): void {
    const u = this.skyMaterial.uniforms as Record<string, { value: Color }>;
    u.uZenith!.value.setHex(spec.skyZenith);
    u.uHorizon!.value.setHex(spec.skyHorizon);
    u.uGlow!.value.setHex(spec.horizonGlow);
    u.uGround!.value.setHex(spec.fogColor);
    this.stars.visible = spec.stars;
    this.mountainEdgeMaterial.color.setHex(spec.mountains.edge);
    this.mountainEdgeMaterial.linewidth = spec.edgeWidth * 1.2;
    this.moonMaterial.color.setHex(spec.id === 'classic' ? spec.mountains.edge : 0x8f9cd0);
    this.moonMaterial.linewidth = spec.edgeWidth;
  }

  /** Keeps the backdrop centred on the camera so it never gets closer. */
  follow(x: number, z: number): void {
    this.group.position.set(x, 0, z);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.materials.release(this.mountainEdgeMaterial);
    this.materials.release(this.moonMaterial);
    this.group.removeFromParent();
  }
}
