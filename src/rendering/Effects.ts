/**
 * Visual effects driven by simulation events: muzzle flashes, impacts,
 * explosions with vector debris and shockwaves, smoke, dust and dynamic
 * lights. All resources are pooled; nothing is allocated per event.
 */
import type { InterleavedBufferAttribute, Scene } from 'three';
import { AdditiveBlending, CanvasTexture, Color, PointLight, Sphere, Sprite, SpriteMaterial, Vector3 } from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { GameEvent } from '../game/events';
import type { Random } from '../utils/random';
import type { GraphicsModeSpec } from './GraphicsModes';
import type { MaterialLibrary } from './Materials';
import type { ParticleSpawn } from './Particles';
import { ParticleSystem } from './Particles';

const LIGHT_POOL = 4;
const FLASH_POOL = 10;
const SHOCKWAVE_POOL = 8;
const DEBRIS_POOL = 260;
const RING_SEGMENTS = 48;
const WRECK_SMOKE_TIME = 10;
const HIDDEN_Y = -10000;

interface LightSlot {
  light: PointLight;
  life: number;
  maxLife: number;
  peak: number;
}

interface FlashSlot {
  sprite: Sprite;
  life: number;
  maxLife: number;
  size: number;
}

interface RingSlot {
  lines: LineSegments2;
  material: LineMaterial;
  life: number;
  maxLife: number;
  radius: number;
}

interface Emitter {
  x: number;
  y: number;
  z: number;
  until: number;
  accumulator: number;
}

function makeFlashTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,240,200,0.8)');
    g.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // Four-point star streaks.
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(size / 2, 4);
    ctx.lineTo(size / 2, size - 4);
    ctx.moveTo(4, size / 2);
    ctx.lineTo(size - 4, size / 2);
    ctx.stroke();
  }
  return new CanvasTexture(canvas);
}

