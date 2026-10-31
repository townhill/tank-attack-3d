/**
 * Pure mapping functions behind the procedural audio mixer. No Web Audio
 * types live here so every rule can be unit-tested in Node.
 *
 * Functions called every frame take an optional `out` object to avoid
 * per-frame allocation.
 */
import { TANK_SPECS, WATER, type EnemyKind, type TankKind } from '../config/settings';
import { clamp } from '../utils/math';
import type { AudioEnemy } from './types';

/** Distance (m) at which positional sounds play at full level. */
export const REF_DISTANCE = 20;
/** Distance (m) beyond which positional sounds stop getting quieter. */
export const MAX_DISTANCE = 900;
/** Enemies further than this from the player get no engine loop. */
export const ENEMY_ENGINE_RANGE = 250;
export const ENEMY_ENGINE_VOICES = 3;
/** Concurrent one-shot voice cap. */
export const MAX_ONE_SHOT_VOICES = 24;
/** Turret rates (rad/s) below this produce no servo whine. */
export const SERVO_THRESHOLD = 0.08;
export const LOW_HEALTH = 0.3;
export const CRITICAL_HEALTH = 0.15;
/** Seconds between low-health beeps. */
export const LOW_HEALTH_INTERVAL = 0.8;
export const CRITICAL_HEALTH_INTERVAL = 0.35;

export interface EngineParams {
  /** Fundamental frequency (Hz). */
  frequency: number;
  /** Relative level, 0..1. */
  gain: number;
  /** Low-pass cutoff (Hz): brighter under load. */
  filterHz: number;
  /** Cylinder "chug" modulation rate (Hz). */
  chugRate: number;
}

/**
 * Player engine sound from speed (fraction of max) and throttle. Idle is low
 * and dull, cruising is higher pitched, and accelerating (throttle ahead of
 * speed) is the loudest and brightest.
 */
export function engineParams(
  speedFraction: number,
  throttle: number,
  out: EngineParams = { frequency: 0, gain: 0, filterHz: 0, chugRate: 0 },
): EngineParams {
  const speed = clamp(Math.abs(speedFraction), 0, 1);
  const load = clamp(Math.abs(throttle), 0, 1);
  const strain = clamp(load - speed, 0, 1);
  out.frequency = 34 + 30 * speed + 10 * load + 14 * strain;
  out.gain = clamp(0.22 + 0.1 * speed + 0.12 * load + 0.16 * strain, 0, 1);
  out.filterHz = 160 + 420 * speed + 220 * load + 900 * strain;
  out.chugRate = 7 + 9 * speed + 6 * load;
  return out;
}

export interface TrackParams {
  gain: number;
  /** Link clatter modulation rate (Hz). */
  clatterRate: number;
  /** Band-pass centre (Hz). */
  filterHz: number;
}

/** Track rumble and clatter proportional to |speed|; silent when stopped. */
export function trackParams(
  speed: number,
  maxSpeed: number,
  out: TrackParams = { gain: 0, clatterRate: 0, filterHz: 0 },
): TrackParams {
  const raw = maxSpeed > 0 ? clamp(Math.abs(speed) / maxSpeed, 0, 1) : 0;
  const f = raw < 0.015 ? 0 : raw;
  out.gain = 0.42 * Math.sqrt(f);
  out.clatterRate = 4 + 26 * f;
  out.filterHz = 500 + 1800 * f;
  return out;
}

export interface WadeParams {
  gain: number;
  /** Rate of the slosh against the hull (Hz). */
  sloshRate: number;
  /** Band-pass centre of the water noise (Hz). */
  filterHz: number;
  /** Factor on the track clatter, muffled by the water around the running gear. */
  trackDamp: number;
}

/**
 * Water sloshing round a wading hull: silent on dry ground and at a stop,
 * louder and faster with speed, louder and duller as the water deepens up to
 * the deepest a tank can wade. The water also muffles the track clatter.
 */
export function wadeParams(
  speed: number,
  maxSpeed: number,
  depth: number,
  out: WadeParams = { gain: 0, sloshRate: 0, filterHz: 0, trackDamp: 1 },
): WadeParams {
  const submerged = clamp(depth / WATER.impassableDepth, 0, 1);
  const raw = maxSpeed > 0 ? clamp(Math.abs(speed) / maxSpeed, 0, 1) : 0;
  const moving = submerged > 0 && raw >= 0.015 ? raw : 0;
  out.gain = 0.5 * Math.sqrt(moving) * (0.4 + 0.6 * submerged);
  out.sloshRate = 1.2 + 3.5 * moving;
  out.filterHz = 900 + 500 * moving - 450 * submerged;
  out.trackDamp = 1 - 0.6 * submerged;
  return out;
}

export interface ServoParams {
  gain: number;
  frequency: number;
}

