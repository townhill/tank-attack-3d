import { describe, expect, it } from 'vitest';
import { SIM_DT } from '../src/config/settings';
import { FixedStepAccumulator } from '../src/game/GameLoop';
import { Random } from '../src/utils/random';

// Step sizes below are powers of two so the accumulator arithmetic is exact in floating point.
const STEP = 0.125;

describe('FixedStepAccumulator', () => {
  it('uses sensible defaults for the frame clamp and step cap', () => {
    const acc = new FixedStepAccumulator(SIM_DT);
    expect(acc.step).toBe(SIM_DT);
    expect(acc.maxFrameTime).toBe(0.25);
    expect(acc.maxStepsPerFrame).toBe(8);
  });

  it('runs one step when exactly one step of time has passed', () => {
    const acc = new FixedStepAccumulator(STEP);
    expect(acc.advance(STEP)).toBe(1);
    expect(acc.alpha).toBe(0);
  });

  it('runs no step for a frame shorter than a step and reports progress through alpha', () => {
    const acc = new FixedStepAccumulator(STEP);
    expect(acc.advance(STEP / 2)).toBe(0);
    expect(acc.alpha).toBe(0.5);
  });

  it('carries the remainder between frames', () => {
    const acc = new FixedStepAccumulator(STEP);
    expect(acc.advance(STEP / 2)).toBe(0);
    expect(acc.advance(STEP / 2)).toBe(1);
    expect(acc.alpha).toBe(0);
  });

  it('runs several steps for a long frame and keeps the fractional remainder', () => {
    const acc = new FixedStepAccumulator(STEP, 0.5);
    expect(acc.advance(2.5 * STEP)).toBe(2);
    expect(acc.alpha).toBe(0.5);
  });

  it('runs two 60 Hz steps per 30 fps frame and one step per two 120 fps frames', () => {
    const slow = new FixedStepAccumulator(SIM_DT);
    expect(slow.advance(1 / 30)).toBe(2);

    const fast = new FixedStepAccumulator(SIM_DT);
    expect(fast.advance(1 / 120)).toBe(0);
    expect(fast.advance(1 / 120)).toBe(1);
  });

  it('keeps alpha in [0, 1) for every ordinary frame', () => {
    const acc = new FixedStepAccumulator(SIM_DT);
    const rng = new Random(2024);
    let totalSteps = 0;
    let totalTime = 0;
    for (let i = 0; i < 2000; i++) {
      // Frames up to 0.13 s never reach the 8-step cap at 60 Hz.
      const frame = rng.range(0, 0.13);
      totalTime += frame;
      totalSteps += acc.advance(frame);
      expect(acc.alpha).toBeGreaterThanOrEqual(0);
      expect(acc.alpha).toBeLessThan(1);
    }
    // No simulation time is created or lost: whole steps plus the remainder equal elapsed time.
    expect(totalSteps * SIM_DT + acc.alpha * SIM_DT).toBeCloseTo(totalTime, 9);
  });

  it('conserves time across mixed frame lengths', () => {
    const acc = new FixedStepAccumulator(STEP, 0.5, 8);
    const frames = [0.0625, 0.1875, 0.25, 0.03125, 0.4375, 0.09375];
    let steps = 0;
    for (const frame of frames) steps += acc.advance(frame);
    const total = frames.reduce((sum, f) => sum + f, 0);
    expect(steps * STEP + acc.alpha * STEP).toBeCloseTo(total, 12);
  });

  it('clamps a huge frame time to maxFrameTime', () => {
    const acc = new FixedStepAccumulator(STEP, 0.5, 100);
    expect(acc.advance(100)).toBe(4);
    expect(acc.alpha).toBe(0);
  });

  it('clamps a stall to the default 0.25 s of catch-up', () => {
    const acc = new FixedStepAccumulator(SIM_DT, 0.25, 100);
    const steps = acc.advance(30);
    expect(steps).toBeLessThanOrEqual(Math.ceil(0.25 / SIM_DT));
    expect(steps).toBeGreaterThanOrEqual(Math.floor(0.25 / SIM_DT) - 1);
  });

  it('treats negative and zero frame times as no time passing', () => {
    const acc = new FixedStepAccumulator(STEP);
    expect(acc.advance(-5)).toBe(0);
    expect(acc.advance(0)).toBe(0);
    expect(acc.alpha).toBe(0);
  });

  it('never runs more than maxStepsPerFrame steps in one frame', () => {
    const acc = new FixedStepAccumulator(STEP, 10, 3);
    expect(acc.advance(1)).toBe(3);
  });

  it('does not spiral: after a capped frame the remaining backlog is dropped', () => {
    const acc = new FixedStepAccumulator(STEP, 10, 3);
    acc.advance(1);
    expect(acc.advance(0)).toBe(0);
  });

  it('keeps alpha within [0, 1] after a capped catch-up frame', () => {
    const acc = new FixedStepAccumulator(STEP, 10, 3);
    acc.advance(1);
    expect(acc.alpha).toBeGreaterThanOrEqual(0);
    expect(acc.alpha).toBeLessThanOrEqual(1);
  });

  it('keeps alpha strictly below 1 after a capped catch-up frame (documented range is [0, 1))', () => {
    const acc = new FixedStepAccumulator(STEP, 10, 3);
    acc.advance(1);
    expect(acc.alpha).toBeLessThan(1);
  });

  it('reset discards any accumulated time', () => {
    const acc = new FixedStepAccumulator(STEP);
    acc.advance(STEP / 2);
    expect(acc.alpha).toBe(0.5);
    acc.reset();
    expect(acc.alpha).toBe(0);
    expect(acc.advance(STEP / 2)).toBe(0);
  });
});
