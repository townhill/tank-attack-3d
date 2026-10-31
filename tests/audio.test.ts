import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioManager, type AudioEnemy, type AudioFrame } from '../src/audio/AudioManager';
import {
  chooseVoice,
  CRITICAL_HEALTH_INTERVAL,
  crushCurve,
  distanceGain,
  enemyEngineParams,
  engineParams,
  fireTimbre,
  listenerUp,
  LOW_HEALTH_INTERVAL,
  MAX_ONE_SHOT_VOICES,
  REF_DISTANCE,
  relativePan,
  selectNearestEnemies,
  SERVO_THRESHOLD,
  servoParams,
  steppedGlide,
  trackParams,
  voiceLoudness,
  wadeParams,
  warningInterval,
  type VoiceSlot,
} from '../src/audio/audioMath';
import { impactRecipeFor } from '../src/audio/eventSounds';
import { obstacleImpact, terrainImpact, waterImpact } from '../src/audio/sfxCombat';
import { WATER } from '../src/config/settings';
import { Mixer } from '../src/audio/mixer';
import { getAudioContextCtor, setPannerPosition } from '../src/audio/synth';
import type { GameEvent } from '../src/game/events';

// ---------------------------------------------------------------------------
// Minimal fake Web Audio graph. It enforces the spec rules most likely to be
// broken by recipes (positive exponential targets, finite values, single
// start) so building every sound in Node catches real runtime errors.
// ---------------------------------------------------------------------------

