/**
 * Compact phosphor radar scope in the HUD corner, drawn on its own canvas:
 * range rings, a rotating sweep, kind-coloured and kind-shaped enemy contacts,
 * rim chevrons for contacts beyond range, wrecks, shells, nearby obstacles and
 * the playable boundary around the player.
 */
import type { Tank } from '../entities/Tank';
import type { Simulation } from '../game/Simulation';
import { clamp, TAU } from '../utils/math';
import { PARAPET_THICKNESS } from '../world/Bridge';
import type { Obstacle } from '../world/Obstacle';
import type { World } from '../world/World';
import type { Point2 } from './MapProjection';
import { bearingOf, clampToRadius, formatDistance, rotateToView, sweepLag, viewAngle } from './MapProjection';
import type { GraphicsModeId, TacticalTheme } from './tacticalTheme';
import {
  drawBridgeSymbol,
  drawChevron,
  drawUnitSymbol,
  drawWreck,
  LABEL_FONT,
  LABEL_FONT_BOLD,
  rgba,
  tacticalTheme,
  traceRotatedRect,
  unitColor,
} from './tacticalTheme';
import { ShorelineIndex } from './tacticalWater';
import './tactical.css';

export type RadarOrientation = 'heading-up' | 'north-up';

const DEFAULT_RANGE = 400;
const MIN_RANGE = 25;
const MAX_DPR = 3;
/** Gap between the canvas edge and the scope rim (CSS px). */
const RIM_INSET = 6;
/** Seconds per sweep revolution. */
const SWEEP_PERIOD = 2.4;
/** Angular length of the phosphor trail behind the sweep line (radians). */
const SWEEP_TRAIL = 1.2;
const SWEEP_TRAIL_ALPHA = 0.32;
/** Contact brightness just before the sweep repaints it (1 = freshly swept). */
const MIN_SWEEP_BRIGHTNESS = 0.5;
const RING_FRACTIONS = [0.25, 0.5, 0.75] as const;
const COMPASS_TICKS = 12;
const ENEMY_SIZE = 4.5;
const PLAYER_SIZE = 5.5;
const TURRET_LINE_PX = 11;
const CHEVRON_SIZE = 4;
const CHEVRON_INSET = 6;
const WRECK_SIZE = 3;
/** Seconds for a wreck marker to fade out. */
const WRECK_FADE = 10;
/** Direction-of-travel line shows roughly this many seconds of movement. */
const TRAVEL_SECONDS = 5;
const TRAVEL_MIN_PX = 4;
const TRAVEL_MAX_PX = 14;
/** Speeds below this (m/s) count as stationary. */
const MOVING_SPEED = 0.5;
const MIN_STRUCTURE_HALF_PX = 1.5;
const MIN_ROCK_PX = 0.9;
const ENEMY_SHELL_PX = 2.4;
const FRIENDLY_SHELL_PX = 1.6;
const LABEL_OUTLINE = 'rgba(0, 0, 0, 0.75)';
const BOUNDARY_DASH: number[] = [4, 3];
const NO_DASH: number[] = [];
const SHORE_ALPHA = 0.8;
/** Smallest bridge sign on the scope, as half its length and half its width (px). */
const MIN_BRIDGE_HALF_LENGTH_PX = 3;
const MIN_BRIDGE_HALF_WIDTH_PX = 1.5;

