/**
 * Colour palettes and unit symbology shared by the radar and tactical map.
 * Unit kinds differ by shape as well as colour so they stay distinguishable
 * in the monochrome classic mode and for colour-blind players.
 */
import type { TankKind } from '../config/settings';
import type { Obstacle } from '../world/Obstacle';

export type GraphicsModeId = 'classic' | 'neon' | 'hybrid';
export type Rgb = readonly [number, number, number];

export interface TacticalTheme {
  readonly mode: GraphicsModeId;
  /** Map backdrop beyond the terrain. */
  readonly background: string;
  /** Translucent radar disc fill. */
  readonly radarFill: string;
  /** Translucent panel fill (legend, label backdrops). */
  readonly panel: string;
  /** Hairlines: panel borders, separators. */
  readonly line: string;
  readonly grid: string;
  readonly gridMajor: string;
  readonly text: string;
  readonly textDim: string;
  /** HUD accent: titles, rings, compass. */
  readonly accent: string;
  readonly danger: string;
  readonly player: string;
  readonly standard: string;
  readonly heavy: string;
  readonly scout: string;
  readonly wreck: string;
  /** Structure outlines. */
  readonly obstacle: string;
  readonly obstacleFill: string;
  readonly rock: string;
  readonly boundary: string;
  /** Tint for ground outside the playable square. */
  readonly outOfBounds: string;
  readonly projectileFriendly: string;
  readonly projectileEnemy: string;
  readonly sweep: Rgb;
  readonly terrainLow: Rgb;
  readonly terrainHigh: Rgb;
  readonly mountain: Rgb;
  readonly contour: Rgb;
  /** Canvas shadow blur (px) for the glow effect; 0 disables it. */
  readonly glow: number;
}

const FONT_STACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/** Canvas font for small labels. */
export const LABEL_FONT = `600 10px ${FONT_STACK}`;
/** Canvas font for emphasised labels (compass letters, grid labels). */
export const LABEL_FONT_BOLD = `700 11px ${FONT_STACK}`;

const NEON_UNITS = {
  player: '#22e6ff',
  standard: '#ff3344',
  heavy: '#ff8a1f',
  scout: '#ff2fd6',
  projectileFriendly: '#fff1a8',
  projectileEnemy: '#ffd23f',
  danger: '#ff3344',
} as const;

const THEMES: Readonly<Record<GraphicsModeId, TacticalTheme>> = {
  classic: {
    mode: 'classic',
    background: '#010a03',
    radarFill: 'rgba(0, 18, 6, 0.8)',
    panel: 'rgba(0, 14, 5, 0.85)',
    line: 'rgba(51, 255, 102, 0.35)',
    grid: 'rgba(51, 255, 102, 0.14)',
    gridMajor: 'rgba(51, 255, 102, 0.3)',
    text: '#8dffab',
    textDim: 'rgba(141, 255, 171, 0.62)',
    accent: '#33ff66',
    danger: '#e4ffea',
    player: '#d6ffe0',
    standard: '#33ff66',
    heavy: '#22c35a',
    scout: '#b0ff5c',
    wreck: '#2c9a4c',
    obstacle: '#5fdc84',
    obstacleFill: 'rgba(51, 255, 102, 0.12)',
    rock: '#3fae62',
    boundary: '#33ff66',
    outOfBounds: 'rgba(51, 255, 102, 0.08)',
    projectileFriendly: '#e8ffee',
    projectileEnemy: '#a6ffbe',
    sweep: [51, 255, 102],
    terrainLow: [2, 16, 6],
    terrainHigh: [14, 76, 32],
    mountain: [5, 32, 12],
    contour: [51, 255, 102],
    glow: 4,
  },
  neon: {
    mode: 'neon',
    background: '#03060d',
    radarFill: 'rgba(2, 10, 20, 0.8)',
    panel: 'rgba(3, 8, 18, 0.85)',
    line: 'rgba(34, 230, 255, 0.32)',
    grid: 'rgba(34, 230, 255, 0.13)',
    gridMajor: 'rgba(34, 230, 255, 0.28)',
    text: '#c4f7ff',
    textDim: 'rgba(196, 247, 255, 0.6)',
    accent: '#22e6ff',
    wreck: '#8a93a8',
    obstacle: '#a9b4ff',
    obstacleFill: 'rgba(169, 180, 255, 0.14)',
    rock: '#7a84c4',
    boundary: '#22e6ff',
    outOfBounds: 'rgba(169, 180, 255, 0.08)',
    sweep: [34, 230, 255],
    terrainLow: [3, 20, 26],
    terrainHigh: [18, 92, 96],
    mountain: [9, 20, 38],
    contour: [40, 220, 210],
    glow: 6,
    ...NEON_UNITS,
  },
  hybrid: {
    mode: 'hybrid',
    background: '#020805',
    radarFill: 'rgba(1, 14, 8, 0.8)',
    panel: 'rgba(2, 12, 8, 0.85)',
    line: 'rgba(34, 230, 255, 0.3)',
    grid: 'rgba(51, 255, 102, 0.12)',
    gridMajor: 'rgba(51, 255, 102, 0.26)',
    text: '#c4f7ff',
    textDim: 'rgba(196, 247, 255, 0.6)',
    accent: '#22e6ff',
    wreck: '#8a9a90',
    obstacle: '#b3b8ff',
    obstacleFill: 'rgba(179, 184, 255, 0.13)',
    rock: '#7d86bd',
    boundary: '#22e6ff',
    outOfBounds: 'rgba(179, 184, 255, 0.08)',
    sweep: [51, 255, 102],
    terrainLow: [3, 18, 9],
    terrainHigh: [22, 88, 44],
    mountain: [9, 24, 17],
    contour: [70, 230, 120],
    glow: 5,
    ...NEON_UNITS,
  },
};