class FakeParam {
  value = 0;
  private check(v: number, t: number): void {
    if (!Number.isFinite(v) || !Number.isFinite(t)) throw new TypeError('non-finite automation value');
  }
  setValueAtTime(v: number, t: number): this {
    this.check(v, t);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    this.check(v, t);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    this.check(v, t);
    if (v <= 0) throw new RangeError('exponential ramp target must be positive');
    return this;
  }
  setTargetAtTime(v: number, t: number, tc: number): this {
    this.check(v, t);
    if (!(tc >= 0)) throw new RangeError('bad time constant');
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

class FakeNode {
  connected = false;
  disconnected = false;
  connect<T>(dest: T): T {
    if (!(dest instanceof FakeNode) && !(dest instanceof FakeParam)) throw new TypeError('bad connect target');
    this.connected = true;
    return dest;
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

class FakeSource extends FakeNode {
  onended: (() => void) | null = null;
  started = false;
  ended = false;
  stopAt = Infinity;
  constructor(private readonly ctx: FakeAudioContext) {
    super();
    ctx.sources.push(this);
  }
  start(when = 0): void {
    if (this.started) throw new Error('InvalidStateError: start called twice');
    if (!Number.isFinite(when)) throw new TypeError('bad start time');
    this.started = true;
  }
  stop(when = 0): void {
    if (!this.started) throw new Error('InvalidStateError: stop before start');
    this.stopAt = Math.max(when, this.ctx.currentTime);
  }
}

class FakeOscillator extends FakeSource {
  type = 'sine';
  readonly frequency = new FakeParam();
}

class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null;
  loop = false;
  readonly playbackRate = new FakeParam();
  override start(when = 0): void {
    super.start(when);
    // A one-shot (non-looping) buffer ends by itself.
    if (!this.loop && this.buffer) this.stopAt = when + this.buffer.duration;
  }
}

class FakeBiquad extends FakeNode {
  type = 'lowpass';
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();
}

class FakeShaper extends FakeNode {
  curve: Float32Array | null = null;
}

class FakePanner extends FakeNode {
  panningModel = 'equalpower';
  distanceModel = 'inverse';
  refDistance = 1;
  maxDistance = 10000;
  rolloffFactor = 1;
  readonly positionX = new FakeParam();
  readonly positionY = new FakeParam();
  readonly positionZ = new FakeParam();
}

class LegacyPanner extends FakeNode {
  position: [number, number, number] = [0, 0, 0];
  setPosition(x: number, y: number, z: number): void {
    this.position = [x, y, z];
  }
}

class FakeStereoPanner extends FakeNode {
  readonly pan = new FakeParam();
}

class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam();
  readonly knee = new FakeParam();
  readonly ratio = new FakeParam();
  readonly attack = new FakeParam();
  readonly release = new FakeParam();
}

class FakeBuffer {
  private readonly data: Float32Array;
  readonly duration: number;
  constructor(length: number, sampleRate: number) {
    this.data = new Float32Array(length);
    this.duration = length / sampleRate;
  }
  getChannelData(): Float32Array {
    return this.data;
  }
}

class FakeListener {
  readonly positionX = new FakeParam();
  readonly positionY = new FakeParam();
  readonly positionZ = new FakeParam();
  readonly forwardX = new FakeParam();
  readonly forwardY = new FakeParam();
  readonly forwardZ = new FakeParam();
  readonly upX = new FakeParam();
  readonly upY = new FakeParam();
  readonly upZ = new FakeParam();
}

class FakeAudioContext {
  static last: FakeAudioContext | null = null;
  currentTime = 0;
  readonly sampleRate = 8000;
  state = 'suspended';
  readonly destination = new FakeNode();
  readonly listener = new FakeListener();
  readonly sources: FakeSource[] = [];

  constructor() {
    FakeAudioContext.last = this;
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
  createGain(): FakeGain {
    return new FakeGain();
  }
  createOscillator(): FakeOscillator {
    return new FakeOscillator(this);
  }
  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource(this);
  }
  createBiquadFilter(): FakeBiquad {
    return new FakeBiquad();
  }
  createWaveShaper(): FakeShaper {
    return new FakeShaper();
  }
  createPanner(): FakePanner {
    return new FakePanner();
  }
  createStereoPanner(): FakeStereoPanner {
    return new FakeStereoPanner();
  }
  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor();
  }
  createBuffer(_channels: number, length: number, sampleRate: number): FakeBuffer {
    return new FakeBuffer(length, sampleRate);
  }
  /** Advances time and fires `onended` for sources whose stop time passed. */
  advance(seconds: number): void {
    this.currentTime += seconds;
    for (const src of this.sources) {
      if (src.ended || src.stopAt > this.currentTime) continue;
      src.ended = true;
      src.onended?.();
    }
  }
  liveSources(): number {
    return this.sources.filter((s) => s.started && !s.ended).length;
  }
}

function fakeMixer(): { mixer: Mixer; ctx: FakeAudioContext } {
  const ctx = new FakeAudioContext();
  ctx.state = 'running';
  return { mixer: new Mixer(ctx as unknown as AudioContext), ctx };
}

function enemy(id: number, x: number, z: number, kind: AudioEnemy['kind'] = 'standard'): AudioEnemy {
  return { id, kind, x, y: 0, z, speed: 5 };
}

function frame(overrides: Partial<AudioFrame> = {}): AudioFrame {
  return {
    listenerX: 0,
    listenerY: 8,
    listenerZ: 12,
    listenerForwardX: 0,
    listenerForwardY: -0.3,
    listenerForwardZ: -0.95,
    playerX: 0,
    playerY: 0,
    playerZ: 0,
    playerSpeed: 8,
    playerMaxSpeed: 15,
    throttle: 1,
    turretYawRate: 1,
    playerHealthFraction: 1,
    playerAlive: true,
    playerWadeDepth: 0,
    enemies: [enemy(1, 50, -50), enemy(2, -80, 0, 'heavy'), enemy(3, 0, 120, 'scout'), enemy(4, 200, 200)],
    ...overrides,
  };
}

const ALL_EVENTS: readonly GameEvent[] = [
  { type: 'fire', tankId: 0, kind: 'player', faction: 'player', x: 0, y: 2, z: 0, dx: 0, dy: 0, dz: -1 },
  { type: 'fire', tankId: 5, kind: 'heavy', faction: 'enemy', x: 40, y: 2, z: -60, dx: 0, dy: 0, dz: 1 },
  { type: 'impact', surface: 'terrain', faction: 'player', x: 10, y: 0, z: -100 },
  { type: 'impact', surface: 'obstacle', faction: 'enemy', x: 5, y: 3, z: 5 },
  { type: 'impact', surface: 'tank', faction: 'player', x: 40, y: 2, z: -60 },
  { type: 'impact', surface: 'expired', faction: 'player', x: 0, y: 0, z: 0 },
  { type: 'tankHit', tankId: 5, attackerId: 0, kind: 'heavy', faction: 'enemy', damage: 20, zone: 'side', x: 40, y: 2, z: -60 },
  { type: 'tankDestroyed', tankId: 5, kind: 'heavy', faction: 'enemy', byPlayer: true, score: 250, x: 40, y: 0, z: -60 },
  { type: 'tankDestroyed', tankId: 0, kind: 'player', faction: 'player', byPlayer: false, score: 0, x: 0, y: 0, z: 0 },
  { type: 'playerDamaged', amount: 16, sourceX: 80, sourceZ: 0, healthFraction: 0.5 },
  { type: 'enemySpawned', tankId: 9, kind: 'scout', x: -300, z: 0 },
  { type: 'waveStart', wave: 2, enemies: 4 },
  { type: 'waveComplete', wave: 2, bonus: 500, repair: 20 },
  { type: 'gameOver' },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  FakeAudioContext.last = null;
});

