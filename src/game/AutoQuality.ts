/**
 * Automatic quality reduction: when the frame rate stays low, steps the
 * graphics down one notch at a time. Lake reflections go first, since they
 * render the scene a second time, then the quality preset drops a level.
 * A lowered level lasts for the session only: the level the player chose is
 * never changed, so one slow spell does not degrade every later visit.
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
  /** The level stepped down to this session; null while the chosen level stands. */
  private lowered: QualityLevel | null = null;

  /** Forgets the slow frames counted so far; a lowered level stays. */
  reset(): void {
    this.slowTime = 0;
  }

  /** Goes back to the level the player chose. */
  restore(): void {
    this.lowered = null;
    this.slowTime = 0;
  }

  /** The level to render at when the player chose `chosen`: never above it. */
  effective(chosen: QualityLevel): QualityLevel {
    if (this.lowered === null) return chosen;
    return QUALITY_LEVELS.indexOf(this.lowered) < QUALITY_LEVELS.indexOf(chosen) ? this.lowered : chosen;
  }

  /**
   * Counts slow frames, forgetting them twice as fast while the frame rate
   * holds up, and returns the next step down once they add up to
   * SLOW_SECONDS: turning reflections off while `reflecting`, otherwise the
   * next level below the one in effect for the `chosen` level, which it then
   * remembers. Returns null while there is no step to take.
   */
  update(dt: number, fps: number, chosen: QualityLevel, reflecting: boolean): QualityStep | null {
    if (fps < SLOW_FPS) this.slowTime += dt;
    else this.slowTime = Math.max(0, this.slowTime - dt * 2);
    if (this.slowTime < SLOW_SECONDS) return null;
    this.slowTime = 0;
    if (reflecting) return { kind: 'reflections' };
    const index = QUALITY_LEVELS.indexOf(this.effective(chosen));
    if (index <= 0) return null;
    const level = QUALITY_LEVELS[index - 1]!;
    this.lowered = level;
    return { kind: 'quality', level };
  }
}