export function tacticalTheme(mode: GraphicsModeId): TacticalTheme {
  return THEMES[mode];
}

export function unitColor(theme: TacticalTheme, kind: TankKind): string {
  switch (kind) {
    case 'player':
      return theme.player;
    case 'standard':
      return theme.standard;
    case 'heavy':
      return theme.heavy;
    case 'scout':
      return theme.scout;
  }
}

/** CSS rgba() string for an RGB triple. */
export function rgba(c: Rgb, alpha: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

export type SymbolStyle = 'solid' | 'ghost';

const GHOST_DASH: number[] = [3, 2];
const GHOST_FILL_ALPHA = 0.15;
const NO_DASH: number[] = [];
const FILL_ALPHA: Readonly<Record<TankKind, number>> = { player: 0.9, standard: 0.28, heavy: 0.55, scout: 0.2 };
const LINE_WIDTH: Readonly<Record<TankKind, number>> = { player: 1.4, standard: 1.5, heavy: 2, scout: 1.4 };

/**
 * Traces a unit outline centred on the origin with its nose pointing up (-y);
 * `size` is roughly the symbol radius in pixels. Player = arrowhead,
 * standard = triangle, heavy = pentagon, scout = slim diamond.
 */
export function traceUnitSymbol(ctx: CanvasRenderingContext2D, kind: TankKind, size: number): void {
  const s = size;
  ctx.beginPath();
  switch (kind) {
    case 'player':
      ctx.moveTo(0, -1.25 * s);
      ctx.lineTo(0.85 * s, 0.95 * s);
      ctx.lineTo(0, 0.45 * s);
      ctx.lineTo(-0.85 * s, 0.95 * s);
      break;
    case 'standard':
      ctx.moveTo(0, -1.15 * s);
      ctx.lineTo(0.92 * s, 0.8 * s);
      ctx.lineTo(-0.92 * s, 0.8 * s);
      break;
    case 'heavy':
      ctx.moveTo(0, -1.15 * s);
      ctx.lineTo(0.95 * s, -0.4 * s);
      ctx.lineTo(0.95 * s, 0.9 * s);
      ctx.lineTo(-0.95 * s, 0.9 * s);
      ctx.lineTo(-0.95 * s, -0.4 * s);
      break;
    case 'scout':
      ctx.moveTo(0, -1.2 * s);
      ctx.lineTo(0.55 * s, 0);
      ctx.lineTo(0, 0.95 * s);
      ctx.lineTo(-0.55 * s, 0);
      break;
  }
  ctx.closePath();
}

/** Draws a unit symbol at (x, y) rotated `rotation` radians clockwise from up. */
export function drawUnitSymbol(
  ctx: CanvasRenderingContext2D,
  kind: TankKind,
  x: number,
  y: number,
  rotation: number,
  size: number,
  color: string,
  style: SymbolStyle = 'solid',
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  traceUnitSymbol(ctx, kind, size);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  if (style === 'ghost') {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * GHOST_FILL_ALPHA;
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.setLineDash(GHOST_DASH);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else {
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * FILL_ALPHA[kind];
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.setLineDash(NO_DASH);
    ctx.lineWidth = LINE_WIDTH[kind];
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Appends a closed rectangle centred on (cx, cy) with half extents (hx, hz),
 * rotated `angle` radians clockwise, to the current path.
 */
export function traceRotatedRect(ctx: CanvasRenderingContext2D, cx: number, cy: number, hx: number, hz: number, angle: number): void {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const ax = hx * c;
  const ay = hx * s;
  const bx = -hz * s;
  const by = hz * c;
  ctx.moveTo(cx - ax - bx, cy - ay - by);
  ctx.lineTo(cx + ax - bx, cy + ay - by);
  ctx.lineTo(cx + ax + bx, cy + ay + by);
  ctx.lineTo(cx - ax + bx, cy - ay + by);
  ctx.closePath();
}

/** Draws a line from (x, y) along `angle` (clockwise from up) with an arrowhead at its tip. */
export function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, head: number): void {
  const fx = Math.sin(angle);
  const fy = -Math.cos(angle);
  const tx = x + fx * length;
  const ty = y + fy * length;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tx, ty);
  ctx.moveTo(tx - fx * head - fy * head * 0.7, ty - fy * head + fx * head * 0.7);
  ctx.lineTo(tx, ty);
  ctx.lineTo(tx - fx * head + fy * head * 0.7, ty - fy * head - fx * head * 0.7);
  ctx.stroke();
}

/** Draws a destroyed-tank cross. */
export function drawWreck(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Draws an open chevron at (x, y) pointing `angle` radians clockwise from up. */
export function drawChevron(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-size, size * 0.35);
  ctx.lineTo(0, -size * 0.65);
  ctx.lineTo(size, size * 0.35);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

/** Ghost (last-known) symbols start at this alpha and fade from there. */
export const GHOST_ALPHA_MAX = 0.7;
/** Velocity vectors on the map show where a unit will be after this many seconds. */
export const VELOCITY_VECTOR_SECONDS = 6;
/** Obstacle footprints never shrink below this half size (px) so they stay visible when zoomed out. */
const MIN_FOOTPRINT_PX = 1.5;
const BOUNDARY_DASH: number[] = [8, 5];

/**
 * Draws an obstacle's real footprint centred on (x, y) at `pxPerMetre`, in a
 * north-up view, with a kind-specific detail: pyramid ridges, bunker roof,
 * solid blocks and walls, tower core, pylon cross, translucent rocks.
 */
export function drawObstacleFootprint(
  ctx: CanvasRenderingContext2D,
  theme: TacticalTheme,
  ob: Obstacle,
  x: number,
  y: number,
  pxPerMetre: number,
): void {
  ctx.beginPath();
  if (ob.shape.type === 'circle') {
    const r = Math.max(MIN_FOOTPRINT_PX, ob.shape.radius * pxPerMetre);
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (ob.kind === 'rock') {
      paintFootprint(ctx, theme.rock, theme.rock, 0);
      return;
    }
    paintFootprint(ctx, theme.obstacleFill, theme.obstacle, ob.kind === 'tower' ? 0.5 : 0);
    ctx.beginPath();
    if (ob.kind === 'tower') {
      ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
    } else {
      ctx.moveTo(x - r * 1.6, y);
      ctx.lineTo(x + r * 1.6, y);
      ctx.moveTo(x, y - r * 1.6);
      ctx.lineTo(x, y + r * 1.6);
    }
    ctx.stroke();
    return;
  }
  const hx = Math.max(MIN_FOOTPRINT_PX, ob.shape.halfX * pxPerMetre);
  const hz = Math.max(MIN_FOOTPRINT_PX, ob.shape.halfZ * pxPerMetre);
  traceRotatedRect(ctx, x, y, hx, hz, ob.yaw);
  paintFootprint(ctx, theme.obstacleFill, theme.obstacle, ob.kind === 'block' || ob.kind === 'wall' ? 0.45 : 0);
  if (ob.kind === 'pyramid') {
    // Ridge lines from each corner to the apex.
    const c = Math.cos(ob.yaw);
    const s = Math.sin(ob.yaw);
    ctx.beginPath();
    ctx.moveTo(x - hx * c + hz * s, y - hx * s - hz * c);
    ctx.lineTo(x + hx * c - hz * s, y + hx * s + hz * c);
    ctx.moveTo(x + hx * c + hz * s, y + hx * s - hz * c);
    ctx.lineTo(x - hx * c - hz * s, y - hx * s + hz * c);
    ctx.stroke();
  } else if (ob.kind === 'bunker' && hx > 4) {
    ctx.beginPath();
    traceRotatedRect(ctx, x, y, hx * 0.55, hz * 0.45, ob.yaw);
    ctx.stroke();
  }
}

/** Fills and strokes the current path; `solid` > 0 adds an extra opaque fill in the stroke colour. */
function paintFootprint(ctx: CanvasRenderingContext2D, fill: string, stroke: string, solid: number): void {
  const alpha = ctx.globalAlpha;
  ctx.fillStyle = fill;
  if (fill === stroke) ctx.globalAlpha = alpha * 0.45;
  ctx.fill();
  if (solid > 0) {
    ctx.fillStyle = stroke;
    ctx.globalAlpha = alpha * solid;
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

export type LegendItem =
  | 'player'
  | 'standard'
  | 'heavy'
  | 'scout'
  | 'ghost'
  | 'vector'
  | 'wreck'
  | 'shell'
  | 'structure'
  | 'rock'
  | 'boundary';

export const LEGEND_LABELS: Readonly<Record<LegendItem, string>> = {
  player: 'YOU',
  standard: 'STANDARD',
  heavy: 'HEAVY',
  scout: 'SCOUT',
  ghost: 'LAST KNOWN',
  vector: `MOTION ${VELOCITY_VECTOR_SECONDS}s`,
  wreck: 'WRECK',
  shell: 'SHELL',
  structure: 'STRUCTURE',
  rock: 'ROCK',
  boundary: 'BOUNDARY',
};

/** Draws the legend sample for `item` centred on (x, y). */
export function drawLegendSymbol(ctx: CanvasRenderingContext2D, theme: TacticalTheme, item: LegendItem, x: number, y: number): void {
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.2;
  switch (item) {
    case 'player':
    case 'standard':
    case 'heavy':
    case 'scout':
      drawUnitSymbol(ctx, item, x, y, 0, item === 'player' ? 6 : 5.5, unitColor(theme, item));
      break;
    case 'ghost':
      ctx.globalAlpha = GHOST_ALPHA_MAX;
      drawUnitSymbol(ctx, 'standard', x, y, 0, 5.5, theme.standard, 'ghost');
      ctx.globalAlpha = 1;
      break;
    case 'vector':
      ctx.strokeStyle = theme.textDim;
      ctx.fillStyle = theme.textDim;
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.lineTo(x + 7, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 8, y, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'wreck':
      drawWreck(ctx, x, y, 4, theme.wreck);
      break;
    case 'shell':
      ctx.strokeStyle = theme.projectileEnemy;
      ctx.fillStyle = theme.projectileEnemy;
      ctx.beginPath();
      ctx.moveTo(x - 8, y + 3);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      break;
    case 'structure':
      ctx.beginPath();
      traceRotatedRect(ctx, x, y, 6, 4, 0.3);
      paintFootprint(ctx, theme.obstacleFill, theme.obstacle, 0);
      break;
    case 'rock':
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      paintFootprint(ctx, theme.rock, theme.rock, 0);
      break;
    case 'boundary':
      ctx.strokeStyle = theme.boundary;
      ctx.lineWidth = 2;
      ctx.setLineDash(BOUNDARY_DASH);
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.stroke();
      ctx.setLineDash(NO_DASH);
      break;
  }
}
