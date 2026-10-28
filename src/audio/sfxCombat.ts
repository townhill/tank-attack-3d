/**
 * Combat one-shot recipes. Each builds into a Voice starting at time `t`;
 * `retro` swaps in square-wave, stepped and bit-crushed arcade variants.
 * `level` scales the recipe's peak gains.
 */
import { steppedGlide, type FireTimbre } from './audioMath';
import { glide, pluck, stepped, type Voice } from './synth';

/** Inharmonic partials of a struck steel slab: [Hz, gain, decay s]. */
const CLANG_PARTIALS: readonly (readonly [number, number, number])[] = [
  [420, 0.5, 0.7],
  [1131, 0.32, 0.5],
  [1873, 0.2, 0.35],
  [2790, 0.12, 0.25],
];

function detune(): number {
  return 0.94 + Math.random() * 0.12;
}

/** Low sine thump gliding down (body of hits and shots). */
function thump(v: Voice, t: number, fromHz: number, toHz: number, decay: number, peak: number): void {
  const env = v.gain(0);
  const osc = v.osc('sine', fromHz, t, t + decay + 0.05, env);
  glide(osc.frequency, t, fromHz, toHz, decay);
  pluck(env.gain, t, 0.004, peak, decay);
}

/** Filtered noise burst. */
function burst(
  v: Voice,
  t: number,
  buffer: AudioBuffer,
  type: BiquadFilterType,
  hz: number,
  q: number,
  decay: number,
  peak: number,
  rate = 1,
): BiquadFilterNode {
  const env = v.gain(0);
  const filter = v.filter(type, hz, q, env);
  v.noise(buffer, t, t + decay + 0.05, filter, rate);
  pluck(env.gain, t, 0.002, peak, decay);
  return filter;
}

/** Bit-crushed noise through a stepped low-pass sweep (retro grit). */
function crushedBurst(v: Voice, t: number, fromHz: number, toHz: number, decay: number, peak: number): void {
  const env = v.gain(0);
  const crush = v.shaper(v.bank.crush, env);
  const lp = v.filter('lowpass', fromHz, 0.5, crush);
  v.noise(v.bank.white, t, t + decay + 0.05, lp, 0.25);
  stepped(lp.frequency, t, steppedGlide(fromHz, toHz, 6), decay / 6);
  pluck(env.gain, t, 0.002, peak, decay);
}

/** Stepped square-wave sweep (retro tones). */
function squareSweep(v: Voice, t: number, fromHz: number, toHz: number, steps: number, duration: number, peak: number): void {
  const env = v.gain(0);
  const osc = v.osc('square', fromHz, t, t + duration + 0.05, env);
  stepped(osc.frequency, t, steppedGlide(fromHz, toHz, steps), duration / steps);
  pluck(env.gain, t, 0.002, peak, duration);
}

/** Cannon report: muzzle crack, low thump and a rumbling tail. */
export function cannon(v: Voice, t: number, retro: boolean, timbre: FireTimbre, level: number): void {
  if (retro) {
    squareSweep(v, t, timbre.thumpHz * 6, timbre.thumpHz, 7, 0.27, 0.26 * level);
    crushedBurst(v, t, timbre.noiseHz * 0.7, 300, 0.2, 0.5 * level);
    return;
  }
  const crack = burst(v, t, v.bank.white, 'lowpass', timbre.noiseHz, 0.7, 0.24, 0.75 * level);
  glide(crack.frequency, t, timbre.noiseHz, timbre.noiseHz * 0.12, 0.22);
  thump(v, t, timbre.thumpHz, timbre.thumpHz * 0.35, timbre.decay, 0.9 * level);
  burst(v, t, v.bank.brown, 'lowpass', 380, 0.5, timbre.decay * 2.4, 0.55 * level);
}

/** Shell hitting the ground: thud plus dirt and debris patter. */
export function terrainImpact(v: Voice, t: number, retro: boolean, level: number): void {
  if (retro) {
    crushedBurst(v, t, 1200, 200, 0.3, 0.6 * level);
    squareSweep(v, t, 120, 55, 3, 0.15, 0.12 * level);
    return;
  }
  thump(v, t, 85, 32, 0.32, 0.8 * level);
  const dirt = burst(v, t, v.bank.brown, 'lowpass', 1400, 0.6, 0.5, 0.7 * level);
  glide(dirt.frequency, t, 1400, 250, 0.45);
  burst(v, t + 0.05, v.bank.white, 'bandpass', 2600, 0.8, 0.4, 0.1 * level);
}

