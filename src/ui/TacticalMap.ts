/**
 * Full-screen tactical map overlay: pre-rendered shaded-relief terrain with
 * contours, a lettered grid, obstacle footprints and live unit positions.
 * Wheel zooms at the cursor, drag pans, double-click recentres. Pointer and
 * wheel events are stopped at the overlay so they never reach the game.
 */
import type { EnemyKind } from '../config/settings';
import type { Tank } from '../entities/Tank';
import type { Simulation } from '../game/Simulation';
import { clamp, TAU } from '../utils/math';
import type { World } from '../world/World';
import { fitScale, formatDistance, gridColumnLetter, gridLabel, MapProjection, niceScaleLength } from './MapProjection';
import type { Contact } from './tacticalData';
import { ContactTracker, shadeRelief } from './tacticalData';
import type { GraphicsModeId, LegendItem, TacticalTheme } from './tacticalTheme';
import {
  drawArrow,
  drawLegendSymbol,
  drawObstacleFootprint,
  drawUnitSymbol,
  drawWreck,
  GHOST_ALPHA_MAX,
  LABEL_FONT,
  LABEL_FONT_BOLD,
  LEGEND_LABELS,
  tacticalTheme,
  unitColor,
  VELOCITY_VECTOR_SECONDS,
} from './tacticalTheme';
import './tactical.css';

export type MapIntel = 'full' | 'radar';

const GRID_DIVISIONS = 10;
/** Maximum zoom in px per metre. */
const MAX_SCALE = 2;
const FIT_PADDING = 28;
const MAX_DPR = 2;
/** Terrain relief texture resolution (px) over the full terrain square. */
const RELIEF_SIZE = 1024;
const WHEEL_ZOOM_RATE = 0.0015;
const WHEEL_LINE_PX = 16;
const ENEMY_SIZE = 6.5;
const PLAYER_SIZE = 8;
const MOVING_SPEED = 0.3;
/** Enemy turret lines are drawn from this zoom (px per metre) upwards. */
const TURRET_DETAIL_SCALE = 0.9;
const WRECK_SIZE = 4.5;
const WRECK_FADE = 10;
const WRECK_MIN_ALPHA = 0.25;
const SHELL_TRAIL_SECONDS = 0.05;
const AIM_LINE_METRES = 160;
const TURRET_LINE_PX = 15;
const PULSE_RATE = 4;
const CULL_MARGIN = 40;
/** Radar intel: last-known ghosts fade over this many seconds down to a floor alpha. */
const GHOST_FADE = 30;
const GHOST_MIN_ALPHA = 0.18;
const SCALE_BAR_MAX_PX = 160;
const LABEL_OUTLINE_WIDTH = 3;
const LEGEND_WIDTH = 150;
const LEGEND_ROW = 18;
const LEGEND_PAD = 8;
const HINT_TEXT = 'Wheel/+/- zoom · Drag/arrows pan · Space recentre · M close';
const BOUNDARY_DASH: number[] = [8, 5];
const RANGE_DASH: number[] = [3, 5];
const AIM_DASH: number[] = [6, 4];
const NO_DASH: number[] = [];
const ROW_LABELS: readonly string[] = Array.from({ length: GRID_DIVISIONS }, (_, i) => String(i + 1));

/** Events swallowed at the overlay so the game never sees them (e.g. firing on click). */
const STOPPED_EVENTS = [
  'pointerdown', 'pointermove', 'pointerup', 'pointercancel',
  'mousedown', 'mousemove', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu',
  'wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel',
] as const;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('TacticalMap: 2D canvas context unavailable');
  return ctx;
}