/** Turret servo whine from the signed traverse rate; silent below SERVO_THRESHOLD. */
export function servoParams(
  turretYawRate: number,
  maxRate: number = TANK_SPECS.player.turretTraverse,
  out: ServoParams = { gain: 0, frequency: 0 },
): ServoParams {
  const rate = Math.abs(turretYawRate);
  if (rate < SERVO_THRESHOLD || maxRate <= SERVO_THRESHOLD) {
    out.gain = 0;
    out.frequency = 380;
    return out;
  }
  const f = clamp((rate - SERVO_THRESHOLD) / (maxRate - SERVO_THRESHOLD), 0, 1);
  out.gain = 0.05 + 0.1 * f;
  out.frequency = 380 + 560 * f;
  return out;
}

/** Seconds between low-health warning beeps, or 0 for no beeping. */
export function warningInterval(healthFraction: number, alive: boolean): number {
  if (!alive || healthFraction >= LOW_HEALTH) return 0;
  return healthFraction < CRITICAL_HEALTH ? CRITICAL_HEALTH_INTERVAL : LOW_HEALTH_INTERVAL;
}

/** Gain of the Web Audio 'inverse' distance model (matches PannerNode). */
export function distanceGain(
  distance: number,
  refDistance: number = REF_DISTANCE,
  rolloff = 1,
  maxDistance: number = MAX_DISTANCE,
): number {
  if (refDistance <= 0) return 1;
  const d = clamp(distance, refDistance, Math.max(refDistance, maxDistance));
  return refDistance / (refDistance + rolloff * (d - refDistance));
}

export interface EnemyEngineParams {
  frequency: number;
  gain: number;
  filterHz: number;
}

const ENEMY_ENGINE_BASE: Readonly<Record<EnemyKind, { readonly hz: number; readonly gain: number; readonly filterHz: number }>> = {
  heavy: { hz: 26, gain: 0.16, filterHz: 220 },
  standard: { hz: 34, gain: 0.12, filterHz: 300 },
  scout: { hz: 50, gain: 0.09, filterHz: 480 },
};

/** Enemy engine drone: heavies are deeper and louder, scouts lighter. */
export function enemyEngineParams(
  kind: EnemyKind,
  speed: number,
  out: EnemyEngineParams = { frequency: 0, gain: 0, filterHz: 0 },
): EnemyEngineParams {
  const base = ENEMY_ENGINE_BASE[kind];
  const f = clamp(Math.abs(speed) / TANK_SPECS[kind].maxSpeed, 0, 1);
  out.frequency = base.hz * (1 + 0.8 * f);
  out.gain = base.gain * (0.6 + 0.4 * f);
  out.filterHz = base.filterHz + 500 * f;
  return out;
}

export interface FireTimbre {
  /** Low thump start frequency (Hz). */
  readonly thumpHz: number;
  /** Muzzle-crack low-pass start (Hz). */
  readonly noiseHz: number;
  /** Body decay (s). */
  readonly decay: number;
  /** Relative loudness. */
  readonly gain: number;
}

const FIRE_TIMBRES: Readonly<Record<TankKind, FireTimbre>> = {
  player: { thumpHz: 110, noiseHz: 5200, decay: 0.45, gain: 1 },
  standard: { thumpHz: 95, noiseHz: 2400, decay: 0.42, gain: 0.8 },
  heavy: { thumpHz: 68, noiseHz: 1500, decay: 0.6, gain: 0.95 },
  scout: { thumpHz: 150, noiseHz: 3600, decay: 0.28, gain: 0.6 },
};

/** Cannon timbre per tank kind (heavy deeper, scout lighter). */
export function fireTimbre(kind: TankKind): FireTimbre {
  return FIRE_TIMBRES[kind];
}

export interface VoiceSlot {
  readonly startTime: number;
  readonly duration: number;
  /** Estimated peak loudness at the listener. */
  readonly priority: number;
}

/** Current loudness estimate: priority scaled by the fraction of the sound left. */
export function voiceLoudness(slot: VoiceSlot, now: number): number {
  if (slot.duration <= 0) return 0;
  const remaining = 1 - (now - slot.startTime) / slot.duration;
  return slot.priority * clamp(remaining, 0, 1);
}

export type VoiceDecision =
  | { readonly action: 'free' }
  | { readonly action: 'steal'; readonly index: number }
  | { readonly action: 'reject' };

const FREE: VoiceDecision = { action: 'free' };
const REJECT: VoiceDecision = { action: 'reject' };

/**
 * Decides how a new one-shot of the given priority gets a voice: a free slot,
 * stealing the quietest (then oldest) active voice, or dropping the new sound
 * when everything playing is louder.
 */
