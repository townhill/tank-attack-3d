/**
 * Glowing shells (one instanced draw call) with fading tracer trails
 * (one line draw call). Positions interpolate between simulation ticks.
 */
import type { InterleavedBufferAttribute, Scene } from 'three';
import { Color, InstancedMesh, Matrix4, MeshBasicMaterial, OctahedronGeometry, Quaternion, Sphere, Vector3 } from 'three';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { ProjectilePool } from '../entities/Projectile';
import { lerp } from '../utils/math';
import type { GraphicsModeSpec } from './GraphicsModes';
import type { MaterialLibrary } from './Materials';

const TRAIL_SECONDS = 0.05;
const SHELL_GLOW = 2.2;

export class ProjectileView {
  private readonly mesh: InstancedMesh;
  private readonly material: MeshBasicMaterial;
  private readonly trailGeometry: LineSegmentsGeometry;
  private readonly trailMaterial: LineMaterial;
  private readonly trailPositions: Float32Array;
  private readonly trailColours: Float32Array;
  private readonly playerColour = new Color();
  private readonly enemyColour = new Color();
  private readonly matrix = new Matrix4();
  private readonly quat = new Quaternion();
  private readonly pos = new Vector3();
  private readonly dir = new Vector3();
  private readonly scale = new Vector3(0.22, 0.22, 1.1);
  private readonly forward = new Vector3(0, 0, 1);

  constructor(scene: Scene, private readonly capacity: number, private readonly materials: MaterialLibrary) {
    const geo = new OctahedronGeometry(1, 0);
    this.material = new MeshBasicMaterial({ color: 0xffffff, fog: false });
    this.mesh = new InstancedMesh(geo, this.material, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);

    this.trailPositions = new Float32Array(capacity * 6);
    this.trailColours = new Float32Array(capacity * 6);
    this.trailGeometry = new LineSegmentsGeometry().setPositions(this.trailPositions);
    this.trailGeometry.setColors(this.trailColours);
    this.trailGeometry.boundingSphere = new Sphere(new Vector3(), 1e6);
    this.trailMaterial = materials.createEdgeMaterial(0xffffff, 2.4);
    this.trailMaterial.vertexColors = true;
    const trails = new LineSegments2(this.trailGeometry, this.trailMaterial);
    trails.frustumCulled = false;
    scene.add(trails);
  }

  applyMode(spec: GraphicsModeSpec): void {
    this.playerColour.setHex(spec.playerShell).multiplyScalar(SHELL_GLOW);
    this.enemyColour.setHex(spec.enemyShell).multiplyScalar(SHELL_GLOW);
    this.trailMaterial.linewidth = spec.edgeWidth * 1.4;
  }

  sync(pool: ProjectilePool, alpha: number): void {
    let n = 0;
    for (const p of pool.items) {
      const t = n * 6;
      if (!p.active || n >= this.capacity) continue;
      this.pos.set(lerp(p.prevX, p.x, alpha), lerp(p.prevY, p.y, alpha), lerp(p.prevZ, p.z, alpha));
      this.dir.set(p.vx, p.vy, p.vz);
      const speed = this.dir.length();
      if (speed < 1e-3) continue;
      this.dir.divideScalar(speed);
      this.quat.setFromUnitVectors(this.forward, this.dir);
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.mesh.setMatrixAt(n, this.matrix);
      const colour = p.faction === 'player' ? this.playerColour : this.enemyColour;
      this.mesh.setColorAt(n, colour);
      const tail = Math.min(speed * TRAIL_SECONDS, p.age * speed);
      this.trailPositions[t] = this.pos.x;
      this.trailPositions[t + 1] = this.pos.y;
      this.trailPositions[t + 2] = this.pos.z;
      this.trailPositions[t + 3] = this.pos.x - this.dir.x * tail;
      this.trailPositions[t + 4] = this.pos.y - this.dir.y * tail;
      this.trailPositions[t + 5] = this.pos.z - this.dir.z * tail;
      this.trailColours[t] = colour.r;
      this.trailColours[t + 1] = colour.g;
      this.trailColours[t + 2] = colour.b;
      this.trailColours[t + 3] = colour.r * 0.08;
      this.trailColours[t + 4] = colour.g * 0.05;
      this.trailColours[t + 5] = colour.b * 0.02;
      n++;
    }
    // Collapse unused trail slots.
    for (let i = n; i < this.capacity; i++) {
      const t = i * 6;
      if (this.trailPositions[t + 1] === -10000) break;
      for (let k = 0; k < 6; k++) this.trailPositions[t + k] = k === 1 || k === 4 ? -10000 : 0;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    (this.trailGeometry.getAttribute('instanceStart') as InterleavedBufferAttribute).data.needsUpdate = true;
    (this.trailGeometry.getAttribute('instanceColorStart') as InterleavedBufferAttribute).data.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.removeFromParent();
    this.trailGeometry.dispose();
    this.materials.release(this.trailMaterial);
  }
}
