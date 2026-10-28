/**
 * Heads-up display: DOM text/bars for stats plus a 2D overlay canvas for the
 * gun marker, target brackets, hit markers and incoming-fire indicators.
 * The game fills `frame` each frame and calls `render`.
 */
import { DEG } from '../utils/math';

export interface HudTarget {
  x: number;
  y: number;
  /** Half-size of the bracket in CSS pixels. */
  size: number;
  colour: string;
  label: string;
  /** True when the gun's current trajectory would hit this tank. */
  locked: boolean;
}

export interface HudFrame {
  score: number;
  best: number;
  wave: number;
  enemies: number;
  intermission: number | null;
  health: number;
  maxHealth: number;
  reload: number;
  speedKmh: number;
  hullHeading: number;
  turretHeading: number;
  range: number | null;
  cameraLabel: string;
  modeLabel: string;
  gunMarkerX: number;
  gunMarkerY: number;
  gunMarkerVisible: boolean;
  gunOnTarget: boolean;
  showCrosshair: boolean;
  message: string;
  messageDanger: boolean;
  targets: HudTarget[];
  targetCount: number;
  showPrompt: boolean;
}

interface Indicator {
  angle: number;
  life: number;
}

const INDICATOR_LIFE = 1.6;
const HIT_MARKER_LIFE = 0.35;
const FEED_LIFE = 4;
export const MAX_HUD_TARGETS = 32;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

function stat(parent: HTMLElement, label: string): HTMLElement {
  const box = el('div', 'hud-stat', parent);
  el('span', 'hud-label', box, label);
  return el('span', 'hud-value', box, '0');
}

function pad3(n: number): string {
  return String(((Math.round(n) % 360) + 360) % 360).padStart(3, '0');
}

export const HELP_HTML = `
<h2>CONTROLS</h2>
<table>
<tr><td>W / S &nbsp;·&nbsp; ↑ / ↓</td><td>Throttle ahead / reverse</td></tr>
<tr><td>A / D &nbsp;·&nbsp; ← / →</td><td>Turn hull left / right</td></tr>
<tr><td>Mouse</td><td>Aim turret and gun</td></tr>
<tr><td>Left mouse / Space</td><td>Fire cannon</td></tr>
<tr><td>Right mouse</td><td>Zoom sight</td></tr>
<tr><td>Mouse wheel</td><td>Chase distance / tactical altitude</td></tr>
<tr><td>V</td><td>Cycle camera: gunner · chase · tactical</td></tr>
<tr><td>M</td><td>Tactical map (wheel zoom, drag pan, Space recentre)</td></tr>
<tr><td>R</td><td>Toggle radar</td></tr>
<tr><td>C</td><td>Cycle graphics mode</td></tr>
<tr><td>F</td><td>Fullscreen</td></tr>
<tr><td>H</td><td>Show / hide this help</td></tr>
<tr><td>Esc</td><td>Pause and menu</td></tr>
</table>
<p>Gamepad: left stick drive · right stick aim · RT fire · LT zoom · Y camera · X radar · View map · Start pause</p>
`;

export class HUD {
  readonly root: HTMLElement;
  readonly frame: HudFrame;
  private readonly overlay: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly fields: Record<string, HTMLElement> = {};
  private readonly cache = new Map<HTMLElement, string>();
  private readonly healthFill: HTMLElement;
  private readonly reloadFill: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly bannerTitle: HTMLElement;
  private readonly bannerSub: HTMLElement;
  private readonly feed: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly help: HTMLElement;
  private readonly indicators: Indicator[] = [];
  private bannerTime = 0;
  private toastTime = 0;
  private hitMarker = 0;
  private hitMarkerKill = false;
  private damagePulse = 0;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private danger = '#ff3344';
  private accent = '#22e6ff';

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud hidden', parent);
    this.overlay = el('canvas', 'hud-overlay', this.root);
    this.overlay.setAttribute('aria-hidden', 'true');
    this.ctx = this.overlay.getContext('2d');

    const tl = el('div', 'hud-top-left', this.root);
    this.fields.score = stat(tl, 'SCORE');
    this.fields.wave = stat(tl, 'WAVE');
    this.fields.enemies = stat(tl, 'HOSTILES');
    this.fields.best = stat(tl, 'BEST');

    const tr = el('div', 'hud-top-right', this.root);
    this.fields.camera = el('div', 'hud-chip', tr);
    this.fields.mode = el('div', 'hud-chip dim', tr);

    this.fields.message = el('div', 'hud-message', this.root);
    this.fields.message.setAttribute('role', 'status');
    this.crosshair = el('div', 'hud-crosshair', this.root);
    this.crosshair.innerHTML =
      '<svg viewBox="-40 -40 80 80" width="80" height="80" aria-hidden="true">' +
      '<path d="M-26 0H-9M9 0H26M0 -26V-11M0 11V20" />' +
      '<path d="M-30 -14V-24H-20M30 -14V-24H20M-30 14V24H-20M30 14V24H20" class="corner" />' +
      '<circle r="1.6" class="dot" /></svg>';