describe('engineParams', () => {
  const idle = engineParams(0, 0);
  const accelerating = engineParams(0.2, 1);
  const cruising = engineParams(1, 1);

  it('makes idle, acceleration and cruising distinguishable', () => {
    expect(idle.frequency).toBeLessThan(accelerating.frequency);
    expect(accelerating.frequency).toBeLessThan(cruising.frequency);
    expect(idle.gain).toBeLessThan(cruising.gain);
    expect(accelerating.gain).toBeGreaterThan(cruising.gain);
    expect(accelerating.filterHz).toBeGreaterThan(cruising.filterHz);
    expect(idle.filterHz).toBeLessThan(cruising.filterHz);
  });

  it('treats reverse like forward and clamps out-of-range input', () => {
    expect(engineParams(-0.5, -1)).toEqual(engineParams(0.5, 1));
    expect(engineParams(5, 3)).toEqual(engineParams(1, 1));
  });

  it('writes into the provided out object', () => {
    const out = { frequency: 0, gain: 0, filterHz: 0, chugRate: 0 };
    expect(engineParams(0.5, 0.5, out)).toBe(out);
    expect(out.frequency).toBeGreaterThan(0);
  });
});

describe('trackParams', () => {
  it('is silent when stopped and grows with |speed|', () => {
    expect(trackParams(0, 15).gain).toBe(0);
    const slow = trackParams(3, 15);
    const fast = trackParams(15, 15);
    expect(slow.gain).toBeGreaterThan(0);
    expect(fast.gain).toBeGreaterThan(slow.gain);
    expect(fast.clatterRate).toBeGreaterThan(slow.clatterRate);
    expect(trackParams(-6, 15)).toEqual(trackParams(6, 15));
  });

  it('handles a zero max speed', () => {
    expect(trackParams(5, 0).gain).toBe(0);
  });
});

describe('wadeParams', () => {
  const deep = WATER.impassableDepth;

  it('is silent on dry ground and when stopped in the water', () => {
    expect(wadeParams(10, 15, 0).gain).toBe(0);
    expect(wadeParams(0, 15, 0.8).gain).toBe(0);
    expect(wadeParams(10, 0, 0.8).gain).toBe(0);
  });

  it('sloshes louder and faster with speed, in either direction', () => {
    const slow = wadeParams(3, 15, 0.6);
    const fast = wadeParams(12, 15, 0.6);
    expect(slow.gain).toBeGreaterThan(0);
    expect(fast.gain).toBeGreaterThan(slow.gain);
    expect(fast.sloshRate).toBeGreaterThan(slow.sloshRate);
    expect(wadeParams(-8, 15, 0.6)).toEqual(wadeParams(8, 15, 0.6));
  });

  it('gets louder and duller as the water deepens, levelling off at the deepest a tank can wade', () => {
    const shallow = wadeParams(10, 15, 0.2);
    const wading = wadeParams(10, 15, deep * 0.9);
    expect(wading.gain).toBeGreaterThan(shallow.gain);
    expect(wading.filterHz).toBeLessThan(shallow.filterHz);
    expect(wadeParams(10, 15, deep * 3)).toEqual(wadeParams(10, 15, deep));
  });

  it('muffles the track clatter in water but never on dry ground', () => {
    expect(wadeParams(10, 15, 0).trackDamp).toBe(1);
    expect(wadeParams(0, 15, 0.8).trackDamp).toBeLessThan(1);
    expect(wadeParams(10, 15, deep).trackDamp).toBeLessThan(wadeParams(10, 15, 0.2).trackDamp);
    expect(wadeParams(10, 15, deep).trackDamp).toBeGreaterThan(0);
  });

  it('writes into the provided out object', () => {
    const out = { gain: 0, sloshRate: 0, filterHz: 0, trackDamp: 0 };
    expect(wadeParams(5, 15, 0.5, out)).toBe(out);
    expect(out.gain).toBeGreaterThan(0);
  });
});

