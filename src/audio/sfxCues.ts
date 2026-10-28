/**
 * Alert, stinger and UI one-shot recipes. Same conventions as sfxCombat:
 * build into a Voice at time `t`, `retro` selects the arcade variant and
 * `level` scales peak gains.
 */
import { steppedGlide } from './audioMath';
import { glide, pluck, stepped, type Voice } from './synth';

export type UiSound = 'click' | 'hover' | 'toggle' | 'back' | 'start';

const ALERT_NOTES = [440, 554.37, 698.46, 880] as const;
const CHIME_NOTES = [1046.5, 1318.5, 1568, 2093] as const;

/** A single enveloped tone; `toHz` makes it glide (smooth) or step (retro). */
function tone(
  v: Voice,
  t: number,
  retro: boolean,
  type: OscillatorType,
  fromHz: number,
  toHz: number,
  glideTime: number,
  decay: number,
  peak: number,
  dest: AudioNode = v.output,
): void {
  const env = v.gain(0, dest);
  const osc = v.osc(retro ? 'square' : type, fromHz, t, t + decay + 0.05, env);
  if (fromHz !== toHz) {
    if (retro) stepped(osc.frequency, t, steppedGlide(fromHz, toHz, 4), glideTime / 4);
    else glide(osc.frequency, t, fromHz, toHz, glideTime);
  }
  // Square waves are much louder than sines at equal peak.
  pluck(env.gain, t, 0.003, retro ? peak * 0.55 : peak, decay);
}

/** Descending "kill" / failure tone: smooth triangle glide or stepped square. */
export function fallingTone(v: Voice, t: number, retro: boolean, fromHz: number, toHz: number, duration: number, level: number): void {
  const env = v.gain(0);
  if (retro) {
    const osc = v.osc('square', fromHz, t, t + duration + 0.05, env);
    stepped(osc.frequency, t, steppedGlide(fromHz, toHz, 10), duration / 10);
    pluck(env.gain, t, 0.004, 0.45 * level, duration);
    return;
  }
  const osc = v.osc('triangle', fromHz, t, t + duration + 0.05, env);
  glide(osc.frequency, t, fromHz, toHz, duration);
  const sub = v.osc('sine', fromHz / 2, t, t + duration + 0.05, env);
  glide(sub.frequency, t, fromHz / 2, toHz / 2, duration);
  pluck(env.gain, t, 0.01, 0.6 * level, duration);
}

/** Two quick descending chirps warning of incoming damage. */
export function warningChirp(v: Voice, t: number, retro: boolean, level: number): void {
  const out = retro ? v.output : v.filter('lowpass', 3500, 0.7);
  for (let i = 0; i < 2; i++) {
    const start = t + 0.08 + i * 0.11;
    const env = v.gain(0, out);
    const osc = v.osc('square', 1500, start, start + 0.1, env);
    if (retro) stepped(osc.frequency, start, [1500, 1100], 0.03);
    else glide(osc.frequency, start, 1500, 1100, 0.06);
    pluck(env.gain, start, 0.003, 0.12 * level, 0.06);
  }
}

/** Low-health beep; higher pitched when critical. */
export function warningBeep(v: Voice, t: number, retro: boolean, critical: boolean, level: number): void {
  const out = retro ? v.output : v.filter('lowpass', 2600, 0.7);
  const env = v.gain(0, out);
  v.osc('square', critical ? 1250 : 980, t, t + 0.12, env);
  pluck(env.gain, t, 0.004, 0.11 * level, 0.07);
}

/** Wave start: rising sequence of alert tones. */
export function alertRise(v: Voice, t: number, retro: boolean, level: number): void {
  const out = retro ? v.output : v.filter('lowpass', 2600, 0.8);
  for (let i = 0; i < ALERT_NOTES.length; i++) {
    const hz = ALERT_NOTES[i]!;
    const start = t + i * 0.16;
    tone(v, start, retro, 'sawtooth', hz * 0.8, hz, 0.05, 0.15, 0.2 * (0.8 + 0.1 * i) * level, out);
  }
}