    const bottom = el('div', 'hud-bottom', this.root);
    const healthBox = el('div', 'hud-bar-box', bottom);
    el('span', 'hud-label', healthBox, 'ARMOUR');
    const healthBar = el('div', 'hud-bar', healthBox);
    this.healthFill = el('div', 'hud-bar-fill', healthBar);
    this.fields.health = el('span', 'hud-value small', healthBox);
    const reloadBox = el('div', 'hud-bar-box', bottom);
    el('span', 'hud-label', reloadBox, 'CANNON');
    const reloadBar = el('div', 'hud-bar', reloadBox);
    this.reloadFill = el('div', 'hud-bar-fill reload', reloadBar);
    this.fields.reload = el('span', 'hud-value small', reloadBox);
    const readouts = el('div', 'hud-readouts', this.root);
    this.fields.speed = stat(readouts, 'SPEED');
    this.fields.hull = stat(readouts, 'HULL');
    this.fields.turret = stat(readouts, 'TURRET');
    this.fields.range = stat(readouts, 'RANGE');

    this.vignette = el('div', 'hud-vignette', this.root);
    this.banner = el('div', 'hud-banner', this.root);
    this.banner.setAttribute('role', 'status');
    this.bannerTitle = el('div', 'hud-banner-title', this.banner);
    this.bannerSub = el('div', 'hud-banner-sub', this.banner);
    this.feed = el('div', 'hud-feed', this.root);
    this.toastEl = el('div', 'hud-toast', this.root);
    this.toastEl.setAttribute('role', 'status');
    this.prompt = el('div', 'hud-prompt', this.root, 'CLICK TO ENGAGE  ·  ESC FOR MENU');
    this.help = el('div', 'hud-help hidden', this.root);
    this.help.innerHTML = HELP_HTML;

    this.frame = {
      score: 0, best: 0, wave: 0, enemies: 0, intermission: null, health: 100, maxHealth: 100, reload: 1,
      speedKmh: 0, hullHeading: 0, turretHeading: 0, range: null, cameraLabel: '', modeLabel: '',
      gunMarkerX: 0, gunMarkerY: 0, gunMarkerVisible: false, gunOnTarget: false, showCrosshair: true,
      message: '', messageDanger: false,
      targets: Array.from({ length: MAX_HUD_TARGETS }, () => ({ x: 0, y: 0, size: 10, colour: '#fff', label: '', locked: false })),
      targetCount: 0, showPrompt: false,
    };
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  setTheme(theme: 'classic' | 'neon'): void {
    this.root.classList.toggle('theme-classic', theme === 'classic');
    this.danger = theme === 'classic' ? '#c8ffd6' : '#ff3344';
    this.accent = theme === 'classic' ? '#39ff6a' : '#22e6ff';
  }

  toggleHelp(force?: boolean): boolean {
    const show = force ?? this.help.classList.contains('hidden');
    this.help.classList.toggle('hidden', !show);
    return show;
  }

  resize(width: number, height: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = width;
    this.height = height;
    this.overlay.width = Math.round(width * this.dpr);
    this.overlay.height = Math.round(height * this.dpr);
  }

  /** Incoming fire from a direction relative to the view (radians, 0 = ahead, clockwise). */
  addDamageIndicator(relativeAngle: number): void {
    this.indicators.push({ angle: relativeAngle, life: INDICATOR_LIFE });
    if (this.indicators.length > 8) this.indicators.shift();
    this.damagePulse = 1;
  }

  flashHitMarker(kill: boolean): void {
    this.hitMarker = HIT_MARKER_LIFE;
    this.hitMarkerKill = kill;
  }

  pushFeed(text: string, colour: string): void {
    const line = document.createElement('div');
    line.className = 'hud-feed-line';
    line.textContent = text;
    line.style.color = colour;
    this.feed.prepend(line);
    while (this.feed.childElementCount > 5) this.feed.lastElementChild?.remove();
    window.setTimeout(() => { line.classList.add('fade'); }, FEED_LIFE * 1000);
    window.setTimeout(() => { line.remove(); }, FEED_LIFE * 1000 + 800);
  }

  showBanner(title: string, subtitle: string, seconds = 2.6): void {
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = subtitle;
    this.banner.classList.add('show');
    this.bannerTime = seconds;
  }

