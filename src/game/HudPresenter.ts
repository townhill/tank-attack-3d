/**
 * Translates simulation state and events into HUD content: stats, target
 * brackets for enemies the player can actually see, tactical warnings and
 * incoming-fire indicators.
 */
import type { PerspectiveCamera } from 'three';
import { Vector3 } from 'three';
import { TANK_SPECS } from '../config/settings';
import type { Tank } from '../entities/Tank';
import type { GraphicsModeSpec } from '../rendering/GraphicsModes';
import type { CameraMode } from '../rendering/CameraState';
import { CAMERA_LABELS } from '../rendering/CameraState';
import type { HUD } from '../ui/HUD';
import { MAX_HUD_TARGETS } from '../ui/HUD';
import { angleDiff, DEG, headingOf, toCompassDegrees } from '../utils/math';
import type { AimSolver } from './Aiming';
import type { GameEvent } from './events';
import type { Simulation } from './Simulation';

const BRACKET_RANGE = 900;
const IN_RANGE_CONE = 6 * DEG;
const REAR_ARC = 120 * DEG;

function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export class HudPresenter {
  private readonly projected = new Vector3();
  private readonly centre = new Vector3();
  private readonly cameraForward = new Vector3();

  constructor(private readonly hud: HUD) {}

  /** View yaw used to orient incoming-fire indicators. */
  viewYaw(camera: PerspectiveCamera, mode: CameraMode): number {
    if (mode === 'overhead') return 0;
    camera.getWorldDirection(this.cameraForward);
    return headingOf(this.cameraForward.x, this.cameraForward.z);
  }

  handleEvent(e: GameEvent, sim: Simulation, spec: GraphicsModeSpec, viewYaw: number): void {
    const hud = this.hud;
    switch (e.type) {
      case 'waveStart':
        hud.showBanner(`WAVE ${e.wave}`, `${e.enemies} HOSTILES INBOUND`);
        break;
      case 'waveComplete':
        hud.showBanner('WAVE CLEARED', `+${e.bonus.toLocaleString()} BONUS  ·  ARMOUR +${Math.round(e.repair)}`, 3.2);
        break;
      case 'tankHit':
        if (e.attackerId === sim.player.id && e.faction === 'enemy') hud.flashHitMarker(false);
        break;
      case 'tankDestroyed':
        if (e.byPlayer && e.kind !== 'player') {
          hud.flashHitMarker(true);
          hud.pushFeed(`+${e.score}  ${TANK_SPECS[e.kind].label.toUpperCase()} DESTROYED`, css(spec.tanks[e.kind].edge));
        }
        if (e.faction === 'player') hud.showBanner('TANK DESTROYED', '', 3);
        break;
      case 'playerDamaged': {
        const bearing = headingOf(e.sourceX - sim.player.x, e.sourceZ - sim.player.z);
        hud.addDamageIndicator(angleDiff(viewYaw, bearing));
        break;
      }
      default:
        break;
    }
  }

  fill(
    sim: Simulation,
    camera: PerspectiveCamera,
    mode: CameraMode,
    spec: GraphicsModeSpec,
    aim: AimSolver,
    best: number,
    width: number,
    height: number,
    showTargets: boolean,
    visibleEnemies: ReadonlySet<Tank>,
  ): void {
    const f = this.hud.frame;
    const p = sim.player;
    f.score = sim.stats.score;
    f.best = Math.max(best, sim.stats.score);
    f.wave = sim.waves.wave;
    f.enemies = sim.aliveEnemyCount() + sim.waves.remainingToSpawn;
    f.intermission = sim.waves.phase === 'intermission' && sim.phase === 'playing' ? Math.max(0, sim.waves.timer) : null;
    f.health = p.health;
    f.maxHealth = p.spec.maxHealth;
    f.reload = p.reloadFraction;
    f.speedKmh = Math.abs(p.speed) * 3.6;
    f.hullHeading = toCompassDegrees(p.heading);
    f.turretHeading = toCompassDegrees(p.heading + p.turretYaw);
    const range = aim.aimRange(p);
    f.range = range < 1400 ? range : null;
    f.cameraLabel = CAMERA_LABELS[mode];
    f.modeLabel = spec.label.toUpperCase();
    f.showCrosshair = mode !== 'overhead';

    // Gun marker: where the barrel's current trajectory lands.
    f.gunMarkerVisible = false;
    if (aim.gunImpactValid && this.toScreen(aim.gunImpact, camera, width, height)) {
      f.gunMarkerX = this.projected.x;
      f.gunMarkerY = this.projected.y;
      f.gunMarkerVisible = true;
    }
    f.gunOnTarget = aim.gunTarget !== null && aim.gunTarget.alive && aim.gunTarget.faction === 'enemy';

    let n = 0;
    if (mode === 'overhead' && this.toScreen(aim.aimPoint, camera, width, height)) {
      const t = f.targets[n++]!;
      t.x = this.projected.x;
      t.y = this.projected.y;
      t.size = 9;
      t.colour = css(spec.tanks.player.edge);
      t.label = `${Math.round(range)} m`;
      t.locked = false;
    }
    if (showTargets) {
      for (const tank of visibleEnemies) {
        if (n >= MAX_HUD_TARGETS) break;
        const dist = Math.hypot(tank.x - p.x, tank.z - p.z);
        if (dist > BRACKET_RANGE || !this.toScreen(tank.getCentre(this.centre), camera, width, height)) continue;
        const t = f.targets[n++]!;
        t.x = this.projected.x;
        t.y = this.projected.y;
        // Projected half-length of the hull in pixels.
        const pixelsPerMetre = height / 2 / Math.tan((camera.fov * DEG) / 2) / Math.max(dist, 1);
        t.size = Math.max(9, Math.min(60, tank.spec.hitHalfExtents.z * pixelsPerMetre));
        t.colour = css(spec.tanks[tank.spec.kind].edge);
        t.label = `${TANK_SPECS[tank.spec.kind].label.toUpperCase()} ${Math.round(dist)}m`;
        t.locked = aim.gunTarget === tank;
      }
    }
    f.targetCount = n;
    this.fillMessage(sim, camera, mode, visibleEnemies);
  }

  private fillMessage(sim: Simulation, camera: PerspectiveCamera, mode: CameraMode, visibleEnemies: ReadonlySet<Tank>): void {
    const f = this.hud.frame;
    const p = sim.player;
    f.message = '';
    f.messageDanger = false;
    if (!p.alive) return;
    const aimHeading = p.heading + p.turretYaw;
    for (const tank of visibleEnemies) {
      const dist = Math.hypot(tank.x - p.x, tank.z - p.z);
      if (dist > p.spec.weapon.maxRange) continue;
      if (Math.abs(angleDiff(aimHeading, headingOf(tank.x - p.x, tank.z - p.z))) < IN_RANGE_CONE) {
        f.message = 'ENEMY IN RANGE';
        return;
      }
    }
    // Warn about the nearest enemy that is actively engaging us from outside the view.
    let nearest: Tank | null = null;
    let nearestDist = Infinity;
    for (const e of sim.enemies) {
      if (!e.tank.alive || !e.controller.engaged) continue;
      const d = Math.hypot(e.tank.x - p.x, e.tank.z - p.z);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e.tank;
      }
    }
    if (!nearest || mode === 'overhead') return;
    const viewYaw = this.viewYaw(camera, mode);
    const rel = angleDiff(viewYaw, headingOf(nearest.x - p.x, nearest.z - p.z));
    const halfFov = ((camera.fov * camera.aspect) / 2) * DEG;
    if (Math.abs(rel) > REAR_ARC) f.message = 'ENEMY TO REAR';
    else if (rel < -halfFov) f.message = 'ENEMY TO LEFT';
    else if (rel > halfFov) f.message = 'ENEMY TO RIGHT';
    f.messageDanger = f.message !== '';
  }

  /** Projects a world point to CSS pixels; false when behind the camera or off screen. */
  private toScreen(point: Vector3, camera: PerspectiveCamera, width: number, height: number): boolean {
    this.projected.copy(point).project(camera);
    if (this.projected.z > 1 || this.projected.z < -1) return false;
    const x = (this.projected.x * 0.5 + 0.5) * width;
    const y = (-this.projected.y * 0.5 + 0.5) * height;
    if (x < -40 || x > width + 40 || y < -40 || y > height + 40) return false;
    this.projected.set(x, y, 0);
    return true;
  }
}
