/** Small optional overlay with FPS and renderer statistics. */

export interface PerfStats {
  readonly calls: number;
  readonly triangles: number;
  readonly lines: number;
  readonly geometries: number;
  readonly textures: number;
}

const SAMPLE_WINDOW = 0.5;

export class PerfOverlay {
  private readonly root: HTMLElement;
  private frames = 0;
  private elapsed = 0;
  private worstFrame = 0;
  /** Smoothed frames per second over the last sample window. */
  fps = 60;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('pre');
    this.root.className = 'perf-overlay hidden';
    this.root.setAttribute('aria-live', 'off');
    parent.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }

  /** Call every frame; refreshes the text twice a second when visible. */
  update(dt: number, stats: PerfStats, extra: Readonly<Record<string, string | number>>): void {
    this.frames++;
    this.elapsed += dt;
    this.worstFrame = Math.max(this.worstFrame, dt);
    if (this.elapsed < SAMPLE_WINDOW) return;
    this.fps = this.frames / this.elapsed;
    if (this.visible) {
      const lines = [
        `FPS ${this.fps.toFixed(0).padStart(4)}   worst ${(this.worstFrame * 1000).toFixed(1)} ms`,
        `draw ${stats.calls}  tris ${stats.triangles}  lines ${stats.lines}`,
        `geo ${stats.geometries}  tex ${stats.textures}`,
        ...Object.entries(extra).map(([k, v]) => `${k} ${v}`),
      ];
      this.root.textContent = lines.join('\n');
    }
    this.frames = 0;
    this.elapsed = 0;
    this.worstFrame = 0;
  }
}