  toast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTime = 2.4;
  }

  /** Clears transient indicators (new game). */
  reset(): void {
    this.indicators.length = 0;
    this.feed.replaceChildren();
    this.banner.classList.remove('show');
    this.bannerTime = 0;
    this.hitMarker = 0;
    this.damagePulse = 0;
  }

  private set(field: string, text: string): void {
    const e = this.fields[field];
    if (!e || this.cache.get(e) === text) return;
    this.cache.set(e, text);
    e.textContent = text;
  }

  render(dt: number): void {
    const f = this.frame;
    this.set('score', f.score.toLocaleString());
    this.set('wave', f.intermission !== null && f.wave > 0 ? `${f.wave}  ▸ ${Math.ceil(f.intermission)}s` : String(Math.max(1, f.wave)));
    this.set('enemies', String(f.enemies));
    this.set('best', f.best.toLocaleString());
    this.set('camera', f.cameraLabel);
    this.set('mode', f.modeLabel);
    this.set('health', `${Math.ceil(f.health)}`);
    this.set('reload', f.reload >= 1 ? 'READY' : 'LOADING');
    this.set('speed', `${Math.round(f.speedKmh)} km/h`);
    this.set('hull', `${pad3(f.hullHeading)}°`);
    this.set('turret', `${pad3(f.turretHeading)}°`);
    this.set('range', f.range === null ? '---' : `${Math.round(f.range)} m`);
    this.set('message', f.message);
    this.fields.message?.classList.toggle('danger', f.messageDanger);

    const healthFrac = Math.max(0, f.health / f.maxHealth);
    this.healthFill.style.transform = `scaleX(${healthFrac.toFixed(3)})`;
    this.healthFill.classList.toggle('danger', healthFrac < 0.3);
    this.reloadFill.style.transform = `scaleX(${Math.min(1, f.reload).toFixed(3)})`;
    this.reloadFill.classList.toggle('ready', f.reload >= 1);
    this.crosshair.classList.toggle('hidden', !f.showCrosshair);
    this.prompt.classList.toggle('show', f.showPrompt);

    this.damagePulse = Math.max(0, this.damagePulse - dt * 1.8);
    const lowHealth = healthFrac < 0.3 ? (0.3 - healthFrac) * 2.2 * (0.6 + 0.4 * Math.sin(performance.now() / 160)) : 0;
    this.vignette.style.opacity = Math.min(1, this.damagePulse * 0.8 + lowHealth).toFixed(3);

    if (this.bannerTime > 0) {
      this.bannerTime -= dt;
      if (this.bannerTime <= 0) this.banner.classList.remove('show');
    }
    if (this.toastTime > 0) {
      this.toastTime -= dt;
      if (this.toastTime <= 0) this.toastEl.classList.remove('show');
    }
    this.drawOverlay(dt);
  }

  private drawOverlay(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const f = this.frame;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.lineWidth = 1.5;
    ctx.font = '600 11px "Share Tech Mono", ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';

    for (let i = 0; i < f.targetCount; i++) {
      const t = f.targets[i]!;
      const s = t.size;
      const c = s * 0.45;
      ctx.strokeStyle = t.colour;
      ctx.fillStyle = t.colour;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        ctx.moveTo(t.x + sx * s, t.y + sy * (s - c));
        ctx.lineTo(t.x + sx * s, t.y + sy * s);
        ctx.lineTo(t.x + sx * (s - c), t.y + sy * s);
      }
      ctx.stroke();
      if (t.locked) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, Math.max(4, s * 0.3), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.75;
      ctx.fillText(t.label, t.x, t.y - s - 5);
    }
    ctx.globalAlpha = 1;

    const cx = this.width / 2;
    const cy = this.height / 2;
    if (f.gunMarkerVisible) {
      ctx.strokeStyle = f.gunOnTarget ? this.danger : this.accent;
      ctx.beginPath();
      ctx.arc(f.gunMarkerX, f.gunMarkerY, 7, 0, Math.PI * 2);
      ctx.moveTo(f.gunMarkerX - 12, f.gunMarkerY);
      ctx.lineTo(f.gunMarkerX - 5, f.gunMarkerY);
      ctx.moveTo(f.gunMarkerX + 5, f.gunMarkerY);
      ctx.lineTo(f.gunMarkerX + 12, f.gunMarkerY);
      ctx.stroke();
    }

    if (this.hitMarker > 0) {
      this.hitMarker -= dt;
      const a = Math.max(0, this.hitMarker / HIT_MARKER_LIFE);
      ctx.strokeStyle = this.hitMarkerKill ? this.danger : '#ffffff';
      ctx.globalAlpha = a;
      ctx.lineWidth = 2;
      const r0 = 10;
      const r1 = this.hitMarkerKill ? 22 : 17;
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        ctx.moveTo(cx + sx * r0, cy + sy * r0);
        ctx.lineTo(cx + sx * r1, cy + sy * r1);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Incoming-fire arcs around the crosshair, pointing towards the shooter.
    ctx.lineWidth = 4;
    for (let i = this.indicators.length - 1; i >= 0; i--) {
      const ind = this.indicators[i]!;
      ind.life -= dt;
      if (ind.life <= 0) {
        this.indicators.splice(i, 1);
        continue;
      }
      const a = ind.angle - Math.PI / 2;
      ctx.strokeStyle = this.danger;
      ctx.fillStyle = this.danger;
      ctx.globalAlpha = Math.min(1, ind.life / (INDICATOR_LIFE * 0.5));
      ctx.beginPath();
      ctx.arc(cx, cy, 110, a - 18 * DEG, a + 18 * DEG);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 126, cy + Math.sin(a) * 126);
      ctx.lineTo(cx + Math.cos(a - 5 * DEG) * 116, cy + Math.sin(a - 5 * DEG) * 116);
      ctx.lineTo(cx + Math.cos(a + 5 * DEG) * 116, cy + Math.sin(a + 5 * DEG) * 116);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
