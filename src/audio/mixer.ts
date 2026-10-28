/**
 * Owns the AudioContext graph: one-shot and loop buses, the master gain and
 * the compressor/limiter chain, plus helpers that spawn routed voices.
 *
 *   one-shots ─┐
 *   loops ─────┴─> sfxBus ─> master ─> compressor ─> limiter ─> destination
 */
import { distanceGain, listenerUp, MAX_ONE_SHOT_VOICES, relativePan, type Vec3Like } from './audioMath';
import { createNoiseBank, createPanner, setListenerPose, setPannerPosition, Voice, VoicePool, type NoiseBank } from './synth';
import type { AudioFrame } from './types';

/** Builds a sound into `voice`, starting at context time `t`. */
export type VoiceBuilder = (voice: Voice, t: number) => void;

/** Sounds estimated quieter than this at the listener are skipped. */
const INAUDIBLE = 0.004;
const LEVEL_TIME_CONSTANT = 0.03;

export class Mixer {
  readonly bank: NoiseBank;
  readonly sfxBus: GainNode;
  readonly loopBus: GainNode;
  private readonly master: GainNode;
  private readonly compressor: DynamicsCompressorNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly pool = new VoicePool(MAX_ONE_SHOT_VOICES);
  private readonly hasStereoPanner: boolean;
  private readonly releaseVoice = (voice: Voice): void => {
    this.pool.remove(voice);
  };
  private readonly pose = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: -1, ux: 0, uy: 1, uz: 0 };
  private readonly up: Vec3Like = { x: 0, y: 1, z: 0 };

  constructor(readonly ctx: AudioContext) {
    this.bank = createNoiseBank(ctx);
    this.hasStereoPanner = 'createStereoPanner' in ctx;

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.25;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.1;

    this.master = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.loopBus = ctx.createGain();
    this.loopBus.connect(this.sfxBus);
    this.sfxBus.connect(this.master);
    this.master.connect(this.compressor);
    this.compressor.connect(this.limiter);
    this.limiter.connect(ctx.destination);
  }

  get now(): number {
    return this.ctx.currentTime;
  }

  /** One-shot voices currently held by the pool. */
  get activeVoices(): number {
    return this.pool.size;
  }

  /** Plays a silent sample so iOS releases the output inside a user gesture. */
  primeOutput(): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    src.connect(this.ctx.destination);
    src.onended = () => {
      src.disconnect();
    };
    src.start();
  }

  setLevels(master: number, sfx: number, muted: boolean): void {
    const now = this.now;
    this.master.gain.setTargetAtTime(muted ? 0 : master, now, LEVEL_TIME_CONSTANT);
    this.sfxBus.gain.setTargetAtTime(sfx, now, LEVEL_TIME_CONSTANT);
  }

  /** Fades the continuous-loop bus (pause / menus). */
  setLoopLevel(level: number, timeConstant: number): void {
    const param = this.loopBus.gain;
    if (timeConstant <= 0) param.setValueAtTime(level, this.now);
    else param.setTargetAtTime(level, this.now, timeConstant);
  }

  setListener(frame: AudioFrame, now: number): void {
    const p = this.pose;
    p.x = frame.listenerX;
    p.y = frame.listenerY;
    p.z = frame.listenerZ;
    p.fx = frame.listenerForwardX;
    p.fy = frame.listenerForwardY;
    p.fz = frame.listenerForwardZ;
    listenerUp(p.fx, p.fy, p.fz, this.up);
    p.ux = this.up.x;
    p.uy = this.up.y;
    p.uz = this.up.z;
    setListenerPose(this.ctx.listener, p, now);
  }

  /** Stereo pan of a ground position relative to the current listener. */
  panTowards(x: number, z: number): number {
    const p = this.pose;
    return relativePan(p.x, p.z, p.fx, p.fz, x, z);
  }

  distanceTo(x: number, y: number, z: number): number {
    const p = this.pose;
    return Math.hypot(x - p.x, y - p.y, z - p.z);
  }

  /** Non-positional one-shot. */
  playDirect(priority: number, build: VoiceBuilder, persistent = false): void {
    if (!this.pool.admit(priority, this.now)) return;
    const voice = new Voice(this.ctx, this.bank, this.sfxBus, priority, this.releaseVoice);
    voice.persistent = persistent;
    this.finishVoice(voice, build);
  }

  /** One-shot panned left/right (-1..1) without distance attenuation. */
  playPanned(pan: number, priority: number, build: VoiceBuilder): void {
    if (!this.hasStereoPanner) {
      this.playDirect(priority, build);
      return;
    }
    if (!this.pool.admit(priority, this.now)) return;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(this.sfxBus);
    const voice = new Voice(this.ctx, this.bank, panner, priority, this.releaseVoice);
    voice.track(panner);
    this.finishVoice(voice, build);
  }

  /** One-shot positioned in the world; skipped when inaudible. */
  playAt(
    x: number,
    y: number,
    z: number,
    loudness: number,
    refDistance: number,
    rolloff: number,
    build: VoiceBuilder,
  ): void {
    const priority = loudness * distanceGain(this.distanceTo(x, y, z), refDistance, rolloff);
    if (!(priority >= INAUDIBLE) || !this.pool.admit(priority, this.now)) return;
    const panner = createPanner(this.ctx, refDistance, rolloff);
    setPannerPosition(panner, x, y, z, this.now, 0);
    panner.connect(this.sfxBus);
    const voice = new Voice(this.ctx, this.bank, panner, priority, this.releaseVoice);
    voice.track(panner);
    this.finishVoice(voice, build);
  }

  /** Kills one-shots; persistent stingers ring out unless `everything`. */
  killVoices(everything: boolean): void {
    this.pool.killAll(everything);
  }

  close(): void {
    this.pool.finishAll();
    this.loopBus.disconnect();
    this.sfxBus.disconnect();
    this.master.disconnect();
    this.compressor.disconnect();
    this.limiter.disconnect();
    if (this.ctx.state !== 'closed') void this.ctx.close().catch(() => undefined);
  }

  private finishVoice(voice: Voice, build: VoiceBuilder): void {
    this.pool.add(voice);
    try {
      build(voice, this.now);
    } finally {
      voice.seal();
    }
  }
}
