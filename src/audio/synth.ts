/**
 * Low-level Web Audio building blocks: context detection, shared noise
 * buffers, envelope helpers, self-cleaning one-shot voices and a capped pool.
 */
import { chooseVoice, crushCurve, MAX_DISTANCE, type VoiceSlot } from './audioMath';

type AudioContextCtor = new () => AudioContext;

/** The browser's AudioContext constructor, or null (e.g. Node tests). */
export function getAudioContextCtor(): AudioContextCtor | null {
  const g = globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** Noise buffers and shaper curves generated once per context. */
export interface NoiseBank {
  readonly white: AudioBuffer;
  readonly brown: AudioBuffer;
  /** Seven-level amplitude staircase (odd, so silence stays 0) for retro grit. */
  readonly crush: Float32Array<ArrayBuffer>;
}

export function createNoiseBank(ctx: BaseAudioContext): NoiseBank {
  const rate = ctx.sampleRate;
  const white = ctx.createBuffer(1, Math.floor(rate * 2), rate);
  const w = white.getChannelData(0);
  for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;

  const brown = ctx.createBuffer(1, Math.floor(rate * 3), rate);
  const b = brown.getChannelData(0);
  let last = 0;
  for (let i = 0; i < b.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    b[i] = last * 3.5;
  }
  return { white, brown, crush: crushCurve(7) };
}

/** Value treated as silence for exponential ramps (which cannot reach 0). */
const SILENT = 0.0001;

/** Linear attack to `peak`, exponential decay to silence. Returns the end time. */
export function pluck(param: AudioParam, t: number, attack: number, peak: number, decay: number): number {
  const end = t + attack + decay;
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(Math.max(peak, SILENT * 2), t + attack);
  param.exponentialRampToValueAtTime(SILENT, end);
  param.setValueAtTime(0, end);
  return end;
}

/** Exponential glide between two positive values. */
export function glide(param: AudioParam, t: number, from: number, to: number, duration: number): void {
  param.setValueAtTime(Math.max(from, SILENT), t);
  param.exponentialRampToValueAtTime(Math.max(to, SILENT), t + duration);
}

/** Stepped (retro) value sequence, one value every `stepTime` seconds. */
export function stepped(param: AudioParam, t: number, values: readonly number[], stepTime: number): void {
  for (let i = 0; i < values.length; i++) param.setValueAtTime(values[i]!, t + i * stepTime);
}

/** Smoothly retargets a parameter (no clicks). */
export function smooth(param: AudioParam, value: number, now: number, timeConstant: number): void {
  param.setTargetAtTime(value, now, timeConstant);
}

/** A single fire-and-forget sound that disconnects its nodes when it ends. */
export class Voice implements VoiceSlot {
  readonly output: GainNode;
  readonly startTime: number;
  duration = 0;
  /** Stingers survive AudioManager.stopAll() and ring out. */
  persistent = false;
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private lastSource: AudioScheduledSourceNode | null = null;
  private lastStop = 0;
  private finished = false;

  constructor(
    readonly ctx: BaseAudioContext,
    readonly bank: NoiseBank,
    destination: AudioNode,
    readonly priority: number,
    private readonly onFinished: (voice: Voice) => void,
  ) {
    this.startTime = ctx.currentTime;
    this.output = this.track(ctx.createGain());
    this.output.connect(destination);
  }

  /** Registers a node for disconnection when the voice ends. */
  track<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  gain(value: number, dest: AudioNode = this.output): GainNode {
    const node = this.track(this.ctx.createGain());
    node.gain.value = value;
    node.connect(dest);
    return node;
  }

  filter(type: BiquadFilterType, frequency: number, q: number, dest: AudioNode = this.output): BiquadFilterNode {
    const node = this.track(this.ctx.createBiquadFilter());
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    node.connect(dest);
    return node;
  }

  shaper(curve: Float32Array<ArrayBuffer>, dest: AudioNode = this.output): WaveShaperNode {
    const node = this.track(this.ctx.createWaveShaper());
    node.curve = curve;
    node.connect(dest);
    return node;
  }

  osc(type: OscillatorType, frequency: number, start: number, stop: number, dest: AudioNode = this.output): OscillatorNode {
    const node = this.track(this.ctx.createOscillator());
    node.type = type;
    node.frequency.value = frequency;
    node.connect(dest);
    node.start(start);
    this.scheduleStop(node, stop);
    return node;
  }

  /** Looping noise from a random offset so repeats never sound identical. */
  noise(buffer: AudioBuffer, start: number, stop: number, dest: AudioNode = this.output, rate = 1): AudioBufferSourceNode {
    const node = this.track(this.ctx.createBufferSource());
    node.buffer = buffer;
    node.loop = true;
    node.playbackRate.value = rate;
    node.connect(dest);
    node.start(start, Math.random() * buffer.duration * 0.9);
    this.scheduleStop(node, stop);
    return node;
  }

  /** Call once the sound is built: fixes its duration and arms cleanup. */
  seal(): void {
    this.duration = Math.max(0, this.lastStop - this.startTime);
    if (this.lastSource) {
      this.lastSource.onended = () => {
        this.finish();
      };
    } else {
      this.finish();
    }
  }

  /** Fades out quickly and stops all sources (voice stealing / stop all). */
  kill(fade = 0.03): void {
    if (this.finished) return;
    const now = this.ctx.currentTime;
    this.output.gain.setTargetAtTime(0, now, fade / 3);
    for (const src of this.sources) {
      try {
        src.stop(now + fade);
      } catch {
        // Already stopped.
      }
    }
  }

  /** Disconnects every node immediately. */
  finish(): void {
    if (this.finished) return;
    this.finished = true;
    for (const node of this.nodes) node.disconnect();
    this.onFinished(this);
  }

  private scheduleStop(src: AudioScheduledSourceNode, stop: number): void {
    src.stop(stop);
    this.sources.push(src);
    if (!this.lastSource || stop >= this.lastStop) {
      this.lastSource = src;
      this.lastStop = stop;
    }
  }
}

/** Caps concurrent one-shots, stealing the quietest/oldest voice when full. */
export class VoicePool {
  private readonly active: Voice[] = [];

  constructor(private readonly maxVoices: number) {}

  get size(): number {
    return this.active.length;
  }

  /** Makes room for a new sound; false means it should be dropped. */
  admit(priority: number, now: number): boolean {
    const decision = chooseVoice(this.active, this.maxVoices, priority, now);
    if (decision.action === 'reject') return false;
    if (decision.action === 'steal') {
      const victim = this.active[decision.index];
      if (victim) {
        this.remove(victim);
        victim.kill();
      }
    }
    return true;
  }

  add(voice: Voice): void {
    this.active.push(voice);
  }

  remove(voice: Voice): void {
    const i = this.active.indexOf(voice);
    if (i >= 0) this.active.splice(i, 1);
  }

  /** Kills active voices; persistent stingers survive unless `everything`. */
  killAll(everything: boolean): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const voice = this.active[i]!;
      if (voice.persistent && !everything) continue;
      this.active.splice(i, 1);
      voice.kill();
    }
  }

  /** Disconnects everything immediately (context shutdown). */
  finishAll(): void {
    const voices = this.active.splice(0);
    for (const voice of voices) voice.finish();
  }
}

