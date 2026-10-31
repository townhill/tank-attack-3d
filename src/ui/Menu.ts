/**
 * Main / pause menu, settings, controls reference and game-over summary.
 * Plain accessible HTML (real buttons and form controls, keyboard friendly).
 */
import type { Difficulty, MapSize } from '../config/settings';
import { DIFFICULTY, MAP_SIZES, WORLD } from '../config/settings';
import type { GraphicsModeId, UserSettings } from '../config/userSettings';
import { DIFFICULTIES, GRAPHICS_MODES, MAP_SIZE_IDS } from '../config/userSettings';
import { GRAPHICS_MODE_SPECS } from '../rendering/GraphicsModes';
import { HELP_HTML } from './HUD';
import { formatDistance } from './MapProjection';

export type MenuScreen = 'main' | 'settings' | 'controls' | 'gameover';
export type UiSoundKind = 'click' | 'hover' | 'toggle' | 'back' | 'start';

export interface MenuCallbacks {
  onStart(): void;
  onContinue(): void;
  onRestart(): void;
  onMainMenu(): void;
  onSettingsChange(next: UserSettings): void;
  onUiSound(kind: UiSoundKind): void;
}

export interface GameOverSummary {
  readonly score: number;
  readonly best: number;
  readonly newRecord: boolean;
  readonly wave: number;
  readonly kills: number;
  readonly killsByKind: Readonly<Record<'standard' | 'heavy' | 'scout', number>>;
  readonly survivalTime: string;
  readonly shotsFired: number;
  readonly hits: number;
  readonly accuracy: number;
  readonly difficulty: string;
  readonly mapSize: string;
  readonly seed: number;
}

type Control =
  | { readonly kind: 'select'; readonly key: keyof UserSettings; readonly label: string; readonly options: readonly (readonly [string, string])[] }
  | { readonly kind: 'toggle'; readonly key: keyof UserSettings; readonly label: string; readonly hint?: string }
  | { readonly kind: 'range'; readonly key: keyof UserSettings; readonly label: string; readonly min: number; readonly max: number; readonly step: number; readonly format: (v: number) => string };

