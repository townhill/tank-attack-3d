/**
 * Scene representation of one tank: interpolated pose, turret/gun/recoil,
 * animated tracks, damage colouring and the destruction sequence.
 */
import type { InterleavedBufferAttribute } from 'three';
import { Color, Group, Mesh, Quaternion, Sphere, Vector3 } from 'three';
import type { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { TankKind } from '../config/settings';
import type { Tank } from '../entities/Tank';
import { lerp, lerpAngle } from '../utils/math';
import type { Random } from '../utils/random';
import type { GraphicsModeSpec } from './GraphicsModes';
import type { MaterialLibrary } from './Materials';
import type { PartGeometry } from './TankModel';
import { getTankGeometry, TRACK_SEGMENT_COUNT, writeTrackSegments } from './TankModel';

/** Track animation is only refreshed for tanks closer than this (metres). */
const TRACK_LOD_DISTANCE = 220;
const TURRET_GRAVITY = 14;
const LOW_HEALTH = 0.35;
const WHITE = new Color(0xffffff);

interface PartObjects {
  readonly group: Group;
  readonly solid: Mesh;
  readonly detail: LineSegments2 | null;
}

export class TankView {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly turret: PartObjects;
  private readonly gun = new Group();
  private readonly barrel: PartObjects;
  private readonly mantlet: PartObjects;
  private readonly hull: PartObjects;
  private readonly edgeMaterial: LineMaterial;
  private readonly trackGeometry: LineSegmentsGeometry;
  private readonly trackPositions: Float32Array;
  private readonly baseColour = new Color();
  private readonly damagedColour = new Color();
  private readonly colour = new Color();
  private readonly kind: TankKind;
  private spec: GraphicsModeSpec | null = null;
  private destroyedAt = -1;
  private readonly turretVelocity = new Vector3();
  private turretSpin = 0;
  private turretLanded = false;
  private lastPhaseLeft = Number.NaN;
  private lastPhaseRight = Number.NaN;
  private readonly tmpQuat = new Quaternion();

  constructor(
    readonly tankId: number,
    tank: Tank,
    private readonly materials: MaterialLibrary,
    private readonly rng: Random,
  ) {
    this.kind = tank.spec.kind;
    const geo = getTankGeometry(this.kind);
    this.edgeMaterial = materials.createEdgeMaterial(0xffffff, 1.6);
    const s = tank.spec;

    this.hull = this.makePart(geo.hull);
    this.turret = this.makePart(geo.turret);
    this.mantlet = this.makePart(geo.mantlet);
    this.barrel = this.makePart(geo.barrel);

    this.turret.group.position.set(0, s.turretPivotY, s.turretPivotZ);
    this.gun.position.set(0, s.gunPivotY, s.gunPivotZ);
    this.gun.add(this.mantlet.group, this.barrel.group);
    this.turret.group.add(this.gun);

    this.trackPositions = new Float32Array(TRACK_SEGMENT_COUNT * 6);
    writeTrackSegments(this.trackPositions, 0, 0);
    this.trackGeometry = new LineSegmentsGeometry().setPositions(this.trackPositions);
    this.trackGeometry.boundingSphere = new Sphere(new Vector3(0, 0.6, 0), 4.5);
    const trackLines = new LineSegments2(this.trackGeometry, this.edgeMaterial);

    this.body.add(this.hull.group, this.turret.group, trackLines);
    this.body.scale.setScalar(s.scale);
    this.root.add(this.body);
    this.root.name = `tank-${tank.id}`;
  }

  private makePart(part: PartGeometry): PartObjects {
    const group = new Group();
    const solid = new Mesh(part.solid, this.materials.solidFor(this.kind));
    solid.castShadow = true;
    solid.receiveShadow = true;
    const edges = new LineSegments2(part.edges, this.edgeMaterial);
    group.add(solid, edges);
    let detail: LineSegments2 | null = null;
    if (part.detail) {
      detail = new LineSegments2(part.detail, this.edgeMaterial);
      group.add(detail);
    }
    return { group, solid, detail };
  }

  applyMode(spec: GraphicsModeSpec): void {
    this.spec = spec;
    this.baseColour.setHex(spec.tanks[this.kind].edge);
    this.damagedColour.setHex(spec.wreckEdge);
    this.edgeMaterial.linewidth = spec.edgeWidth * (this.kind === 'player' ? 1.1 : 1);
    for (const p of [this.hull, this.turret, this.mantlet, this.barrel]) {
      if (p.detail) p.detail.visible = spec.panelDetail;
      p.solid.material = this.materials.solidFor(this.destroyedAt >= 0 ? 'wreck' : this.kind);
    }
  }

  /**
   * Updates the view from simulation state. `alpha` interpolates between the
   * previous and current simulation ticks.
   */
  sync(tank: Tank, alpha: number, dt: number, time: number, cameraDistance: number): void {
    const prev = tank.prev;
    this.root.position.set(lerp(prev.x, tank.x, alpha), lerp(prev.y, tank.y, alpha), lerp(prev.z, tank.z, alpha));
    this.tmpQuat.copy(prev.orientation).slerp(tank.orientation, alpha);
    this.root.quaternion.copy(this.tmpQuat);

    if (tank.alive) {
      this.turret.group.rotation.set(0, -lerpAngle(prev.turretYaw, tank.turretYaw, alpha), 0);
      this.gun.rotation.set(lerp(prev.gunPitch, tank.gunPitch, alpha), 0, 0);
      this.barrel.group.position.z = tank.recoil * tank.recoil * 0.65;
      if (cameraDistance < TRACK_LOD_DISTANCE) this.updateTracks(tank);
    } else {
      this.updateDestruction(tank, dt);
    }
    this.updateColour(tank, time);
  }

  private updateTracks(tank: Tank): void {
    if (tank.trackPhaseLeft === this.lastPhaseLeft && tank.trackPhaseRight === this.lastPhaseRight) return;
    this.lastPhaseLeft = tank.trackPhaseLeft;
    this.lastPhaseRight = tank.trackPhaseRight;
    writeTrackSegments(this.trackPositions, tank.trackPhaseLeft, tank.trackPhaseRight);
    (this.trackGeometry.getAttribute('instanceStart') as InterleavedBufferAttribute).data.needsUpdate = true;
  }

  private updateDestruction(tank: Tank, dt: number): void {
    if (this.destroyedAt < 0) {
      this.destroyedAt = tank.destroyedAt;
      // Blow the turret off with a random tumble.
      const side = this.rng.signed();
      this.turretVelocity.set(side * 3, this.rng.range(8, 12), this.rng.signed() * 2.5);
      this.turretSpin = this.rng.signed() * 5;
      this.turretLanded = false;
      for (const p of [this.hull, this.turret, this.mantlet, this.barrel]) p.solid.material = this.materials.solidFor('wreck');
    }
    if (this.turretLanded) return;
    const t = this.turret.group;
    this.turretVelocity.y -= TURRET_GRAVITY * dt;
    t.position.addScaledVector(this.turretVelocity, dt);
    t.rotation.x += this.turretSpin * dt * 0.6;
    t.rotation.z += this.turretSpin * dt;
    const onHull = Math.abs(t.position.x) < 1.9 && Math.abs(t.position.z) < 3.4;
    const rest = onHull ? 2.0 : 0.45;
    if (this.turretVelocity.y < 0 && t.position.y <= rest) {
      t.position.y = rest;
      t.rotation.x = Math.round(t.rotation.x / Math.PI) * Math.PI + this.rng.signed() * 0.25;
      t.rotation.z = Math.round(t.rotation.z / Math.PI) * Math.PI + this.rng.signed() * 0.25;
      this.turretLanded = true;
    }
  }

  private updateColour(tank: Tank, time: number): void {
    const c = this.colour;
    if (!tank.alive) {
      // Smouldering wreck: dim embers that flicker.
      const flicker = 0.75 + 0.25 * Math.sin(time * 13 + this.tankId * 3.1) * Math.sin(time * 7.3 + this.tankId);
      c.copy(this.damagedColour).multiplyScalar(flicker);
      this.edgeMaterial.color.copy(c);
      return;
    }
    c.copy(this.baseColour);
    const health = tank.healthFraction;
    if (health < LOW_HEALTH) {
      const severity = 1 - health / LOW_HEALTH;
      const flicker = 0.5 + 0.5 * Math.sin(time * (10 + severity * 14) + this.tankId);
      c.lerp(this.damagedColour, severity * 0.45 + flicker * severity * 0.3);
    }
    if (tank.damageFlash > 0) c.lerp(WHITE, tank.damageFlash * 0.85).multiplyScalar(1 + tank.damageFlash * 1.5);
    if (tank.recoil > 0.75) c.multiplyScalar(1 + (tank.recoil - 0.75) * 2.4);
    this.edgeMaterial.color.copy(c);
  }

  get isDestroyed(): boolean {
    return this.destroyedAt >= 0;
  }

  get modeSpec(): GraphicsModeSpec | null {
    return this.spec;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.trackGeometry.dispose();
    this.materials.release(this.edgeMaterial);
  }
}
