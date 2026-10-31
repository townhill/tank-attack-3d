/**
 * Automatic quality reduction: when the frame rate stays low, steps the
 * graphics down one notch at a time. Lake reflections go first, since they
 * render the scene a second time, then the quality preset drops a level.
 */
import type { QualityLevel } from '../config/userSettings';
import { QUALITY_LEVELS } from '../config/userSettings';

/** Frame rate below which a frame counts as slow. */
export const SLOW_FPS = 40;
/** Net seconds of slow frames before the next step down. */
export const SLOW_SECONDS = 4;

export type QualityStep = { readonly kind: 'reflections' } | { readonly kind: 'quality'; readonly level: QualityLevel };

export class AutoQuality {
  private slowTime = 0;

  reset(): void {
    this.slowTime = 0;
  }

  /**
   * Counts slow frames, forgetting them twice as fast while the frame rate
   * holds up, and returns the next step down once they add up to
   * SLOW_SECONDS: turning reflections off while `reflecting`, otherwise the
   * next lower quality level. Returns null while there is no step to take.
   */
  update(dt: number, fps: number, quality: QualityLevel, reflecting: boolean): QualityStep | null {
    if (fps < SLOW_FPS) this.slowTime += dt;
    else this.slowTime = Math.max(0, this.slowTime - dt * 2);
    if (this.slowTime < SLOW_SECONDS) return null;
    this.slowTime = 0;
    if (reflecting) return { kind: 'reflections' };
    const index = QUALITY_LEVELS.indexOf(quality);
    if (index <= 0) return null;
    return { kind: 'quality', level: QUALITY_LEVELS[index - 1]! };
  }
}