export class Radar {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly observer: ResizeObserver;
  private theme: TacticalTheme = tacticalTheme('neon');
  private orientation: RadarOrientation = 'heading-up';
  private range = DEFAULT_RANGE;
  private rangeLabel = formatDistance(DEFAULT_RANGE);
  /** Sweep angle, clockwise from scope up. */
  private sweep = 0;
  /** Canvas size in CSS px. */
  private size = 0;
  private dpr = 1;
  private shown = true;
  private sweepClear = '';
  private sweepTrail = '';
  private sweepLine = '';
  private shoreStroke = '';
  private shores: ShorelineIndex | null = null;
  private shoresWorld: World | null = null;
  private readonly shoreSegments: number[] = [];
  private readonly nearby: Obstacle[] = [];
  private readonly point: Point2 = { x: 0, y: 0 };
  private readonly direction: Point2 = { x: 0, y: 0 };

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'vt-radar';
    this.canvas.setAttribute('aria-hidden', 'true');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Radar: 2D canvas context unavailable');
    this.ctx = ctx;
    this.applyThemeColours();
    parent.appendChild(this.canvas);
    this.observer = new ResizeObserver(() => {
      this.resize();
    });
    this.observer.observe(this.canvas);
    this.resize();
  }

  get visible(): boolean {
    return this.shown;
  }

  setVisible(visible: boolean): void {
    this.shown = visible;
    this.canvas.classList.toggle('vt-hidden', !visible);
    if (visible) this.resize();
  }

  setOrientation(orientation: RadarOrientation): void {
    this.orientation = orientation;
  }

  setTheme(mode: GraphicsModeId): void {
    this.theme = tacticalTheme(mode);
    this.applyThemeColours();
  }

  setRange(metres: number): void {
    if (!(metres > 0) || !Number.isFinite(metres)) return;
    this.range = Math.max(MIN_RANGE, metres);
    this.rangeLabel = formatDistance(this.range);
  }

  /** upHeading: compass heading that points up in heading-up mode (the lead passes the camera/aim heading). */
  render(dt: number, sim: Simulation, upHeading: number): void {
    if (!this.shown || this.size <= 0) return;
    if (dt > 0) this.sweep = (this.sweep + (dt / SWEEP_PERIOD) * TAU) % TAU;
    const up = this.orientation === 'heading-up' && Number.isFinite(upHeading) ? upHeading : 0;
    const ctx = this.ctx;
    const half = this.size / 2;
    const radius = half - RIM_INSET;
    const pxPerMetre = radius / this.range;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.size, this.size);
    ctx.save();
    ctx.translate(half, half);
    this.drawScope(radius);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.clip();
    this.drawBoundary(sim, up, pxPerMetre, radius);
    this.drawWater(sim, up, pxPerMetre);
    this.drawObstacles(sim, up, pxPerMetre);
    this.drawSweep(radius);
    this.drawShells(sim, up, pxPerMetre);
    this.drawEnemies(sim, up, pxPerMetre, radius);
    ctx.restore();
    this.drawCompass(radius, up);
    this.drawPlayer(sim.player, up);
    ctx.restore();
    this.drawLabels();
  }

  resize(): void {
    const size = this.canvas.clientWidth;
    if (size <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const backing = Math.round(size * dpr);
    if (this.canvas.width !== backing) this.canvas.width = backing;
    if (this.canvas.height !== backing) this.canvas.height = backing;
    this.size = size;
    this.dpr = dpr;
  }

  dispose(): void {
    this.observer.disconnect();
    this.canvas.remove();
  }

  /** Shorelines and bridges within range. */
  private drawWater(sim: Simulation, up: number, k: number): void {
    const world = sim.world;
    if (this.shoresWorld !== world) {
      this.shoresWorld = world;
      this.shores = world.water.maxLevel === -Infinity ? null : new ShorelineIndex(world);
    }
    const shores = this.shores;
    if (!shores) return;
    const ctx = this.ctx;
    const p = sim.player;
    const segments = shores.query(p.x, p.z, this.range, this.shoreSegments);
    ctx.beginPath();
    for (let n = 0; n < segments.length; n += 4) {
      const a = this.toScope(segments[n]! - p.x, segments[n + 1]! - p.z, up, k);
      const ax = a.x;
      const ay = a.y;
      const b = this.toScope(segments[n + 2]! - p.x, segments[n + 3]! - p.z, up, k);
      ctx.moveTo(ax, ay);
      ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = this.shoreStroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    for (const bridge of world.bridges) {
      const dx = bridge.x - p.x;
      const dz = bridge.z - p.z;
      const reach = this.range + bridge.halfLength;
      if (dx * dx + dz * dz > reach * reach) continue;
      const q = this.toScope(dx, dz, up, k);
      drawBridgeSymbol(
        ctx, this.theme, q.x, q.y,
        Math.max(MIN_BRIDGE_HALF_LENGTH_PX, bridge.halfLength * k),
        Math.max(MIN_BRIDGE_HALF_WIDTH_PX, (bridge.halfWidth + PARAPET_THICKNESS) * k),
        viewAngle(bridge.yaw, up),
      );
    }
  }

  private applyThemeColours(): void {
    this.shoreStroke = rgba(this.theme.shore, SHORE_ALPHA);
    const c = this.theme.sweep;
    this.sweepClear = rgba(c, 0);
    this.sweepTrail = rgba(c, SWEEP_TRAIL_ALPHA);
    this.sweepLine = rgba(c, 0.9);
  }

  /** Writes the scope-space position (px) of a world offset into `this.point`. */
  private toScope(dx: number, dz: number, up: number, pxPerMetre: number): Point2 {
    const p = rotateToView(dx, dz, up, this.point);
    p.x *= pxPerMetre;
    p.y *= pxPerMetre;
    return p;
  }

  private drawScope(radius: number): void {
    const ctx = this.ctx;
    const t = this.theme;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fillStyle = t.radarFill;
    ctx.fill();

    ctx.beginPath();
    for (const f of RING_FRACTIONS) {
      ctx.moveTo(radius * f, 0);
      ctx.arc(0, 0, radius * f, 0, TAU);
    }
    ctx.moveTo(-radius, 0);
    ctx.lineTo(radius, 0);
    ctx.moveTo(0, -radius);
    ctx.lineTo(0, radius);
    ctx.strokeStyle = t.grid;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = t.accent;
    ctx.shadowBlur = t.glow;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /** Tints ground outside the playable square and outlines its edge. */
  private drawBoundary(sim: Simulation, up: number, k: number, radius: number): void {
    const p = sim.player;
    const limit = sim.world.playableHalfSize;
    if (Math.abs(p.x) + this.range < limit && Math.abs(p.z) + this.range < limit) return;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.rect(-radius, -radius, radius * 2, radius * 2);
    this.traceBoundary(p, limit, up, k);
    ctx.fillStyle = this.theme.outOfBounds;
    ctx.fill('evenodd');

    ctx.beginPath();
    this.traceBoundary(p, limit, up, k);
    ctx.strokeStyle = this.theme.boundary;
    ctx.lineWidth = 1.2;
    ctx.setLineDash(BOUNDARY_DASH);
    ctx.stroke();
    ctx.setLineDash(NO_DASH);
  }

  private traceBoundary(p: Tank, limit: number, up: number, k: number): void {
    const ctx = this.ctx;
    let q = this.toScope(-limit - p.x, -limit - p.z, up, k);
    ctx.moveTo(q.x, q.y);
    q = this.toScope(limit - p.x, -limit - p.z, up, k);
    ctx.lineTo(q.x, q.y);
    q = this.toScope(limit - p.x, limit - p.z, up, k);
    ctx.lineTo(q.x, q.y);
    q = this.toScope(-limit - p.x, limit - p.z, up, k);
    ctx.lineTo(q.x, q.y);
    ctx.closePath();
  }

  /** Rocks as dots, structures as true-footprint outlines. */
  private drawObstacles(sim: Simulation, up: number, k: number): void {
    const ctx = this.ctx;
    const p = sim.player;
    const list = sim.world.obstaclesNear(p.x, p.z, this.range, this.nearby);

    ctx.beginPath();
    for (const ob of list) {
      if (ob.kind !== 'rock' || ob.shape.type !== 'circle' || !this.obstacleInRange(ob, p)) continue;
      const q = this.toScope(ob.x - p.x, ob.z - p.z, up, k);
      const r = Math.max(MIN_ROCK_PX, ob.shape.radius * k);
      ctx.moveTo(q.x + r, q.y);
      ctx.arc(q.x, q.y, r, 0, TAU);
    }
    ctx.fillStyle = this.theme.rock;
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    for (const ob of list) {
      if (ob.kind === 'rock' || !this.obstacleInRange(ob, p)) continue;
      const q = this.toScope(ob.x - p.x, ob.z - p.z, up, k);
      if (ob.shape.type === 'circle') {
        const r = Math.max(MIN_STRUCTURE_HALF_PX, ob.shape.radius * k);
        ctx.moveTo(q.x + r, q.y);
        ctx.arc(q.x, q.y, r, 0, TAU);
      } else {
        const hx = Math.max(MIN_STRUCTURE_HALF_PX, ob.shape.halfX * k);
        const hz = Math.max(MIN_STRUCTURE_HALF_PX, ob.shape.halfZ * k);
        traceRotatedRect(ctx, q.x, q.y, hx, hz, viewAngle(ob.yaw, up));
      }
    }
    ctx.fillStyle = this.theme.obstacleFill;
    ctx.fill();
    ctx.strokeStyle = this.theme.obstacle;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private obstacleInRange(ob: Obstacle, p: Tank): boolean {
    const dx = ob.x - p.x;
    const dz = ob.z - p.z;
    const reach = this.range + ob.boundRadius;
    return dx * dx + dz * dz <= reach * reach;
  }

  private drawSweep(radius: number): void {
    const ctx = this.ctx;
    const lineAngle = this.sweep - Math.PI / 2;
    const start = lineAngle - SWEEP_TRAIL;
    const gradient = ctx.createConicGradient(start, 0, 0);
    gradient.addColorStop(0, this.sweepClear);
    gradient.addColorStop(SWEEP_TRAIL / TAU, this.sweepTrail);
    gradient.addColorStop(1, this.sweepClear);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, start, lineAngle);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(lineAngle) * radius, Math.sin(lineAngle) * radius);
    ctx.strokeStyle = this.sweepLine;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = this.sweepLine;
    ctx.shadowBlur = this.theme.glow;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  /** Shells in flight; enemy (incoming) shells are larger and brighter. */
  private drawShells(sim: Simulation, up: number, k: number): void {
    const ctx = this.ctx;
    const p = sim.player;
    const rangeSq = this.range * this.range;
    for (const shell of sim.projectiles.items) {
      if (!shell.active) continue;
      const dx = shell.x - p.x;
      const dz = shell.z - p.z;
      if (dx * dx + dz * dz > rangeSq) continue;
      const q = this.toScope(dx, dz, up, k);
      const enemy = shell.faction === 'enemy';
      const s = enemy ? ENEMY_SHELL_PX : FRIENDLY_SHELL_PX;
      ctx.fillStyle = enemy ? this.theme.projectileEnemy : this.theme.projectileFriendly;
      ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
    }
  }

  private drawEnemies(sim: Simulation, up: number, k: number, radius: number): void {
    const ctx = this.ctx;
    const p = sim.player;
    const rangeSq = this.range * this.range;
    ctx.shadowBlur = this.theme.glow;
    for (const entry of sim.enemies) {
      const t = entry.tank;
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      const distSq = dx * dx + dz * dz;
      const q = this.toScope(dx, dz, up, k);
      if (!t.alive) {
        const fade = 1 - (sim.time - t.destroyedAt) / WRECK_FADE;
        if (distSq > rangeSq || fade <= 0) continue;
        ctx.globalAlpha = 0.85 * fade;
        ctx.shadowColor = this.theme.wreck;
        drawWreck(ctx, q.x, q.y, WRECK_SIZE, this.theme.wreck);
        continue;
      }
      const color = unitColor(this.theme, entry.kind);
      ctx.shadowColor = color;
      if (distSq > rangeSq) {
        clampToRadius(q, radius - CHEVRON_INSET);
        ctx.globalAlpha = 0.9;
        drawChevron(ctx, q.x, q.y, bearingOf(q.x, q.y), CHEVRON_SIZE, color);
        continue;
      }
      ctx.globalAlpha = 1 - (1 - MIN_SWEEP_BRIGHTNESS) * sweepLag(bearingOf(q.x, q.y), this.sweep);
      this.drawTravelLine(t, q, up, k, color);
      drawUnitSymbol(ctx, entry.kind, q.x, q.y, viewAngle(t.heading, up), ENEMY_SIZE, color);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  /** Short line from the contact in its direction of travel; omitted when stationary. */
  private drawTravelLine(t: Tank, at: Point2, up: number, k: number, color: string): void {
    const speed = Math.hypot(t.vx, t.vz);
    if (speed < MOVING_SPEED) return;
    const d = rotateToView(t.vx / speed, t.vz / speed, up, this.direction);
    const length = clamp(speed * TRAVEL_SECONDS * k, TRAVEL_MIN_PX, TRAVEL_MAX_PX);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(at.x + d.x * ENEMY_SIZE, at.y + d.y * ENEMY_SIZE);
    ctx.lineTo(at.x + d.x * (ENEMY_SIZE + length), at.y + d.y * (ENEMY_SIZE + length));
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  /** Bearing ticks every 30 degrees plus the north marker; both rotate in heading-up mode. */
  private drawCompass(radius: number, up: number): void {
    const ctx = this.ctx;
    const t = this.theme;
    ctx.beginPath();
    for (let i = 0; i < COMPASS_TICKS; i++) {
      const a = viewAngle((i * TAU) / COMPASS_TICKS, up);
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      const inner = radius - (i % 3 === 0 ? 6 : 3);
      ctx.moveTo(sin * inner, -cos * inner);
      ctx.lineTo(sin * radius, -cos * radius);
    }
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 1;
    ctx.stroke();

    const north = viewAngle(0, up);
    const x = Math.sin(north) * (radius - 13);
    const y = -Math.cos(north) * (radius - 13);
    ctx.font = LABEL_FONT_BOLD;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = LABEL_OUTLINE;
    ctx.strokeText('N', x, y);
    ctx.fillStyle = t.accent;
    ctx.fillText('N', x, y);
  }

  private drawPlayer(player: Tank, up: number): void {
    const ctx = this.ctx;
    const color = this.theme.player;
    const turret = viewAngle(player.heading + player.turretYaw, up);
    ctx.globalAlpha = player.alive ? 1 : 0.45;
    ctx.shadowColor = color;
    ctx.shadowBlur = this.theme.glow;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(turret) * TURRET_LINE_PX, -Math.cos(turret) * TURRET_LINE_PX);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    drawUnitSymbol(ctx, 'player', 0, 0, viewAngle(player.heading, up), PLAYER_SIZE, color);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  /** Range in the bottom-right corner, orientation in the top-left (outside the disc). */
  private drawLabels(): void {
    const ctx = this.ctx;
    ctx.font = LABEL_FONT;
    ctx.lineWidth = 3;
    ctx.strokeStyle = LABEL_OUTLINE;
    ctx.fillStyle = this.theme.text;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.strokeText(this.rangeLabel, this.size - 1, this.size - 1);
    ctx.fillText(this.rangeLabel, this.size - 1, this.size - 1);
    const mode = this.orientation === 'heading-up' ? 'HDG' : 'N-UP';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = this.theme.textDim;
    ctx.strokeText(mode, 1, 1);
    ctx.fillText(mode, 1, 1);
  }
}