describe('impactRecipeFor', () => {
  it('gives shells landing in water a splash of their own', () => {
    expect(impactRecipeFor('water')).toBe(waterImpact);
    expect(impactRecipeFor('terrain')).toBe(terrainImpact);
    expect(impactRecipeFor('bridge')).toBe(obstacleImpact);
    expect(impactRecipeFor('expired')).toBeNull();
  });
});

describe('servoParams', () => {
  it('is silent below the threshold and rises with rate in either direction', () => {
    expect(servoParams(SERVO_THRESHOLD * 0.5).gain).toBe(0);
    const slow = servoParams(0.5);
    const fast = servoParams(-2);
    expect(slow.gain).toBeGreaterThan(0);
    expect(fast.gain).toBeGreaterThan(slow.gain);
    expect(fast.frequency).toBeGreaterThan(slow.frequency);
    expect(servoParams(100)).toEqual(servoParams(-100));
  });
});

describe('warningInterval', () => {
  it('beeps below 30% health, faster below 15%, never when dead', () => {
    expect(warningInterval(0.5, true)).toBe(0);
    expect(warningInterval(0.3, true)).toBe(0);
    expect(warningInterval(0.2, true)).toBe(LOW_HEALTH_INTERVAL);
    expect(warningInterval(0.1, true)).toBe(CRITICAL_HEALTH_INTERVAL);
    expect(CRITICAL_HEALTH_INTERVAL).toBeLessThan(LOW_HEALTH_INTERVAL);
    expect(warningInterval(0.1, false)).toBe(0);
  });
});

describe('distanceGain', () => {
  it('matches the inverse distance model', () => {
    expect(distanceGain(0)).toBe(1);
    expect(distanceGain(REF_DISTANCE)).toBe(1);
    expect(distanceGain(REF_DISTANCE * 2)).toBeCloseTo(0.5);
    expect(distanceGain(100, 20, 0.5)).toBeGreaterThan(distanceGain(100, 20, 1));
  });

  it('decreases with distance and stops at maxDistance', () => {
    expect(distanceGain(300)).toBeLessThan(distanceGain(100));
    expect(distanceGain(5000)).toBe(distanceGain(900));
  });
});

describe('voice priority', () => {
  const slot = (startTime: number, duration: number, priority: number): VoiceSlot => ({ startTime, duration, priority });

  it('estimates loudness from what is left of a voice', () => {
    expect(voiceLoudness(slot(0, 2, 1), 0)).toBe(1);
    expect(voiceLoudness(slot(0, 2, 1), 1)).toBeCloseTo(0.5);
    expect(voiceLoudness(slot(0, 2, 1), 3)).toBe(0);
    expect(voiceLoudness(slot(0, 0, 1), 0)).toBe(0);
  });

  it('uses a free slot while under the cap', () => {
    expect(chooseVoice([slot(0, 1, 1)], 2, 0.1, 0)).toEqual({ action: 'free' });
  });

  it('steals the quietest voice, then the oldest on ties', () => {
    const voices = [slot(0, 1, 0.9), slot(0, 1, 0.2), slot(0, 1, 0.5)];
    expect(chooseVoice(voices, 3, 0.6, 0)).toEqual({ action: 'steal', index: 1 });
    // At t = 1.5 both have 0.15 loudness left; the older one (index 1) goes.
    expect(chooseVoice([slot(1, 1, 0.3), slot(0, 2, 0.6)], 2, 1, 1.5)).toEqual({ action: 'steal', index: 1 });
  });

  it('prefers finished voices and rejects sounds quieter than everything playing', () => {
    expect(chooseVoice([slot(0, 1, 1), slot(0, 0.1, 1)], 2, 0.01, 0.5)).toEqual({ action: 'steal', index: 1 });
    expect(chooseVoice([slot(0, 1, 0.8), slot(0, 1, 0.9)], 2, 0.1, 0)).toEqual({ action: 'reject' });
  });
});