/** Wave complete: bright major arpeggio with bell-like tails. */
export function waveChime(v: Voice, t: number, retro: boolean, level: number): void {
  for (let i = 0; i < CHIME_NOTES.length; i++) {
    const hz = CHIME_NOTES[i]!;
    const last = i === CHIME_NOTES.length - 1;
    if (retro) {
      tone(v, t + i * 0.07, true, 'square', hz, hz, 0, last ? 0.35 : 0.12, 0.18 * level);
      continue;
    }
    const start = t + i * 0.09;
    const decay = last ? 1.4 : 0.9;
    tone(v, start, false, 'sine', hz, hz, 0, decay, 0.22 * level);
    tone(v, start, false, 'triangle', hz * 2, hz * 2, 0, decay * 0.5, 0.05 * level);
  }
}

/** Faint radar ping with a distant echo (enemy spawned). */
export function radarPing(v: Voice, t: number, retro: boolean, level: number): void {
  const hz = retro ? 1180 : 1320;
  const out = retro ? v.output : v.filter('bandpass', hz, 8);
  for (let i = 0; i < 2; i++) {
    const start = t + i * 0.22;
    const env = v.gain(0, out);
    v.osc(retro ? 'square' : 'sine', hz, start, start + 0.5, env);
    pluck(env.gain, start, 0.004, (i === 0 ? 1 : 0.35) * (retro ? 0.04 : 0.1) * level, 0.45);
  }
}

/** Game over: long low descending tone. */
export function gameOverTone(v: Voice, t: number, retro: boolean, level: number): void {
  if (retro) {
    const env = v.gain(0);
    const steps = steppedGlide(392, 49, 9);
    const sq = v.osc('square', 392, t, t + 2.25, env);
    stepped(sq.frequency, t, steps, 0.22);
    const tri = v.osc('triangle', 196, t, t + 2.25, env);
    stepped(tri.frequency, t, steps.map((hz) => hz / 2), 0.22);
    pluck(env.gain, t, 0.01, 0.16 * level, 2.1);
    return;
  }
  const env = v.gain(0);
  const lp = v.filter('lowpass', 1400, 1, env);
  const saw = v.osc('sawtooth', 220, t, t + 2.5, lp);
  glide(saw.frequency, t, 220, 48, 2.4);
  glide(lp.frequency, t, 1400, 180, 2.4);
  pluck(env.gain, t, 0.05, 0.35 * level, 2.4);
  const subEnv = v.gain(0);
  const sub = v.osc('sine', 110, t, t + 2.5, subEnv);
  glide(sub.frequency, t, 110, 24, 2.4);
  pluck(subEnv.gain, t, 0.05, 0.4 * level, 2.4);
}

/** Short menu blips. */
export function uiBlip(v: Voice, t: number, retro: boolean, kind: UiSound, level: number): void {
  switch (kind) {
    case 'click': {
      tone(v, t, retro, 'triangle', 880, 880, 0, 0.05, 0.16 * level);
      const env = v.gain(0);
      const hp = v.filter('highpass', 4000, 0.7, env);
      v.noise(v.bank.white, t, t + 0.05, hp);
      pluck(env.gain, t, 0.001, 0.06 * level, 0.015);
      return;
    }
    case 'hover':
      tone(v, t, retro, 'sine', 1320, 1320, 0, 0.03, 0.05 * level);
      return;
    case 'toggle':
      tone(v, t, true, 'square', 660, 990, 0.08, 0.09, (retro ? 0.14 : 0.08) * level);
      return;
    case 'back':
      tone(v, t, retro, 'triangle', 660, 440, 0.07, 0.09, 0.14 * level);
      return;
    case 'start':
      tone(v, t, retro, 'triangle', 440, 880, 0.12, 0.28, 0.18 * level);
      tone(v, t + 0.06, retro, 'sine', 660, 1320, 0.12, 0.28, 0.12 * level);
      return;
  }
}