export class TacticalMap {
  private readonly root: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly legend: HTMLCanvasElement;
  private readonly legendCtx: CanvasRenderingContext2D;
  private readonly waveText: HTMLSpanElement;
  private readonly enemyText: HTMLSpanElement;
  private readonly playerText: HTMLSpanElement;
  private readonly cursorText: HTMLSpanElement;
  private readonly badge: HTMLSpanElement;
  private readonly observer: ResizeObserver;
  private readonly projection = new MapProjection(1, 1, 0, 0, 0.5);
  private readonly contacts = new ContactTracker();
  private world: World;
  private theme: TacticalTheme = tacticalTheme('neon');
  private intel: MapIntel = 'full';
  private radarRange = 400;
  private relief: HTMLCanvasElement | null = null;
  private reliefDirty = true;
  private opened = false;
  private zoomInitialised = false;
  private minScale = 0.1;
  private dpr = 1;
  private legendDpr = 0;
  private sim: Simulation | null = null;
  private dragPointer: number | null = null;
  private dragX = 0;
  private dragY = 0;
  private cursorX = -1;
  private cursorY = -1;
  private clock = 0;
  private scaleMetres = 0;
  private scaleText = '';
  // Header cache: DOM text is only written when a value changes.
  private shownWave = '';
  private shownEnemies = '';
  private shownPlayer = '';
  private shownCursor = '';

  constructor(parent: HTMLElement, world: World) {
    this.world = world;
    this.root = element('div', 'vt-tactical');
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Tactical map');
    this.root.setAttribute('aria-hidden', 'true');

    const header = element('header', 'vt-tactical__header');
    this.waveText = element('span', 'vt-tactical__stat');
    this.enemyText = element('span', 'vt-tactical__stat');
    this.playerText = element('span', 'vt-tactical__stat');
    this.cursorText = element('span', 'vt-tactical__stat vt-tactical__stat--dim');
    this.badge = element('span', 'vt-tactical__badge');
    header.append(
      element('span', 'vt-tactical__title', 'TACTICAL MAP'),
      this.waveText,
      this.enemyText,
      this.playerText,
      this.cursorText,
      element('span', 'vt-tactical__spacer'),
      this.badge,
    );

    const body = element('div', 'vt-tactical__body');
    this.canvas = element('canvas', 'vt-tactical__canvas');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Top-down battlefield map');
    this.legend = element('canvas', 'vt-tactical__legend');
    this.legend.setAttribute('role', 'img');
    body.append(this.canvas, this.legend);

    this.root.append(header, body, element('footer', 'vt-tactical__hint', HINT_TEXT));
    this.ctx = context2d(this.canvas);
    this.legendCtx = context2d(this.legend);
    parent.appendChild(this.root);

    this.bindEvents();
    this.observer = new ResizeObserver(() => {
      this.resize();
    });
    this.observer.observe(this.canvas);
    this.applyTheme();
    this.setRealtimeLabel(true);
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** Shows the overlay centred on the player; keeps the previous zoom. */
  open(sim: Simulation): void {
    this.sim = sim;
    if (sim.world !== this.world) this.setWorld(sim.world);
    this.opened = true;
    this.root.classList.add('vt-open');
    this.root.setAttribute('aria-hidden', 'false');
    this.resize();
    this.centerOnPlayer(sim);
    this.ensureRelief();
  }

  close(): void {
    this.opened = false;
    this.endDrag();
    this.cursorX = -1;
    this.root.classList.remove('vt-open');
    this.root.setAttribute('aria-hidden', 'true');
  }

  /** Switches to a new battlefield (new game with a new seed). */
  setWorld(world: World): void {
    if (world === this.world) return;
    this.world = world;
    this.reliefDirty = true;
    this.contacts.clear();
    if (this.projection.width > 1) this.updateZoomLimits();
  }

  setTheme(mode: GraphicsModeId): void {
    if (mode === this.theme.mode) return;
    this.theme = tacticalTheme(mode);
    this.reliefDirty = true;
    this.applyTheme();
  }

  setIntel(intel: MapIntel, radarRange: number): void {
    const legendChanged = intel !== this.intel;
    this.intel = intel;
    this.radarRange = Number.isFinite(radarRange) ? Math.max(0, radarRange) : 0;
    if (intel === 'full') this.contacts.clear();
    if (legendChanged) this.renderLegend();
  }

  /** Shows "LIVE" vs "PAUSED" in the header badge. */
  setRealtimeLabel(realtime: boolean): void {
    this.badge.textContent = realtime ? 'LIVE' : 'PAUSED';
    this.badge.classList.toggle('vt-tactical__badge--live', realtime);
    this.badge.classList.toggle('vt-tactical__badge--paused', !realtime);
  }

  /** Called every frame while open. */
  render(dt: number, sim: Simulation): void {
    if (!this.opened) return;
    this.sim = sim;
    if (sim.world !== this.world) this.setWorld(sim.world);
    if (this.projection.width <= 1) this.resize();
    const p = this.projection;
    if (p.width <= 1 || p.height <= 1) return;
    this.clock += Math.max(0, dt);
    this.ensureRelief();
    if (this.intel === 'radar') this.contacts.update(sim, this.radarRange);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.theme.background;
    ctx.fillRect(0, 0, p.width, p.height);
    this.drawRelief();
    this.drawGrid();
    this.drawObstacles();
    this.drawBoundary();
    this.drawProjectiles(sim);
    this.drawEnemies(sim);
    this.drawPlayer(sim);
    this.drawGridLabels();
    this.drawScaleBar();
    this.drawNorthArrow();
    this.updateHeader(sim);
  }

  /** Zooms about the view centre (for +/- keys). */
  zoomBy(factor: number): void {
    const p = this.projection;
    p.zoomAt(p.width / 2, p.height / 2, factor, this.minScale, MAX_SCALE);
    this.clampView();
  }

  /** Pans the view by world metres (for arrow keys; north is -dz). */
  panBy(dxMetres: number, dzMetres: number): void {
    if (!Number.isFinite(dxMetres) || !Number.isFinite(dzMetres)) return;
    this.projection.centerX += dxMetres;
    this.projection.centerZ += dzMetres;
    this.clampView();
  }

  centerOnPlayer(sim: Simulation): void {
    this.projection.centerX = sim.player.x;
    this.projection.centerZ = sim.player.z;
    this.clampView();
  }

  resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w <= 0 || h <= 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    this.dpr = dpr;
    this.projection.resize(w, h);
    this.updateZoomLimits();
    if (this.legendDpr !== dpr) this.renderLegend();
  }