describe('selectNearestEnemies', () => {
  const enemies = [enemy(1, 100, 0), enemy(2, 10, 0), enemy(3, 0, 300), enemy(4, 0, -50), enemy(5, 30, 30)];

  it('returns the nearest in-range enemies, nearest first', () => {
    const out = [-1, -1, -1];
    const count = selectNearestEnemies(enemies, 0, 0, 250, out);
    expect(count).toBe(3);
    expect(out.map((i) => enemies[i]?.id)).toEqual([2, 5, 4]);
  });

  it('excludes enemies out of range and handles fewer than the cap', () => {
    const out = [-1, -1, -1];
    expect(selectNearestEnemies(enemies, 0, 300, 60, out)).toBe(1);
    expect(enemies[out[0]!]?.id).toBe(3);
    expect(selectNearestEnemies([], 0, 0, 250, out)).toBe(0);
    expect(selectNearestEnemies(enemies, 0, 0, 250, [])).toBe(0);
  });
});

describe('relativePan', () => {
  it('pans relative to the listener facing', () => {
    // Facing north (-Z): east is right, west is left.
    expect(relativePan(0, 0, 0, -1, 10, 0)).toBeCloseTo(1);
    expect(relativePan(0, 0, 0, -1, -10, 0)).toBeCloseTo(-1);
    expect(relativePan(0, 0, 0, -1, 0, -10)).toBeCloseTo(0);
    // Facing east (+X): south (+Z) is on the right.
    expect(relativePan(0, 0, 1, 0, 0, 10)).toBeCloseTo(1);
    expect(relativePan(5, 5, 0, -1, 5, 5)).toBe(0);
  });
});

describe('listenerUp', () => {
  it('returns a unit vector orthogonal to forward', () => {
    for (const [fx, fy, fz] of [
      [0, 0, -1],
      [0, -0.6, -0.8],
      [0, -1, 0],
      [0.3, 0.9, 0.3],
    ] as const) {
      const up = listenerUp(fx, fy, fz);
      expect(Math.hypot(up.x, up.y, up.z)).toBeCloseTo(1);
      expect((up.x * fx + up.y * fy + up.z * fz) / Math.hypot(fx, fy, fz)).toBeCloseTo(0);
    }
    expect(listenerUp(0, 0, 0)).toEqual({ x: 0, y: 1, z: 0 });
    const level = listenerUp(0, 0, -1);
    expect(level.x).toBeCloseTo(0);
    expect(level.y).toBeCloseTo(1);
    expect(level.z).toBeCloseTo(0);
  });
});

describe('per-kind timbres', () => {
  it('makes heavies deeper and scouts lighter', () => {
    expect(fireTimbre('heavy').thumpHz).toBeLessThan(fireTimbre('standard').thumpHz);
    expect(fireTimbre('standard').thumpHz).toBeLessThan(fireTimbre('scout').thumpHz);
    expect(fireTimbre('heavy').decay).toBeGreaterThan(fireTimbre('scout').decay);
    expect(enemyEngineParams('heavy', 0).frequency).toBeLessThan(enemyEngineParams('scout', 0).frequency);
    expect(enemyEngineParams('standard', 10).frequency).toBeGreaterThan(enemyEngineParams('standard', 0).frequency);
  });
});

describe('retro helpers', () => {
  it('builds a geometric pitch staircase', () => {
    const steps = steppedGlide(800, 100, 4);
    expect(steps).toHaveLength(4);
    expect(steps[0]).toBe(800);
    expect(steps[3]).toBeCloseTo(100);
    expect(steps[1]! / steps[0]!).toBeCloseTo(steps[2]! / steps[1]!);
    expect(steppedGlide(440, 220, 1)).toEqual([440]);
  });

  it('quantises amplitude to the requested levels, keeping silence at zero', () => {
    const curve = crushCurve(7, 257);
    expect(curve[0]).toBe(-1);
    expect(curve[256]).toBe(1);
    expect(curve[128]).toBeCloseTo(0);
    expect(new Set(Array.from(curve, (v) => v.toFixed(4))).size).toBe(7);
    for (let i = 1; i < curve.length; i++) expect(curve[i]!).toBeGreaterThanOrEqual(curve[i - 1]!);
  });
});