/** Legacy (pre-AudioParam) positional API still found in older Safari. */
interface LegacyPositional {
  setPosition(x: number, y: number, z: number): void;
  setOrientation(x: number, y: number, z: number, ux: number, uy: number, uz: number): void;
}

function hasPositionParams(node: { readonly positionX?: AudioParam }): boolean {
  return node.positionX !== undefined;
}

/** Inverse-distance panner, HRTF where available. */
export function createPanner(ctx: BaseAudioContext, refDistance: number, rolloff: number): PannerNode {
  const panner = ctx.createPanner();
  try {
    panner.panningModel = 'HRTF';
  } catch {
    panner.panningModel = 'equalpower';
  }
  panner.distanceModel = 'inverse';
  panner.refDistance = refDistance;
  panner.maxDistance = MAX_DISTANCE;
  panner.rolloffFactor = rolloff;
  return panner;
}

/** Moves a panner; timeConstant 0 jumps at `when`. */
export function setPannerPosition(
  panner: PannerNode,
  x: number,
  y: number,
  z: number,
  when: number,
  timeConstant: number,
): void {
  if (!hasPositionParams(panner)) {
    (panner as unknown as LegacyPositional).setPosition(x, y, z);
    return;
  }
  if (timeConstant > 0) {
    panner.positionX.setTargetAtTime(x, when, timeConstant);
    panner.positionY.setTargetAtTime(y, when, timeConstant);
    panner.positionZ.setTargetAtTime(z, when, timeConstant);
  } else {
    panner.positionX.setValueAtTime(x, when);
    panner.positionY.setValueAtTime(y, when);
    panner.positionZ.setValueAtTime(z, when);
  }
}

export interface ListenerPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly fx: number;
  readonly fy: number;
  readonly fz: number;
  readonly ux: number;
  readonly uy: number;
  readonly uz: number;
}

/** Smoothly moves the AudioListener (AudioParams with legacy fallback). */
export function setListenerPose(listener: AudioListener, pose: ListenerPose, now: number): void {
  if (!hasPositionParams(listener)) {
    const legacy = listener as unknown as LegacyPositional;
    legacy.setPosition(pose.x, pose.y, pose.z);
    legacy.setOrientation(pose.fx, pose.fy, pose.fz, pose.ux, pose.uy, pose.uz);
    return;
  }
  const tc = 0.015;
  listener.positionX.setTargetAtTime(pose.x, now, tc);
  listener.positionY.setTargetAtTime(pose.y, now, tc);
  listener.positionZ.setTargetAtTime(pose.z, now, tc);
  listener.forwardX.setTargetAtTime(pose.fx, now, tc);
  listener.forwardY.setTargetAtTime(pose.fy, now, tc);
  listener.forwardZ.setTargetAtTime(pose.fz, now, tc);
  listener.upX.setTargetAtTime(pose.ux, now, tc);
  listener.upY.setTargetAtTime(pose.uy, now, tc);
  listener.upZ.setTargetAtTime(pose.uz, now, tc);
}