export function chooseVoice(
  voices: readonly VoiceSlot[],
  maxVoices: number,
  priority: number,
  now: number,
): VoiceDecision {
  if (voices.length < maxVoices) return FREE;
  let victim = -1;
  let victimLoudness = Infinity;
  let victimStart = Infinity;
  for (let i = 0; i < voices.length; i++) {
    const slot = voices[i]!;
    const loudness = voiceLoudness(slot, now);
    const quieter = loudness < victimLoudness - 1e-6;
    const tiedButOlder = Math.abs(loudness - victimLoudness) <= 1e-6 && slot.startTime < victimStart;
    if (quieter || tiedButOlder) {
      victim = i;
      victimLoudness = loudness;
      victimStart = slot.startTime;
    }
  }
  if (victim < 0 || victimLoudness > priority) return REJECT;
  return { action: 'steal', index: victim };
}

const MAX_NEAREST = 8;
const nearestDistSq = new Float64Array(MAX_NEAREST);

/**
 * Writes indices of the enemies nearest to (x, z) and within `range` into
 * `out`, nearest first. Returns how many were written (at most out.length, 8).
 */
export function selectNearestEnemies(
  enemies: readonly AudioEnemy[],
  x: number,
  z: number,
  range: number,
  out: number[],
): number {
  const cap = Math.min(out.length, MAX_NEAREST);
  const rangeSq = range * range;
  let count = 0;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i]!;
    const dx = e.x - x;
    const dz = e.z - z;
    const d = dx * dx + dz * dz;
    if (d > rangeSq || cap === 0) continue;
    let pos: number;
    if (count < cap) {
      pos = count++;
    } else if (d < nearestDistSq[cap - 1]!) {
      pos = cap - 1;
    } else {
      continue;
    }
    while (pos > 0 && nearestDistSq[pos - 1]! > d) {
      nearestDistSq[pos] = nearestDistSq[pos - 1]!;
      out[pos] = out[pos - 1]!;
      pos--;
    }
    nearestDistSq[pos] = d;
    out[pos] = i;
  }
  return count;
}

/**
 * Stereo pan (-1 left .. 1 right) of a source at (sx, sz) heard by a listener
 * at (lx, lz) facing (fx, fz) in the Y-up world.
 */
export function relativePan(lx: number, lz: number, fx: number, fz: number, sx: number, sz: number): number {
  const dx = sx - lx;
  const dz = sz - lz;
  const len = Math.hypot(dx, dz);
  const flen = Math.hypot(fx, fz);
  if (len < 1e-6 || flen < 1e-6) return 0;
  // The camera's right vector for forward (fx, fz) is (-fz, fx).
  return clamp((dx * -fz + dz * fx) / (len * flen), -1, 1);
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** Listener up vector: world up made orthogonal to forward (north if looking straight down/up). */
export function listenerUp(forwardX: number, forwardY: number, forwardZ: number, out: Vec3Like = { x: 0, y: 1, z: 0 }): Vec3Like {
  const flen = Math.hypot(forwardX, forwardY, forwardZ);
  if (flen < 1e-6) {
    out.x = 0;
    out.y = 1;
    out.z = 0;
    return out;
  }
  const fx = forwardX / flen;
  const fy = forwardY / flen;
  const fz = forwardZ / flen;
  let ux = -fy * fx;
  let uy = 1 - fy * fy;
  let uz = -fy * fz;
  let len = Math.hypot(ux, uy, uz);
  if (len < 1e-4) {
    // Forward is vertical: use north (-Z) projected off forward.
    ux = fz * fx;
    uy = fz * fy;
    uz = -1 + fz * fz;
    len = Math.hypot(ux, uy, uz);
    if (len < 1e-4) {
      out.x = 0;
      out.y = 1;
      out.z = 0;
      return out;
    }
  }
  out.x = ux / len;
  out.y = uy / len;
  out.z = uz / len;
  return out;
}

/** Geometric pitch staircase from `startHz` to `endHz` for retro sweeps. */
export function steppedGlide(startHz: number, endHz: number, steps: number): number[] {
  const n = Math.max(1, Math.floor(steps));
  if (n === 1) return [startHz];
  const ratio = endHz / startHz;
  const result: number[] = [];
  for (let i = 0; i < n; i++) result.push(startHz * Math.pow(ratio, i / (n - 1)));
  return result;
}

/** Wave-shaper curve quantising amplitude to `levels` steps (bit-crush feel). */
export function crushCurve(levels: number, size = 1024): Float32Array<ArrayBuffer> {
  const steps = Math.max(2, Math.floor(levels));
  const curve = new Float32Array(Math.max(2, size));
  const n = curve.length;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const q = Math.round(((x + 1) / 2) * (steps - 1)) / (steps - 1);
    curve[i] = q * 2 - 1;
  }
  return curve;
}