/** Shell striking rock or a structure: metallic clang. */
export function obstacleImpact(v: Voice, t: number, retro: boolean, level: number): void {
  if (retro) {
    squareSweep(v, t, 990, 495, 3, 0.18, 0.2 * level);
    crushedBurst(v, t, 2400, 600, 0.08, 0.3 * level);
    return;
  }
  const d = detune();
  for (let i = 0; i < CLANG_PARTIALS.length; i++) {
    const [hz, gain, decay] = CLANG_PARTIALS[i]!;
    const env = v.gain(0);
    v.osc(i === 0 ? 'triangle' : 'sine', hz * d, t, t + decay + 0.05, env);
    pluck(env.gain, t, 0.001, gain * level, decay);
  }
  burst(v, t, v.bank.white, 'bandpass', 3000, 1.5, 0.05, 0.4 * level);
  thump(v, t, 140, 60, 0.15, 0.5 * level);
}

/** Shell striking a tank hull: heavy metallic hit. */
export function tankImpact(v: Voice, t: number, retro: boolean, level: number): void {
  if (retro) {
    squareSweep(v, t, 660, 220, 4, 0.2, 0.22 * level);
    crushedBurst(v, t, 3000, 800, 0.1, 0.35 * level);
    return;
  }
  const d = detune();
  const ringEnv = v.gain(0);
  const ring = v.filter('bandpass', 1700, 4, ringEnv);
  v.osc('square', 196 * d, t, t + 0.5, ring);
  v.osc('sawtooth', 587 * d, t, t + 0.5, ring);
  v.osc('triangle', 1244 * d, t, t + 0.5, ring);
  pluck(ringEnv.gain, t, 0.001, 0.9 * level, 0.42);
  burst(v, t, v.bank.white, 'bandpass', 2400, 1.2, 0.08, 0.5 * level);
  thump(v, t, 120, 50, 0.2, 0.6 * level);
}

/** Tank explosion; `size` 1 = enemy tank, ~2 = the player's tank. */
export function explosion(v: Voice, t: number, retro: boolean, size: number, level: number): void {
  if (retro) {
    crushedBurst(v, t, 2400, 150, 1.0 * size, 0.8 * level);
    squareSweep(v, t, 110, 40, 5, 0.5 * size, 0.25 * level);
    return;
  }
  const len = 1.4 * size;
  burst(v, t, v.bank.white, 'highpass', 700, 0.7, 0.2, 0.6 * level);
  const body = burst(v, t, v.bank.brown, 'lowpass', 2200, 0.8, len, 1.0 * level);
  glide(body.frequency, t, 2200, 120, len);
  thump(v, t, 72, 24, 0.9 * size, 0.9 * level);
  burst(v, t + 0.08, v.bank.white, 'bandpass', 3200, 0.9, len * 0.7, 0.15 * level, 0.7);
}

/** The player's hull being hit: chest thump plus a muffled clank. */
export function hullHit(v: Voice, t: number, retro: boolean, level: number): void {
  thump(v, t, 100, 40, 0.3, 0.9 * level);
  burst(v, t, v.bank.brown, 'lowpass', 600, 0.6, 0.35, 0.6 * level);
  if (retro) {
    squareSweep(v, t, 330, 165, 3, 0.15, 0.15 * level);
    return;
  }
  const env = v.gain(0);
  const ring = v.filter('bandpass', 1400, 5, env);
  v.osc('square', 233, t, t + 0.35, ring);
  v.osc('sawtooth', 622, t, t + 0.35, ring);
  pluck(env.gain, t, 0.001, 0.35 * level, 0.3);
}

/** Bright "hit confirmed" ping when the player's shell damages an enemy. */
export function hitConfirm(v: Voice, t: number, retro: boolean, level: number): void {
  if (retro) {
    squareSweep(v, t, 1320, 1760, 2, 0.09, 0.1 * level);
    return;
  }
  const a = v.gain(0);
  v.osc('triangle', 1760, t, t + 0.15, a);
  pluck(a.gain, t, 0.002, 0.16 * level, 0.12);
  const b = v.gain(0);
  v.osc('sine', 2637, t + 0.03, t + 0.25, b);
  pluck(b.gain, t + 0.03, 0.002, 0.1 * level, 0.18);
}