const SECTIONS: readonly { readonly title: string; readonly controls: readonly Control[] }[] = [
  {
    title: 'Graphics',
    controls: [
      { kind: 'select', key: 'graphicsMode', label: 'Graphics mode', options: GRAPHICS_MODES.map((m) => [m, GRAPHICS_MODE_SPECS[m].label] as const) },
      { kind: 'select', key: 'quality', label: 'Quality', options: [['low', 'Low (no post-processing)'], ['medium', 'Medium'], ['high', 'High']] },
      { kind: 'toggle', key: 'autoQuality', label: 'Auto-reduce quality when slow' },
      { kind: 'range', key: 'bloomStrength', label: 'Bloom strength', min: 0, max: 2, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
      { kind: 'toggle', key: 'groundGrid', label: 'Neon ground grid' },
      { kind: 'toggle', key: 'scanlines', label: 'CRT scanlines (Classic)' },
      { kind: 'toggle', key: 'flicker', label: 'Vector flicker and phosphor glow (Classic)' },
      { kind: 'toggle', key: 'seeThroughWireframe', label: 'See-through wireframes (Classic nostalgia)' },
      { kind: 'range', key: 'fov', label: 'Field of view', min: 50, max: 100, step: 1, format: (v) => `${Math.round(v)}°` },
      { kind: 'toggle', key: 'cameraShake', label: 'Camera shake' },
      { kind: 'toggle', key: 'targetMarkers', label: 'Target brackets on visible enemies' },
      { kind: 'toggle', key: 'showPerf', label: 'Performance overlay' },
    ],
  },
  {
    title: 'Controls',
    controls: [
      { kind: 'range', key: 'mouseSensitivity', label: 'Mouse sensitivity', min: 0.1, max: 4, step: 0.05, format: (v) => v.toFixed(2) },
      { kind: 'toggle', key: 'invertY', label: 'Invert vertical aim' },
    ],
  },
  {
    title: 'Audio',
    controls: [
      { kind: 'range', key: 'masterVolume', label: 'Master volume', min: 0, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
      { kind: 'range', key: 'sfxVolume', label: 'Effects volume', min: 0, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
      { kind: 'toggle', key: 'muted', label: 'Mute all sound' },
      { kind: 'toggle', key: 'retroSound', label: 'Retro sound effects in Classic mode' },
    ],
  },
  {
    title: 'Battlefield',
    controls: [
      { kind: 'toggle', key: 'fords', label: 'Shallow river fords (new battlefields)' },
    ],
  },
  {
    title: 'Tactical',
    controls: [
      { kind: 'toggle', key: 'radarVisible', label: 'Show compact radar' },
      { kind: 'select', key: 'radarOrientation', label: 'Radar orientation', options: [['heading-up', 'Heading up'], ['north-up', 'North up']] },
      { kind: 'toggle', key: 'mapRealtime', label: 'Real-time tactical map (game keeps running)' },
      { kind: 'select', key: 'mapIntel', label: 'Map intel', options: [['full', 'Full: all enemies'], ['radar', 'Radar only (harder)']] },
    ],
  },
];

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

export class Menu {
  readonly root: HTMLElement;
  private readonly screens: Record<MenuScreen, HTMLElement>;
  private screen: MenuScreen = 'main';
  private settings: UserSettings;
  private canContinue = false;
  private best = 0;
  private readonly mainButtons: HTMLElement;
  private readonly bestLine: HTMLElement;
  private readonly settingsInputs = new Map<keyof UserSettings, HTMLInputElement | HTMLSelectElement>();
  private readonly settingsValues = new Map<keyof UserSettings, HTMLElement>();
  private readonly gameOverBody: HTMLElement;
  private readonly status: HTMLElement;

  constructor(parent: HTMLElement, settings: UserSettings, private readonly callbacks: MenuCallbacks) {
    this.settings = { ...settings };
    this.root = make('div', 'menu', parent);
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Game menu');

    const main = make('section', 'menu-screen', this.root);
    const title = make('h1', 'menu-title', main);
    title.innerHTML = 'VECTOR<span>TANKS</span>';
    make('p', 'menu-subtitle', main, 'Armoured combat in hidden-line vector space');
    this.mainButtons = make('div', 'menu-buttons', main);
    this.bestLine = make('p', 'menu-footer', main);

    const settingsScreen = make('section', 'menu-screen wide', this.root);
    make('h2', 'menu-heading', settingsScreen, 'SETTINGS');
    const grid = make('div', 'settings-grid', settingsScreen);
    for (const section of SECTIONS) this.buildSection(grid, section.title, section.controls);
    const settingsBack = make('button', 'menu-button', settingsScreen, 'Back');
    settingsBack.type = 'button';
    settingsBack.addEventListener('click', () => this.back());

    const controls = make('section', 'menu-screen wide', this.root);
    const controlsBody = make('div', 'controls-body', controls);
    controlsBody.innerHTML = HELP_HTML;
    const controlsBack = make('button', 'menu-button', controls, 'Back');
    controlsBack.type = 'button';
    controlsBack.addEventListener('click', () => this.back());

    const gameover = make('section', 'menu-screen', this.root);
    make('h2', 'menu-heading danger', gameover, 'TANK DESTROYED');
    this.gameOverBody = make('div', 'gameover-body', gameover);
    const goButtons = make('div', 'menu-buttons', gameover);
    this.button(goButtons, 'Restart (Enter)', () => { this.callbacks.onRestart(); }, 'start');
    this.button(goButtons, 'Main menu', () => { this.callbacks.onMainMenu(); }, 'back');

    this.status = make('p', 'menu-status', this.root);
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');

    this.screens = { main, settings: settingsScreen, controls, gameover };
    this.renderMain();
    this.showScreen('main');
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }

  get currentScreen(): MenuScreen {
    return this.screen;
  }

  private button(parent: HTMLElement, label: string, onClick: () => void, sound: UiSoundKind = 'click', detail?: string): HTMLButtonElement {
    const b = make('button', 'menu-button', parent);
    b.type = 'button';
    make('span', 'menu-button-label', b, label);
    if (detail) make('span', 'menu-button-detail', b, detail);
    b.addEventListener('click', () => {
      this.callbacks.onUiSound(sound);
      onClick();
    });
    b.addEventListener('mouseenter', () => { this.callbacks.onUiSound('hover'); });
    return b;
  }

  private renderMain(): void {
    this.mainButtons.replaceChildren();
    if (this.canContinue) this.button(this.mainButtons, 'Continue', () => { this.callbacks.onContinue(); }, 'start');
    this.button(this.mainButtons, this.canContinue ? 'New game' : 'Start game', () => { this.callbacks.onStart(); }, 'start');
    const mode = GRAPHICS_MODE_SPECS[this.settings.graphicsMode];
    this.button(this.mainButtons, `Graphics: ${mode.label}`, () => { this.cycleGraphics(); }, 'toggle', mode.description);
    const diff = DIFFICULTY[this.settings.difficulty];
    this.button(
      this.mainButtons,
      `Difficulty: ${diff.label}`,
      () => { this.cycleDifficulty(); },
      'toggle',
      this.canContinue ? 'Applies to the next new game' : difficultyBlurb(this.settings.difficulty),
    );
    this.button(
      this.mainButtons,
      `Map size: ${mapSizeLabel(this.settings.mapSize)}`,
      () => { this.cycleMapSize(); },
      'toggle',
      this.canContinue ? 'Applies to the next new game' : mapSizeBlurb(this.settings.mapSize),
    );
    this.button(this.mainButtons, 'Controls', () => { this.showScreen('controls'); });
    this.button(this.mainButtons, 'Settings', () => { this.showScreen('settings'); });
    this.bestLine.textContent = `BEST SCORE ${this.best.toLocaleString()}  ·  H FOR CONTROLS IN GAME`;
  }

  private cycleGraphics(): void {
    const i = GRAPHICS_MODES.indexOf(this.settings.graphicsMode);
    this.commit({ ...this.settings, graphicsMode: GRAPHICS_MODES[(i + 1) % GRAPHICS_MODES.length]! });
  }

  private cycleDifficulty(): void {
    const i = DIFFICULTIES.indexOf(this.settings.difficulty);
    this.commit({ ...this.settings, difficulty: DIFFICULTIES[(i + 1) % DIFFICULTIES.length]! });
  }

  private cycleMapSize(): void {
    const i = MAP_SIZE_IDS.indexOf(this.settings.mapSize);
    this.commit({ ...this.settings, mapSize: MAP_SIZE_IDS[(i + 1) % MAP_SIZE_IDS.length]! });
  }

  private commit(next: UserSettings): void {
    this.settings = next;
    this.callbacks.onSettingsChange(next);
    this.syncInputs();
    if (this.screen === 'main') {
      const focusedIndex = Array.from(this.mainButtons.children).indexOf(document.activeElement as Element);
      this.renderMain();
      if (focusedIndex >= 0) (this.mainButtons.children[focusedIndex] as HTMLElement | undefined)?.focus();
    }
  }

  private buildSection(parent: HTMLElement, title: string, controls: readonly Control[]): void {
    const fieldset = make('fieldset', 'settings-section', parent);
    make('legend', '', fieldset, title);
    for (const control of controls) {
      const row = make('label', `settings-row ${control.kind}`, fieldset);
      make('span', 'settings-label', row, control.label);
      if (control.kind === 'select') {
        const select = make('select', '', row);
        for (const [value, text] of control.options) {
          const option = make('option', '', select, text);
          option.value = value;
        }
        select.addEventListener('change', () => {
          this.callbacks.onUiSound('toggle');
          this.commit({ ...this.settings, [control.key]: select.value });
        });
        this.settingsInputs.set(control.key, select);
      } else if (control.kind === 'toggle') {
        const input = make('input', '', row);
        input.type = 'checkbox';
        input.addEventListener('change', () => {
          this.callbacks.onUiSound('toggle');
          this.commit({ ...this.settings, [control.key]: input.checked });
        });
        this.settingsInputs.set(control.key, input);
      } else {
        const input = make('input', '', row);
        input.type = 'range';
        input.min = String(control.min);
        input.max = String(control.max);
        input.step = String(control.step);
        const value = make('span', 'settings-value', row);
        input.addEventListener('input', () => {
          value.textContent = control.format(Number(input.value));
          this.commit({ ...this.settings, [control.key]: Number(input.value) });
        });
        this.settingsInputs.set(control.key, input);
        this.settingsValues.set(control.key, value);
      }
    }
    this.syncInputs();
  }

  private syncInputs(): void {
    for (const section of SECTIONS) {
      for (const control of section.controls) {
        const input = this.settingsInputs.get(control.key);
        if (!input) continue;
        const value = this.settings[control.key];
        if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = Boolean(value);
        else input.value = String(value);
        if (control.kind === 'range') {
          const label = this.settingsValues.get(control.key);
          if (label) label.textContent = control.format(Number(value));
        }
      }
    }
  }

  setSettings(settings: UserSettings): void {
    this.settings = { ...settings };
    this.syncInputs();
    if (this.screen === 'main') this.renderMain();
  }

  /** Shows a line of progress under the menu, such as a battlefield being generated; null clears it. */
  setStatus(text: string | null): void {
    this.status.textContent = text ?? '';
    this.status.classList.toggle('show', text !== null);
  }

  showMain(canContinue: boolean, best: number): void {
    this.canContinue = canContinue;
    this.best = best;
    this.renderMain();
    this.showScreen('main');
    this.root.classList.toggle('paused', canContinue);
  }

  showGameOver(summary: GameOverSummary): void {
    const s = summary;
    this.gameOverBody.innerHTML = '';
    const score = make('div', 'gameover-score', this.gameOverBody, s.score.toLocaleString());
    if (s.newRecord) make('span', 'gameover-record', score, 'NEW RECORD');
    const table = make('dl', 'gameover-stats', this.gameOverBody);
    const row = (k: string, v: string): void => {
      make('dt', '', table, k);
      make('dd', '', table, v);
    };
    row('Best score', s.best.toLocaleString());
    row('Wave reached', String(s.wave));
    row('Enemies destroyed', `${s.kills}  (${s.killsByKind.standard} standard · ${s.killsByKind.heavy} heavy · ${s.killsByKind.scout} scout)`);
    row('Survival time', s.survivalTime);
    row('Shots fired', String(s.shotsFired));
    row('Hits', String(s.hits));
    row('Accuracy', `${Math.round(s.accuracy * 100)}%`);
    row('Difficulty', s.difficulty);
    row('Battlefield size', s.mapSize);
    row('Battlefield seed', String(s.seed));
    this.showScreen('gameover');
  }

  showScreen(screen: MenuScreen): void {
    this.screen = screen;
    for (const [name, el] of Object.entries(this.screens)) el.classList.toggle('active', name === screen);
    this.root.classList.remove('hidden');
    const first = this.screens[screen].querySelector<HTMLElement>('button, select, input');
    first?.focus({ preventScroll: true });
  }

  /** Handles Escape inside the menu. Returns true when it navigated back. */
  back(): boolean {
    if (this.screen === 'settings' || this.screen === 'controls') {
      this.callbacks.onUiSound('back');
      this.showScreen('main');
      return true;
    }
    return false;
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}

function difficultyBlurb(d: Difficulty): string {
  switch (d) {
    case 'easy':
      return 'Slower, less accurate enemies; more repairs between waves';
    case 'normal':
      return 'Balanced: enemies partially lead moving targets';
    case 'hard':
      return 'Fast reactions, full target leading, larger waves';
  }
}

function mapSizeBlurb(size: MapSize): string {
  const side = formatDistance(2 * WORLD.playableHalfSize * MAP_SIZES[size].scale);
  return `${side} × ${side} battlefield`;
}

/** "Standard", "Large (2×)", "Huge (3×)". */
export function mapSizeLabel(size: MapSize): string {
  const spec = MAP_SIZES[size];
  return spec.scale === 1 ? spec.label : `${spec.label} (${spec.scale}×)`;
}

export function graphicsModeLabel(mode: GraphicsModeId): string {
  return GRAPHICS_MODE_SPECS[mode].label;
}
