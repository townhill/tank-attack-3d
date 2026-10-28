/**
 * Fixed-timestep accumulator. The simulation advances in constant steps while
 * rendering runs at the display rate and interpolates with `alpha`.
 */
export class FixedStepAccumulator {
  private accumulator = 0;

  constructor(
    readonly step: number,
    /** Longest frame time honoured; protects against huge catch-up after a stall. */
    readonly maxFrameTime = 0.25,
    readonly maxStepsPerFrame = 8,
  ) {}

  /** Adds frame time and returns how many simulation steps to run now. */
  advance(frameTime: number): number {
    this.accumulator += Math.min(Math.max(frameTime, 0), this.maxFrameTime);
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxStepsPerFrame) {
      this.accumulator -= this.step;
      steps++;
    }
    // After a stall, drop the backlog rather than spiralling; keep alpha below 1.
    if (steps === this.maxStepsPerFrame) this.accumulator = Math.min(this.accumulator, this.step * 0.999);
    return steps;
  }

  /** Fraction of a step elapsed since the last simulation step, in [0, 1). */
  get alpha(): number {
    return this.accumulator / this.step;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