export class Effects {
  private readonly sparks = new ParticleSystem(2400, true);
  private readonly smoke = new ParticleSystem(1400, false);
  private readonly lights: LightSlot[] = [];
  private readonly flashes: FlashSlot[] = [];
  private readonly rings: RingSlot[] = [];
  private readonly flashTexture: CanvasTexture;
  private readonly debrisGeometry: LineSegmentsGeometry;
  private readonly debrisMaterial: LineMaterial;
  private readonly debrisPositions = new Float32Array(DEBRIS_POOL * 6);
  private readonly debrisColours = new Float32Array(DEBRIS_POOL * 6);
  private readonly debrisState = new Float32Array(DEBRIS_POOL * 12);
  private readonly debrisLife = new Float32Array(DEBRIS_POOL);
  private readonly debrisMaxLife = new Float32Array(DEBRIS_POOL);
  private debrisNext = 0;
  private debrisActive = 0;
  private readonly emitters: Emitter[] = [];
  private spec: GraphicsModeSpec | null = null;
  private readonly colour = new Color();
  private readonly colourB = new Color();
  private readonly spawn: ParticleSpawn = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, life: 1, gravity: 0, drag: 0, growth: 0, alpha: 1 };
  /** Camera shake energy in [0, 1]; read and decayed by the camera. */
  trauma = 0;
  private time = 0;

  constructor(
    private readonly scene: Scene,
    private readonly materials: MaterialLibrary,
    private readonly rng: Random,
  ) {
    scene.add(this.sparks.points, this.smoke.points);
    this.flashTexture = makeFlashTexture();
    for (let i = 0; i < LIGHT_POOL; i++) {
      const light = new PointLight(0xffc070, 0, 70, 1.6);
      light.position.set(0, HIDDEN_Y, 0);
      scene.add(light);
      this.lights.push({ light, life: 0, maxLife: 1, peak: 0 });
    }
    for (let i = 0; i < FLASH_POOL; i++) {
      const material = new SpriteMaterial({ map: this.flashTexture, blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false });
      const sprite = new Sprite(material);
      sprite.visible = false;
      sprite.renderOrder = 6;
      scene.add(sprite);
      this.flashes.push({ sprite, life: 0, maxLife: 1, size: 1 });
    }
    const ringPositions: number[] = [];
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const a0 = (i / RING_SEGMENTS) * Math.PI * 2;
      const a1 = ((i + 1) / RING_SEGMENTS) * Math.PI * 2;
      ringPositions.push(Math.cos(a0), 0, Math.sin(a0), Math.cos(a1), 0, Math.sin(a1));
    }
    const ringGeometry = new LineSegmentsGeometry().setPositions(new Float32Array(ringPositions));
    for (let i = 0; i < SHOCKWAVE_POOL; i++) {
      const material = materials.register(new LineMaterial({ color: 0xffffff, linewidth: 2.2, transparent: true, depthWrite: false, blending: AdditiveBlending }));
      const lines = new LineSegments2(ringGeometry, material);
      lines.visible = false;
      lines.frustumCulled = false;
      scene.add(lines);
      this.rings.push({ lines, material, life: 0, maxLife: 1, radius: 1 });
    }

    this.debrisPositions.fill(0);
    for (let i = 0; i < DEBRIS_POOL; i++) this.debrisPositions[i * 6 + 1] = this.debrisPositions[i * 6 + 4] = HIDDEN_Y;
    this.debrisGeometry = new LineSegmentsGeometry().setPositions(this.debrisPositions);
    this.debrisGeometry.setColors(this.debrisColours);
    this.debrisGeometry.boundingSphere = new Sphere(new Vector3(), 1e6);
    this.debrisMaterial = materials.register(new LineMaterial({ color: 0xffffff, linewidth: 1.8, vertexColors: true, fog: true }));
    const debris = new LineSegments2(this.debrisGeometry, this.debrisMaterial);
    debris.frustumCulled = false;
    scene.add(debris);
  }

  applyMode(spec: GraphicsModeSpec): void {
    this.spec = spec;
    this.debrisMaterial.linewidth = spec.edgeWidth;
  }

  /** Keeps particle sizes in metres for the current viewport and FOV. */
  setViewport(heightPx: number, fovDeg: number): void {
    const scale = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
    this.sparks.setScale(scale);
    this.smoke.setScale(scale);
  }

  handleEvent(e: GameEvent, camera: Vector3, edgeColourOf: (tankId: number) => number): void {
    const spec = this.spec;
    if (!spec) return;
    switch (e.type) {
      case 'fire': {
        const mx = e.x + e.dx * 0.6;
        const my = e.y + e.dy * 0.6;
        const mz = e.z + e.dz * 0.6;
        // Shrink flashes right in front of the camera so the gunner view isn't blinded.
        const nearScale = Math.min(1, Math.max(0.18, Math.hypot(camera.x - mx, camera.y - my, camera.z - mz) / 14));
        this.flash(mx, my, mz, (e.faction === 'player' ? 3.2 : 2.6) * nearScale, 0.09);
        this.flashLight(mx, my, mz, spec.explosion[2] ?? 0xffd23f, 14, 0.12);
        this.burst(mx, my, mz, 14, e.dx * 26, e.dy * 26, e.dz * 26, 9, 0.35, spec.explosion, 0.22, 0);
        this.puff(mx, my, mz, 6, e.dx * 4, 1, e.dz * 4, 1.2, 2.2);
        this.addTrauma(this.distanceTrauma(camera, e.x, e.y, e.z, 30, e.faction === 'player' ? 0.18 : 0.08));
        break;
      }
      case 'impact': {
        const hot = spec.explosion;
        if (e.surface === 'terrain') {
          this.burst(e.x, e.y + 0.3, e.z, 16, 0, 9, 0, 9, 0.6, hot, 0.25, 14);
          this.puff(e.x, e.y + 0.5, e.z, 14, 0, 3.5, 0, 2.4, 2.6);
          this.ring(e.x, e.y + 0.4, e.z, 7, 0.45, hot[2] ?? 0xffd23f);
        } else if (e.surface === 'obstacle') {
          this.burst(e.x, e.y, e.z, 24, 0, 4, 0, 14, 0.5, hot, 0.22, 10);
          this.debris(e.x, e.y, e.z, 6, spec.structure.edge, 8, 1.2);
        } else {
          this.burst(e.x, e.y, e.z, 30, 0, 3, 0, 16, 0.45, hot, 0.25, 9);
          this.flash(e.x, e.y, e.z, 4, 0.12);
        }
        this.flashLight(e.x, e.y + 1, e.z, hot[3] ?? 0xff8a1f, 10, 0.25);
        this.addTrauma(this.distanceTrauma(camera, e.x, e.y, e.z, 45, 0.3));
        break;
      }
      case 'tankDestroyed':
        this.explosion(e.x, e.y + 1.4, e.z, edgeColourOf(e.tankId), e.faction === 'player' ? 1.4 : 1);
        this.addTrauma(this.distanceTrauma(camera, e.x, e.y, e.z, 140, e.faction === 'player' ? 1 : 0.7));
        this.emitters.push({ x: e.x, y: e.y + 1.6, z: e.z, until: this.time + WRECK_SMOKE_TIME, accumulator: 0 });
        break;
      case 'playerDamaged':
        this.addTrauma(0.35 + e.amount / 120);
        break;
      default:
        break;
    }
  }

  private distanceTrauma(camera: Vector3, x: number, y: number, z: number, range: number, max: number): number {
    const d = Math.hypot(camera.x - x, camera.y - y, camera.z - z);
    return Math.max(0, 1 - d / range) * max;
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  private explosion(x: number, y: number, z: number, edgeColour: number, scale: number): void {
    const spec = this.spec;
    if (!spec) return;
    this.flash(x, y, z, 26 * scale, 0.35);
    this.flashLight(x, y, z, spec.explosion[1] ?? 0xfff1a0, 60 * scale, 0.8);
    this.burst(x, y, z, Math.round(110 * scale), 0, 6, 0, 26 * scale, 1.1, spec.explosion, 0.5, 9);
    this.burst(x, y, z, 40, 0, 12, 0, 10, 1.8, spec.explosion, 0.9, 4);
    this.puff(x, y, z, Math.round(36 * scale), 0, 5, 0, 7, 4.5);
    this.debris(x, y, z, Math.round(34 * scale), edgeColour, 15 * scale, 2.6);
    this.debris(x, y, z, 10, spec.explosion[1] ?? 0xffffff, 10 * scale, 1.4);
    this.ring(x, y - 1, z, 26 * scale, 0.7, spec.explosion[2] ?? 0xffd23f);
    this.ring(x, y - 0.8, z, 42 * scale, 1.1, spec.explosion[3] ?? 0xff8a1f);
  }

  /** Damaged and wrecked tanks trail smoke; call each frame with a rate in particles/sec. */
  trailSmoke(x: number, y: number, z: number, rate: number, dt: number): void {
    if (this.rng.next() > rate * dt) return;
    this.puff(x, y, z, 1, this.rng.signed() * 0.6, 2.4, this.rng.signed() * 0.6, 1.8, 3.5);
  }

  /** Dust kicked up behind a moving tank. */
  dust(x: number, y: number, z: number, intensity: number): void {
    const spec = this.spec;
    if (!spec?.dust) return;
    const s = this.spawn;
    s.x = x;
    s.y = y + 0.3;
    s.z = z;
    s.vx = this.rng.signed() * 1.2;
    s.vy = this.rng.range(0.4, 1.4);
    s.vz = this.rng.signed() * 1.2;
    s.size = 1.4;
    s.life = 1.4;
    s.gravity = 0.2;
    s.drag = 1.5;
    s.growth = 1.4;
    s.alpha = 0.22 * intensity;
    this.colour.setHex(spec.terrain.grid).lerp(this.colourB.setHex(spec.smoke), 0.7);
    this.smoke.emit(s, this.colour);
  }

  private burst(x: number, y: number, z: number, count: number, bvx: number, bvy: number, bvz: number, speed: number, life: number, palette: readonly number[], size: number, gravity: number): void {
    const s = this.spawn;
    for (let i = 0; i < count; i++) {
      // Uniform direction on a sphere.
      const u = this.rng.signed();
      const theta = this.rng.range(0, Math.PI * 2);
      const r = Math.sqrt(1 - u * u);
      const v = speed * this.rng.range(0.3, 1);
      s.x = x;
      s.y = y;
      s.z = z;
      s.vx = bvx + Math.cos(theta) * r * v;
      s.vy = bvy + Math.abs(u) * v;
      s.vz = bvz + Math.sin(theta) * r * v;
      s.size = size * this.rng.range(0.6, 1.4);
      s.life = life * this.rng.range(0.5, 1.2);
      s.gravity = gravity;
      s.drag = 2.2;
      s.growth = 0;
      s.alpha = 1;
      this.colour.setHex(palette[Math.min(palette.length - 1, Math.floor(this.rng.next() * palette.length))] ?? 0xffffff);
      this.colour.multiplyScalar(1.6);
      this.sparks.emit(s, this.colour);
    }
  }

  private puff(x: number, y: number, z: number, count: number, vx: number, vy: number, vz: number, size: number, life: number): void {
    const spec = this.spec;
    if (!spec) return;
    const s = this.spawn;
    this.colour.setHex(spec.smoke);
    for (let i = 0; i < count; i++) {
      s.x = x + this.rng.signed() * 0.8;
      s.y = y + this.rng.signed() * 0.4;
      s.z = z + this.rng.signed() * 0.8;
      s.vx = vx + this.rng.signed() * 1.6;
      s.vy = vy * this.rng.range(0.6, 1.2);
      s.vz = vz + this.rng.signed() * 1.6;
      s.size = size * this.rng.range(0.7, 1.3);
      s.life = life * this.rng.range(0.7, 1.3);
      s.gravity = -0.4;
      s.drag = 1.2;
      s.growth = 0.9;
      s.alpha = spec.id === 'classic' ? 0.35 : 0.55;
      this.smoke.emit(s, this.colour);
    }
  }

  private flash(x: number, y: number, z: number, size: number, life: number): void {
    const slot = this.flashes.reduce((best, f) => (f.life < best.life ? f : best));
    slot.sprite.position.set(x, y, z);
    slot.sprite.visible = true;
    slot.life = life;
    slot.maxLife = life;
    slot.size = size;
    const tint = this.spec?.id === 'classic' ? 0x9dffb8 : 0xffffff;
    slot.sprite.material.color.setHex(tint);
  }

  private flashLight(x: number, y: number, z: number, colour: number, intensity: number, life: number): void {
    const slot = this.lights.reduce((best, l) => (l.life < best.life ? l : best));
    slot.light.position.set(x, y, z);
    slot.light.color.setHex(colour);
    slot.life = life;
    slot.maxLife = life;
    slot.peak = intensity * 40;
  }

  private ring(x: number, y: number, z: number, radius: number, life: number, colour: number): void {
    const slot = this.rings.reduce((best, r) => (r.life < best.life ? r : best));
    slot.lines.position.set(x, y, z);
    slot.lines.visible = true;
    slot.life = life;
    slot.maxLife = life;
    slot.radius = radius;
    slot.material.color.setHex(colour).multiplyScalar(1.5);
  }

  private debris(x: number, y: number, z: number, count: number, colour: number, speed: number, life: number): void {
    this.colour.setHex(colour).multiplyScalar(1.4);
    for (let n = 0; n < count; n++) {
      const i = this.debrisNext;
      this.debrisNext = (this.debrisNext + 1) % DEBRIS_POOL;
      if (this.debrisLife[i]! <= 0) this.debrisActive++;
      const k = i * 12;
      const st = this.debrisState;
      st[k] = x;
      st[k + 1] = y;
      st[k + 2] = z;
      const theta = this.rng.range(0, Math.PI * 2);
      const v = speed * this.rng.range(0.4, 1);
      st[k + 3] = Math.cos(theta) * v;
      st[k + 4] = this.rng.range(0.4, 1.1) * speed;
      st[k + 5] = Math.sin(theta) * v;
      // Half-extent vector of the shard and its spin axis rate.
      const len = this.rng.range(0.3, 1.4);
      st[k + 6] = this.rng.signed() * len;
      st[k + 7] = this.rng.signed() * len;
      st[k + 8] = this.rng.signed() * len;
      st[k + 9] = this.rng.signed() * 9;
      st[k + 10] = this.rng.signed() * 9;
      st[k + 11] = 0;
      this.debrisLife[i] = life * this.rng.range(0.6, 1.2);
      this.debrisMaxLife[i] = this.debrisLife[i]!;
      const c = i * 6;
      this.debrisColours[c] = this.debrisColours[c + 3] = this.colour.r;
      this.debrisColours[c + 1] = this.debrisColours[c + 4] = this.colour.g;
      this.debrisColours[c + 2] = this.debrisColours[c + 5] = this.colour.b;
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.sparks.update(dt);
    this.smoke.update(dt);
    for (const l of this.lights) {
      if (l.life <= 0) continue;
      l.life -= dt;
      const t = Math.max(0, l.life / l.maxLife);
      l.light.intensity = l.peak * t * t;
      if (l.life <= 0) l.light.intensity = 0;
    }
    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      const t = Math.max(0, f.life / f.maxLife);
      f.sprite.scale.setScalar(f.size * (1.2 - 0.4 * t));
      f.sprite.material.opacity = t;
      if (f.life <= 0) f.sprite.visible = false;
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const t = Math.max(0, 1 - r.life / r.maxLife);
      const radius = r.radius * (0.15 + 0.85 * Math.sqrt(t));
      r.lines.scale.set(radius, 1, radius);
      r.material.opacity = 1 - t;
      if (r.life <= 0) r.lines.visible = false;
    }
    this.updateDebris(dt);
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i]!;
      if (this.time > e.until) {
        this.emitters.splice(i, 1);
        continue;
      }
      this.trailSmoke(e.x, e.y, e.z, 9, dt);
      if (this.rng.next() < dt * 6) this.burst(e.x, e.y - 0.4, e.z, 1, 0, 2.5, 0, 1.5, 0.6, this.spec?.explosion ?? [0xff8a1f], 0.35, -1);
    }
  }

  private updateDebris(dt: number): void {
    if (this.debrisActive === 0) return;
    let active = 0;
    const st = this.debrisState;
    for (let i = 0; i < DEBRIS_POOL; i++) {
      let life = this.debrisLife[i]!;
      if (life <= 0) continue;
      life -= dt;
      this.debrisLife[i] = life;
      const p = i * 6;
      if (life <= 0) {
        this.debrisPositions[p + 1] = this.debrisPositions[p + 4] = HIDDEN_Y;
        continue;
      }
      active++;
      const k = i * 12;
      st[k + 4] = st[k + 4]! - 16 * dt;
      st[k] = st[k]! + st[k + 3]! * dt;
      st[k + 1] = Math.max(st[k + 1]! + st[k + 4]! * dt, -1000);
      st[k + 2] = st[k + 2]! + st[k + 5]! * dt;
      // Rotate the half-extent vector about Y and X for a tumbling shard.
      const ay = st[k + 9]! * dt;
      const ax = st[k + 10]! * dt;
      let hx = st[k + 6]!;
      let hy = st[k + 7]!;
      let hz = st[k + 8]!;
      const cy = Math.cos(ay);
      const sy = Math.sin(ay);
      [hx, hz] = [hx * cy + hz * sy, -hx * sy + hz * cy];
      const cx = Math.cos(ax);
      const sx = Math.sin(ax);
      [hy, hz] = [hy * cx - hz * sx, hy * sx + hz * cx];
      st[k + 6] = hx;
      st[k + 7] = hy;
      st[k + 8] = hz;
      this.debrisPositions[p] = st[k] - hx;
      this.debrisPositions[p + 1] = st[k + 1]! - hy;
      this.debrisPositions[p + 2] = st[k + 2]! - hz;
      this.debrisPositions[p + 3] = st[k] + hx;
      this.debrisPositions[p + 4] = st[k + 1]! + hy;
      this.debrisPositions[p + 5] = st[k + 2]! + hz;
      const fade = Math.min(1, life / (this.debrisMaxLife[i]! * 0.5));
      const c = i * 6;
      for (let j = 0; j < 6; j++) this.debrisColours[c + j] = this.debrisColours[c + j]! * (0.985 + 0.015 * fade);
    }
    this.debrisActive = active;
    (this.debrisGeometry.getAttribute('instanceStart') as InterleavedBufferAttribute).data.needsUpdate = true;
    (this.debrisGeometry.getAttribute('instanceColorStart') as InterleavedBufferAttribute).data.needsUpdate = true;
  }

  /** Stops all effects (e.g. on restart). */
  clear(): void {
    this.sparks.clear();
    this.smoke.clear();
    this.emitters.length = 0;
    this.trauma = 0;
    for (const l of this.lights) {
      l.life = 0;
      l.light.intensity = 0;
    }
    for (const f of this.flashes) {
      f.life = 0;
      f.sprite.visible = false;
    }
    for (const r of this.rings) {
      r.life = 0;
      r.lines.visible = false;
    }
    this.debrisLife.fill(0);
    for (let i = 0; i < DEBRIS_POOL; i++) this.debrisPositions[i * 6 + 1] = this.debrisPositions[i * 6 + 4] = HIDDEN_Y;
    this.debrisActive = 1;
    this.updateDebris(0);
  }

  get particleCount(): number {
    return this.sparks.active + this.smoke.active + this.debrisActive;
  }

  dispose(): void {
    this.sparks.dispose();
    this.smoke.dispose();
    for (const l of this.lights) this.scene.remove(l.light);
    for (const f of this.flashes) {
      f.sprite.material.dispose();
      this.scene.remove(f.sprite);
    }
    for (const r of this.rings) {
      this.materials.release(r.material);
      this.scene.remove(r.lines);
    }
    this.rings[0]?.lines.geometry.dispose();
    this.flashTexture.dispose();
    this.debrisGeometry.dispose();
    this.materials.release(this.debrisMaterial);
  }
}
