import { describe, expect, it } from 'vitest';
import { AutoQuality, SLOW_FPS, SLOW_SECONDS } from '../src/game/AutoQuality';

const FRAME = 1 / 30;

/** Feeds `seconds` of frames at `fps` and returns the first step taken, if any. */
function run(auto: AutoQuality, seconds: number, fps: number, quality: 'low' | 'medium' | 'high', reflecting: boolean): ReturnType<AutoQuality['update']> {
  for (let t = 0; t < seconds; t += FRAME) {
    const step = auto.update(FRAME, fps, quality, reflecting);
    if (step) return step;
  }
  return null;
}

describe('AutoQuality', () => {
  it('does nothing while the frame rate holds up', () => {
    expect(run(new AutoQuality(), 30, SLOW_FPS + 5, 'high', true)).toBeNull();
  });

  it('turns lake reflections off before anything else once the frame rate stays low', () => {
    const auto = new AutoQuality();
    expect(run(auto, SLOW_SECONDS - 0.2, SLOW_FPS - 10, 'high', true)).toBeNull();
    expect(run(auto, 0.5, SLOW_FPS - 10, 'high', true)).toEqual({ kind: 'reflections' });
  });

  it('then lowers the quality one level at a time, and stops at low', () => {
    const auto = new AutoQuality();
    expect(run(auto, SLOW_SECONDS + 0.5, 20, 'high', false)).toEqual({ kind: 'quality', level: 'medium' });
    expect(run(auto, SLOW_SECONDS + 0.5, 20, 'medium', false)).toEqual({ kind: 'quality', level: 'low' });
    expect(run(auto, 30, 20, 'low', false)).toBeNull();
  });

  it('waits a full slow spell again after each step', () => {
    const auto = new AutoQuality();
    expect(run(auto, SLOW_SECONDS + 0.5, 20, 'high', true)).toEqual({ kind: 'reflections' });
    expect(run(auto, SLOW_SECONDS - 0.2, 20, 'high', false)).toBeNull();
  });

  it('forgets slow frames twice as fast as it gathers them when the frame rate recovers', () => {
    const auto = new AutoQuality();
    expect(run(auto, 3, 20, 'high', true)).toBeNull();
    expect(run(auto, 1.5, 60, 'high', true)).toBeNull();
    // 3 s slow, then 1.5 s fast forgets all of it: another 3.5 s slow is still not enough.
    expect(run(auto, SLOW_SECONDS - 0.5, 20, 'high', true)).toBeNull();
  });

  it('starts over after a reset', () => {
    const auto = new AutoQuality();
    expect(run(auto, SLOW_SECONDS - 0.5, 20, 'high', true)).toBeNull();
    auto.reset();
    expect(run(auto, SLOW_SECONDS - 0.5, 20, 'high', true)).toBeNull();
  });
});