describe('AudioManager without Web Audio (Node)', () => {
  it('is a silent no-op before and after unlock', () => {
    expect(getAudioContextCtor()).toBeNull();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const audio = new AudioManager();
    expect(() => {
      audio.setVolumes(0.5, 0.5);
      audio.update(1 / 60, frame());
      for (const e of ALL_EVENTS) audio.handleEvent(e, 0);
      audio.unlock();
      audio.setMuted(true);
      audio.setRetro(true);
      audio.playUi('click');
      audio.setPaused(true);
      audio.update(1 / 60, frame());
      audio.stopAll();
      audio.dispose();
    }).not.toThrow();
    expect(audio.unlocked).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('AudioManager with a fake AudioContext', () => {
  function unlockedManager(): { audio: AudioManager; ctx: FakeAudioContext } {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const audio = new AudioManager();
    audio.unlock();
    const ctx = FakeAudioContext.last;
    if (!ctx) throw new Error('AudioContext was not created');
    return { audio, ctx };
  }

  it('creates and resumes the context on unlock, once', async () => {
    const { audio, ctx } = unlockedManager();
    await Promise.resolve();
    expect(audio.unlocked).toBe(true);
    audio.unlock();
    expect(FakeAudioContext.last).toBe(ctx);
  });

  it('builds loops and plays every event sound in both modes without errors', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { audio, ctx } = unlockedManager();
    for (const retro of [false, true]) {
      audio.setRetro(retro);
      audio.update(1 / 60, frame({ playerHealthFraction: 0.1 }));
      for (const e of ALL_EVENTS) audio.handleEvent(e, 0);
      for (const kind of ['click', 'hover', 'toggle', 'back', 'start'] as const) audio.playUi(kind);
      ctx.advance(0.02);
      audio.update(1 / 60, frame({ playerAlive: false, enemies: [] }));
    }
    expect(warn).not.toHaveBeenCalled();
    expect(ctx.liveSources()).toBeGreaterThan(0);
  });

  it('drives the wading slosh while the player crosses water, and tears it down with the rest', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { audio, ctx } = unlockedManager();
    audio.update(1 / 60, frame({ playerWadeDepth: 0.8, playerSpeed: 10 }));
    ctx.advance(0.5);
    audio.update(1 / 60, frame({ playerWadeDepth: 0, playerSpeed: 10 }));
    expect(warn).not.toHaveBeenCalled();
    audio.stopAll();
    ctx.advance(10);
    expect(ctx.liveSources()).toBe(0);
    audio.dispose();
  });

  it('cleans up one-shots and stops loops on stopAll, rebuilding on the next update', () => {
    const { audio, ctx } = unlockedManager();
    const before = ctx.sources.length;
    audio.update(1 / 60, frame());
    const loopSources = ctx.sources.length - before;
    audio.handleEvent(ALL_EVENTS[0]!, 0);
    audio.stopAll();
    ctx.advance(10);
    expect(ctx.liveSources()).toBe(0);
    audio.update(1 / 60, frame());
    expect(ctx.liveSources()).toBe(loopSources);
    audio.dispose();
    expect(ctx.state).toBe('closed');
  });

  it('keeps warning beeps on their interval', () => {
    const { audio, ctx } = unlockedManager();
    audio.update(1 / 60, frame());
    const before = ctx.sources.length;
    audio.update(0.1, frame({ playerHealthFraction: 0.2 }));
    const afterFirst = ctx.sources.length;
    expect(afterFirst).toBeGreaterThan(before);
    audio.update(0.1, frame({ playerHealthFraction: 0.2 }));
    expect(ctx.sources.length).toBe(afterFirst);
  });
});

describe('Mixer voice management', () => {
  it('caps concurrent one-shots and frees voices when they end', () => {
    const { mixer, ctx } = fakeMixer();
    for (let i = 0; i < MAX_ONE_SHOT_VOICES * 3; i++) {
      mixer.playAt(i, 0, -30, 1, 20, 1, (v, t) => {
        v.osc('sine', 440, t, t + 0.5);
      });
    }
    expect(mixer.activeVoices).toBe(MAX_ONE_SHOT_VOICES);
    ctx.advance(1);
    expect(mixer.activeVoices).toBe(0);
    expect(ctx.liveSources()).toBe(0);
  });

  it('skips positional sounds too far away to hear', () => {
    const { mixer } = fakeMixer();
    mixer.playAt(0, 0, -5000, 0.05, 20, 1, (v, t) => {
      v.osc('sine', 440, t, t + 0.5);
    });
    expect(mixer.activeVoices).toBe(0);
  });

  it('falls back to the legacy panner API', () => {
    const legacy = new LegacyPanner();
    setPannerPosition(legacy as unknown as PannerNode, 1, 2, 3, 0, 0.05);
    expect(legacy.position).toEqual([1, 2, 3]);
  });
});