  dispose(): void {
    this.observer.disconnect();
    this.root.remove();
    this.relief = null;
    this.sim = null;
    this.contacts.clear();
  }

  private bindEvents(): void {
    const stop = (e: Event): void => {
      e.stopPropagation();
    };
    for (const type of STOPPED_EVENTS) this.root.addEventListener(type, stop);
    this.root.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
    const c = this.canvas;
    c.addEventListener('wheel', this.onWheel, { passive: false });
    c.addEventListener('pointerdown', this.onPointerDown);
    c.addEventListener('pointermove', this.onPointerMove);
    c.addEventListener('pointerup', this.onPointerUp);
    c.addEventListener('pointercancel', this.onPointerUp);
    c.addEventListener('pointerleave', this.onPointerLeave);
    c.addEventListener('dblclick', this.onDoubleClick);
  }

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    let unit = 1;
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) unit = WHEEL_LINE_PX;
    else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) unit = this.projection.height;
    const factor = Math.exp(-e.deltaY * unit * WHEEL_ZOOM_RATE);
    this.projection.zoomAt(e.offsetX, e.offsetY, factor, this.minScale, MAX_SCALE);
    this.clampView();
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    this.dragPointer = e.pointerId;
    this.dragX = e.clientX;
    this.dragY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.classList.add('vt-dragging');
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.cursorX = e.offsetX;
    this.cursorY = e.offsetY;
    if (e.pointerId !== this.dragPointer) return;
    this.projection.panByPixels(e.clientX - this.dragX, e.clientY - this.dragY);
    this.dragX = e.clientX;
    this.dragY = e.clientY;
    this.clampView();
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId === this.dragPointer) this.endDrag();
  };

  private readonly onPointerLeave = (): void => {
    if (this.dragPointer === null) this.cursorX = -1;
  };

  private readonly onDoubleClick = (): void => {
    if (this.sim) this.centerOnPlayer(this.sim);
  };

  private endDrag(): void {
    const id = this.dragPointer;
    this.dragPointer = null;
    this.canvas.classList.remove('vt-dragging');
    if (id !== null && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
  }

  private clampView(): void {
    this.projection.clampCenter(this.world.terrain.halfSize);
  }

  /** Minimum zoom fits the whole terrain; the first open fits the playable square. */
  private updateZoomLimits(): void {
    const p = this.projection;
    this.minScale = Math.min(fitScale(p.width, p.height, this.world.terrain.halfSize, FIT_PADDING), MAX_SCALE);
    if (!this.zoomInitialised) {
      p.scale = fitScale(p.width, p.height, this.world.playableHalfSize, FIT_PADDING);
      this.zoomInitialised = true;
    }
    p.scale = clamp(p.scale, this.minScale, MAX_SCALE);
    this.clampView();
  }

  private ensureRelief(): void {
    if (!this.reliefDirty && this.relief) return;
    const canvas = this.relief ?? document.createElement('canvas');
    canvas.width = RELIEF_SIZE;
    canvas.height = RELIEF_SIZE;
    const pixels = shadeRelief(this.world, this.theme, RELIEF_SIZE);
    context2d(canvas).putImageData(new ImageData(pixels, RELIEF_SIZE, RELIEF_SIZE), 0, 0);
    this.relief = canvas;
    this.reliefDirty = false;
  }

  private drawRelief(): void {
    if (!this.relief) return;
    const p = this.projection;
    const half = this.world.terrain.halfSize;
    const size = 2 * half * p.scale;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.relief, p.worldToMapX(-half), p.worldToMapY(-half), size, size);
  }

  private drawGrid(): void {
    const ctx = this.ctx;
    const p = this.projection;
    const limit = this.world.playableHalfSize;
    const cell = (2 * limit) / GRID_DIVISIONS;
    const top = p.worldToMapY(-limit);
    const bottom = p.worldToMapY(limit);
    const left = p.worldToMapX(-limit);
    const right = p.worldToMapX(limit);
    const middle = GRID_DIVISIONS / 2;
    for (const major of [false, true]) {
      ctx.beginPath();
      for (let i = 1; i < GRID_DIVISIONS; i++) {
        if ((i === middle) !== major) continue;
        const x = Math.round(p.worldToMapX(-limit + i * cell)) + 0.5;
        const y = Math.round(p.worldToMapY(-limit + i * cell)) + 0.5;
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
      }
      ctx.strokeStyle = major ? this.theme.gridMajor : this.theme.grid;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /** Tints everything outside the playable square and outlines it. */
  private drawBoundary(): void {
    const ctx = this.ctx;
    const p = this.projection;
    const limit = this.world.playableHalfSize;
    const x = p.worldToMapX(-limit);
    const y = p.worldToMapY(-limit);
    const size = 2 * limit * p.scale;
    ctx.beginPath();
    ctx.rect(0, 0, p.width, p.height);
    ctx.rect(x, y, size, size);
    ctx.fillStyle = this.theme.outOfBounds;
    ctx.fill('evenodd');
    ctx.strokeStyle = this.theme.boundary;
    ctx.lineWidth = 2;
    ctx.setLineDash(BOUNDARY_DASH);
    ctx.shadowColor = this.theme.boundary;
    ctx.shadowBlur = this.theme.glow;
    ctx.strokeRect(x, y, size, size);
    ctx.shadowBlur = 0;
    ctx.setLineDash(NO_DASH);
  }

  private drawObstacles(): void {
    const p = this.projection;
    const minX = p.mapToWorldX(-CULL_MARGIN);
    const maxX = p.mapToWorldX(p.width + CULL_MARGIN);
    const minZ = p.mapToWorldZ(-CULL_MARGIN);
    const maxZ = p.mapToWorldZ(p.height + CULL_MARGIN);
    for (const ob of this.world.obstacles) {
      const r = ob.boundRadius;
      if (ob.x + r < minX || ob.x - r > maxX || ob.z + r < minZ || ob.z - r > maxZ) continue;
      drawObstacleFootprint(this.ctx, this.theme, ob, p.worldToMapX(ob.x), p.worldToMapY(ob.z), p.scale);
    }
  }

  private isOffscreen(x: number, y: number): boolean {
    const p = this.projection;
    return x < -CULL_MARGIN || y < -CULL_MARGIN || x > p.width + CULL_MARGIN || y > p.height + CULL_MARGIN;
  }

  private drawProjectiles(sim: Simulation): void {
    const ctx = this.ctx;
    const p = this.projection;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = this.theme.glow;
    for (const shell of sim.projectiles.items) {
      if (!shell.active) continue;
      const x = p.worldToMapX(shell.x);
      const y = p.worldToMapY(shell.z);
      if (this.isOffscreen(x, y)) continue;
      const color = shell.faction === 'enemy' ? this.theme.projectileEnemy : this.theme.projectileFriendly;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.moveTo(p.worldToMapX(shell.x - shell.vx * SHELL_TRAIL_SECONDS), p.worldToMapY(shell.z - shell.vz * SHELL_TRAIL_SECONDS));
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    ctx.shadowBlur = 0;
  }

  private drawEnemies(sim: Simulation): void {
    const ctx = this.ctx;
    const p = this.projection;
    for (const entry of sim.enemies) {
      const t = entry.tank;
      if (!t.alive) {
        ctx.globalAlpha = clamp(1 - (sim.time - t.destroyedAt) / WRECK_FADE, WRECK_MIN_ALPHA, 1);
        drawWreck(ctx, p.worldToMapX(t.x), p.worldToMapY(t.z), WRECK_SIZE, this.theme.wreck);
        ctx.globalAlpha = 1;
        continue;
      }
      if (this.intel === 'full') {
        this.drawLiveEnemy(t, entry.kind);
        continue;
      }
      const c = this.contacts.get(t.id);
      if (!c) continue;
      if (c.live) this.drawLiveEnemy(t, entry.kind);
      else if (Number.isFinite(c.seenAt)) this.drawGhost(c, sim.time);
    }
  }

  /** Kind symbol oriented by hull heading, heading arrow, velocity vector and (zoomed in) turret line. */
  private drawLiveEnemy(t: Tank, kind: EnemyKind): void {
    const ctx = this.ctx;
    const p = this.projection;
    const x = p.worldToMapX(t.x);
    const y = p.worldToMapY(t.z);
    if (this.isOffscreen(x, y)) return;
    const color = unitColor(this.theme, kind);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    if (Math.hypot(t.vx, t.vz) > MOVING_SPEED) {
      const ex = p.worldToMapX(t.x + t.vx * VELOCITY_VECTOR_SECONDS);
      const ey = p.worldToMapY(t.z + t.vz * VELOCITY_VECTOR_SECONDS);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, ey, 2, 0, TAU);
      ctx.fill();
    }
    if (p.scale >= TURRET_DETAIL_SCALE) {
      const a = t.heading + t.turretYaw;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sin(a) * ENEMY_SIZE * 2, y - Math.cos(a) * ENEMY_SIZE * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    const nose = ENEMY_SIZE * 1.25;
    drawArrow(ctx, x + Math.sin(t.heading) * nose, y - Math.cos(t.heading) * nose, t.heading, 6, 3);
    ctx.shadowColor = color;
    ctx.shadowBlur = this.theme.glow;
    drawUnitSymbol(ctx, kind, x, y, t.heading, ENEMY_SIZE, color);
    ctx.shadowBlur = 0;
  }

  private drawGhost(c: Contact, time: number): void {
    const ctx = this.ctx;
    const x = this.projection.worldToMapX(c.x);
    const y = this.projection.worldToMapY(c.z);
    if (this.isOffscreen(x, y)) return;
    const age = clamp((time - c.seenAt) / GHOST_FADE, 0, 1);
    const color = unitColor(this.theme, c.kind);
    ctx.globalAlpha = GHOST_ALPHA_MAX - (GHOST_ALPHA_MAX - GHOST_MIN_ALPHA) * age;
    drawUnitSymbol(ctx, c.kind, x, y, c.heading, ENEMY_SIZE, color, 'ghost');
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText('?', x + ENEMY_SIZE + 3, y - ENEMY_SIZE);
    ctx.globalAlpha = 1;
  }

  /** Cyan hull arrow, turret line with a faint aim extension and a pulsing locator ring. */
  private drawPlayer(sim: Simulation): void {
    const ctx = this.ctx;
    const p = this.projection;
    const pl = sim.player;
    const x = p.worldToMapX(pl.x);
    const y = p.worldToMapY(pl.z);
    const color = this.theme.player;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    if (this.intel === 'radar' && this.radarRange > 0) {
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1;
      ctx.setLineDash(RANGE_DASH);
      ctx.beginPath();
      ctx.arc(x, y, this.radarRange * p.scale, 0, TAU);
      ctx.stroke();
      ctx.setLineDash(NO_DASH);
    }
    if (!pl.alive) {
      ctx.globalAlpha = 1;
      drawWreck(ctx, x, y, PLAYER_SIZE, color);
      return;
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * PULSE_RATE);
    ctx.globalAlpha = 0.2 + 0.35 * pulse;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, PLAYER_SIZE + 7 + 3 * pulse, 0, TAU);
    ctx.stroke();

    const aim = pl.heading + pl.turretYaw;
    const fx = Math.sin(aim);
    const fy = -Math.cos(aim);
    const aimPx = AIM_LINE_METRES * p.scale;
    if (aimPx > TURRET_LINE_PX) {
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.setLineDash(AIM_DASH);
      ctx.beginPath();
      ctx.moveTo(x + fx * TURRET_LINE_PX, y + fy * TURRET_LINE_PX);
      ctx.lineTo(x + fx * aimPx, y + fy * aimPx);
      ctx.stroke();
      ctx.setLineDash(NO_DASH);
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = this.theme.glow;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + fx * TURRET_LINE_PX, y + fy * TURRET_LINE_PX);
    ctx.stroke();
    drawUnitSymbol(ctx, 'player', x, y, pl.heading, PLAYER_SIZE, color);
    ctx.shadowBlur = 0;
  }

  /** Column letters above and row numbers left of the grid, sticking to the view edge when scrolled. */
  private drawGridLabels(): void {
    const p = this.projection;
    const limit = this.world.playableHalfSize;
    const cell = (2 * limit) / GRID_DIVISIONS;
    this.ctx.font = LABEL_FONT_BOLD;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const labelY = clamp(p.worldToMapY(-limit) - 11, 11, p.height - 11);
    for (let i = 0; i < GRID_DIVISIONS; i++) {
      const x = p.worldToMapX(-limit + (i + 0.5) * cell);
      if (x < 26 || x > p.width - 10) continue;
      this.outlinedText(gridColumnLetter(i), x, labelY, this.theme.accent);
    }
    const labelX = clamp(p.worldToMapX(-limit) - 13, 13, p.width - 13);
    for (let j = 0; j < GRID_DIVISIONS; j++) {
      const y = p.worldToMapY(-limit + (j + 0.5) * cell);
      if (y < 24 || y > p.height - 10) continue;
      this.outlinedText(ROW_LABELS[j] ?? '', labelX, y, this.theme.accent);
    }
  }

  private outlinedText(text: string, x: number, y: number, color: string): void {
    const ctx = this.ctx;
    ctx.lineWidth = LABEL_OUTLINE_WIDTH;
    ctx.strokeStyle = this.theme.background;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  private drawScaleBar(): void {
    const ctx = this.ctx;
    const p = this.projection;
    const metres = niceScaleLength(p.scale, Math.min(SCALE_BAR_MAX_PX, p.width * 0.35));
    if (metres <= 0) return;
    if (metres !== this.scaleMetres) {
      this.scaleMetres = metres;
      this.scaleText = formatDistance(metres);
    }
    const length = metres * p.scale;
    const x = 16;
    const y = p.height - 16;
    ctx.fillStyle = this.theme.panel;
    ctx.fillRect(x - 8, y - 26, length + 16, 34);
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y);
    ctx.lineTo(x + length, y);
    ctx.lineTo(x + length, y - 6);
    ctx.moveTo(x + length / 2, y);
    ctx.lineTo(x + length / 2, y - 3);
    ctx.strokeStyle = this.theme.text;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = LABEL_FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = this.theme.text;
    ctx.fillText(this.scaleText, x, y - 8);
  }

  private drawNorthArrow(): void {
    const ctx = this.ctx;
    const x = this.projection.width - 26;
    const y = 52;
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x + 6, y + 4);
    ctx.lineTo(x, y);
    ctx.lineTo(x - 6, y + 4);
    ctx.closePath();
    ctx.fillStyle = this.theme.accent;
    ctx.fill();
    ctx.font = LABEL_FONT_BOLD;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    this.outlinedText('N', x, y + 7, this.theme.accent);
  }

  private updateHeader(sim: Simulation): void {
    const w = sim.waves;
    const wave = w.phase === 'intermission' ? `WAVE ${w.wave + 1} IN ${Math.max(0, Math.ceil(w.timer))}s` : `WAVE ${w.wave}`;
    if (wave !== this.shownWave) {
      this.shownWave = wave;
      this.waveText.textContent = wave;
    }
    const alive = sim.aliveEnemyCount();
    const queued = w.remainingToSpawn;
    const enemies = queued > 0 ? `ENEMIES ${alive} +${queued}` : `ENEMIES ${alive}`;
    if (enemies !== this.shownEnemies) {
      this.shownEnemies = enemies;
      this.enemyText.textContent = enemies;
      this.enemyText.classList.toggle('vt-tactical__stat--danger', alive > 0);
    }
    const limit = this.world.playableHalfSize;
    const player = `PLAYER ${gridLabel(sim.player.x, sim.player.z, limit, GRID_DIVISIONS)}`;
    if (player !== this.shownPlayer) {
      this.shownPlayer = player;
      this.playerText.textContent = player;
    }
    const cursor = this.cursorLabel(sim, limit);
    if (cursor !== this.shownCursor) {
      this.shownCursor = cursor;
      this.cursorText.textContent = cursor;
    }
  }

  /** "CURSOR D4 320 m" (grid reference and range from the player); empty when the pointer is off the map. */
  private cursorLabel(sim: Simulation, limit: number): string {
    if (this.cursorX < 0) return '';
    const p = this.projection;
    const x = p.mapToWorldX(this.cursorX);
    const z = p.mapToWorldZ(this.cursorY);
    if (!this.world.isInsidePlayable(x, z)) return 'CURSOR OUT OF BOUNDS';
    const range = Math.round(Math.hypot(x - sim.player.x, z - sim.player.z) / 10) * 10;
    return `CURSOR ${gridLabel(x, z, limit, GRID_DIVISIONS)} ${formatDistance(range)}`;
  }

  private applyTheme(): void {
    const t = this.theme;
    const s = this.root.style;
    s.setProperty('--vt-accent', t.accent);
    s.setProperty('--vt-text', t.text);
    s.setProperty('--vt-dim', t.textDim);
    s.setProperty('--vt-danger', t.danger);
    s.setProperty('--vt-bg', t.background);
    s.setProperty('--vt-panel', t.panel);
    s.setProperty('--vt-line', t.line);
    this.renderLegend();
  }

  /** Static legend canvas, redrawn only on theme, intel or pixel-ratio changes. */
  private renderLegend(): void {
    const items: LegendItem[] = ['player', 'standard', 'heavy', 'scout'];
    if (this.intel === 'radar') items.push('ghost');
    items.push('vector', 'wreck', 'shell', 'structure', 'building', 'rock', 'boundary');
    const dpr = this.dpr;
    const height = LEGEND_PAD * 2 + items.length * LEGEND_ROW;
    this.legend.style.height = `${height}px`;
    this.legend.width = Math.round(LEGEND_WIDTH * dpr);
    this.legend.height = Math.round(height * dpr);
    this.legendDpr = dpr;
    this.legend.setAttribute('aria-label', `Legend: ${items.map((i) => LEGEND_LABELS[i].toLowerCase()).join(', ')}`);

    const ctx = this.legendCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, LEGEND_WIDTH, height);
    let y = LEGEND_PAD + LEGEND_ROW / 2;
    for (const item of items) {
      drawLegendSymbol(ctx, this.theme, item, 20, y);
      ctx.font = LABEL_FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.theme.text;
      ctx.fillText(LEGEND_LABELS[item], 40, y);
      y += LEGEND_ROW;
    }
  }
}
