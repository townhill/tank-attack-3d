/**
 * Pooled GPU point particles (one draw call per system). Used for sparks,
 * fire, smoke and dust. Particles are depth-tested so terrain hides them.
 */
import type { Color } from 'three';
import { AdditiveBlending, BufferAttribute, BufferGeometry, NormalBlending, Points, ShaderMaterial } from 'three';

const VERTEX = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aAlpha > 0.0 ? clamp(aSize * uScale / max(-mv.z, 0.1), 1.0, 256.0) : 0.0;
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vAlpha = aAlpha;
}
`;

const FRAGMENT_ADDITIVE = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`;

const FRAGMENT_NORMAL = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.15, d) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

export interface ParticleSpawn {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
  gravity: number;
  drag: number;
  /** Size multiplier gained per second (smoke billows outwards). */
  growth: number;
  /** Peak opacity. */
  alpha: number;
}

export class ParticleSystem {
  readonly points: Points;
  private readonly material: ShaderMaterial;
  private readonly geometry: BufferGeometry;
  private readonly positions: Float32Array;
  private readonly colours: Float32Array;
  private readonly sizes: Float32Array;
  private readonly alphas: Float32Array;
  private readonly velocity: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly baseSize: Float32Array;
  private readonly peakAlpha: Float32Array;
  private readonly params: Float32Array;
  private next = 0;
  private activeCount = 0;

  constructor(private readonly capacity: number, additive: boolean) {
    this.positions = new Float32Array(capacity * 3);
    this.colours = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    this.velocity = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.peakAlpha = new Float32Array(capacity);
    this.params = new Float32Array(capacity * 3);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aColor', new BufferAttribute(this.colours, 3));
    this.geometry.setAttribute('aSize', new BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aAlpha', new BufferAttribute(this.alphas, 1));
    this.material = new ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: VERTEX,
      fragmentShader: additive ? FRAGMENT_ADDITIVE : FRAGMENT_NORMAL,
      blending: additive ? AdditiveBlending : NormalBlending,
      transparent: true,
      depthWrite: false,
    });
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
  }

  /** Pixel scale so `size` is in metres: viewport height / (2 tan(fov/2)). */
  setScale(scale: number): void {
    this.material.uniforms.uScale!.value = scale;
  }

  emit(p: ParticleSpawn, colour: Color): void {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    if (this.life[i]! <= 0) this.activeCount++;
    this.positions[i * 3] = p.x;
    this.positions[i * 3 + 1] = p.y;
    this.positions[i * 3 + 2] = p.z;
    this.velocity[i * 3] = p.vx;
    this.velocity[i * 3 + 1] = p.vy;
    this.velocity[i * 3 + 2] = p.vz;
    this.colours[i * 3] = colour.r;
    this.colours[i * 3 + 1] = colour.g;
    this.colours[i * 3 + 2] = colour.b;
    this.life[i] = p.life;
    this.maxLife[i] = p.life;
    this.baseSize[i] = p.size;
    this.sizes[i] = p.size;
    this.peakAlpha[i] = p.alpha;
    this.alphas[i] = p.alpha;
    this.params[i * 3] = p.gravity;
    this.params[i * 3 + 1] = p.drag;
    this.params[i * 3 + 2] = p.growth;
  }

  update(dt: number): void {
    if (this.activeCount === 0) return;
    let active = 0;
    for (let i = 0; i < this.capacity; i++) {
      let life = this.life[i]!;
      if (life <= 0) continue;
      life -= dt;
      this.life[i] = life;
      if (life <= 0) {
        this.alphas[i] = 0;
        continue;
      }
      active++;
      const k = i * 3;
      const drag = Math.exp(-this.params[k + 1]! * dt);
      this.velocity[k] = this.velocity[k]! * drag;
      this.velocity[k + 1] = this.velocity[k + 1]! * drag - this.params[k]! * dt;
      this.velocity[k + 2] = this.velocity[k + 2]! * drag;
      this.positions[k] = this.positions[k]! + this.velocity[k] * dt;
      this.positions[k + 1] = this.positions[k + 1]! + this.velocity[k + 1]! * dt;
      this.positions[k + 2] = this.positions[k + 2]! + this.velocity[k + 2]! * dt;
      const t = life / this.maxLife[i]!;
      // Quick fade-in, long fade-out.
      const fade = Math.min(1, (1 - t) * 12) * Math.min(1, t * 1.6);
      this.alphas[i] = this.peakAlpha[i]! * fade;
      this.sizes[i] = this.baseSize[i]! * (1 + this.params[k + 2]! * (this.maxLife[i]! - life));
    }
    this.activeCount = active;
    for (const name of ['position', 'aSize', 'aAlpha', 'aColor']) {
      (this.geometry.getAttribute(name) as BufferAttribute).needsUpdate = true;
    }
  }

  clear(): void {
    this.life.fill(0);
    this.alphas.fill(0);
    this.activeCount = 0;
    (this.geometry.getAttribute('aAlpha') as BufferAttribute).needsUpdate = true;
  }

  get active(): number {
    return this.activeCount;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.points.removeFromParent();
  }
}
