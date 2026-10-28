/**
 * Continuous sounds: the player's engine, track clatter and turret servo, and
 * a fixed pool of positional engine loops that follow the nearest enemies.
 * AudioManager builds these lazily in update() and tears them down in stopAll().
 */
import { TANK_SPECS } from '../config/settings';
import {
  ENEMY_ENGINE_RANGE,
  ENEMY_ENGINE_VOICES,
  enemyEngineParams,
  engineParams,
  selectNearestEnemies,
  servoParams,
  trackParams,
} from './audioMath';
import { createPanner, setPannerPosition, smooth, type NoiseBank } from './synth';
import type { AudioEnemy, AudioFrame } from './types';

const ENGINE_LEVEL = 0.5;
const RUMBLE_LEVEL = 0.35;
const TRACK_LEVEL = 0.5;
const SERVO_LEVEL = 0.6;
const ENEMY_LEVEL = 1;
const ENEMY_REF_DISTANCE = 15;
/** Engine sound source height above an enemy's origin (m). */
const ENEMY_ENGINE_HEIGHT = 1.5;
/** Fade before a reassigned enemy voice jumps to its new tank (s). */
const ENEMY_SWAP_DELAY = 0.08;
const TEARDOWN_FADE = 0.12;
const PLAYER_TRAVERSE = TANK_SPECS.player.turretTraverse;

/** Continuously running nodes that are faded, stopped and disconnected together. */
class LoopGraph {
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];

  constructor(readonly ctx: BaseAudioContext) {}

  node<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  gain(value: number, dest: AudioNode): GainNode {
    const node = this.node(this.ctx.createGain());
    node.gain.value = value;
    node.connect(dest);
    return node;
  }

  /** Gain feeding an AudioParam (LFO depth). */
  modulate(depth: number, param: AudioParam): GainNode {
    const node = this.node(this.ctx.createGain());
    node.gain.value = depth;
    node.connect(param);
    return node;
  }

  filter(type: BiquadFilterType, frequency: number, q: number, dest: AudioNode): BiquadFilterNode {
    const node = this.node(this.ctx.createBiquadFilter());
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    node.connect(dest);
    return node;
  }

  osc(type: OscillatorType, frequency: number, dest: AudioNode): OscillatorNode {
    const node = this.node(this.ctx.createOscillator());
    node.type = type;
    node.frequency.value = frequency;
    node.connect(dest);
    this.start(node);
    return node;
  }

  noise(buffer: AudioBuffer, dest: AudioNode): AudioBufferSourceNode {
    const node = this.node(this.ctx.createBufferSource());
    node.buffer = buffer;
    node.loop = true;
    node.connect(dest);
    this.start(node);
    return node;
  }

  /** Fades `output`, stops every source and disconnects once stopped. */
  teardown(output: GainNode): void {
    const now = this.ctx.currentTime;
    output.gain.setTargetAtTime(0, now, TEARDOWN_FADE / 4);
    const stopAt = now + TEARDOWN_FADE;
    for (const src of this.sources) src.stop(stopAt);
    const first = this.sources[0];
    if (first) {
      first.onended = () => {
        this.disconnectAll();
      };
    } else {
      this.disconnectAll();
    }
  }

  private start(src: AudioScheduledSourceNode): void {
    src.start();
    this.sources.push(src);
  }

  private disconnectAll(): void {
    for (const node of this.nodes) node.disconnect();
    this.nodes.length = 0;
  }
}

/** The player's engine, tracks and turret servo. */
export class PlayerLoops {
  private readonly graph: LoopGraph;
  private readonly output: GainNode;
  private readonly engineGain: GainNode;
  private readonly engineFilter: BiquadFilterNode;
  private readonly engineOsc: OscillatorNode;
  private readonly engineSub: OscillatorNode;
  private readonly chugLfo: OscillatorNode;
  private readonly rumbleGain: GainNode;
  private readonly trackGain: GainNode;
  private readonly trackFilter: BiquadFilterNode;
  private readonly clatterLfo: OscillatorNode;
  private readonly servoGain: GainNode;
  private readonly servoOsc: OscillatorNode;
  private readonly engine = engineParams(0, 0);
  private readonly track = trackParams(0, 1);
  private readonly servo = servoParams(0);

  constructor(ctx: BaseAudioContext, bank: NoiseBank, dest: AudioNode, retro: boolean) {
    const g = new LoopGraph(ctx);
    this.graph = g;
    this.output = g.gain(1, dest);

    // Engine: sawtooth + sub-octave through a low-pass, pulsed by a "chug" LFO.
    this.engineGain = g.gain(0, this.output);
    const chugAm = g.gain(0.7, this.engineGain);
    this.engineFilter = g.filter('lowpass', 200, 1.2, chugAm);
    this.engineOsc = g.osc('sawtooth', 34, this.engineFilter);
    this.engineSub = g.osc('triangle', 17, g.gain(0.6, this.engineFilter));
    this.chugLfo = g.osc('sine', 7, g.modulate(0.3, chugAm.gain));

    // Hull rumble.
    this.rumbleGain = g.gain(0, this.output);
    g.noise(bank.brown, g.filter('lowpass', 150, 0.7, this.rumbleGain));

    // Tracks: band-passed noise chopped by a square "link" LFO.
    this.trackGain = g.gain(0, this.output);
    const clatterAm = g.gain(0.55, this.trackGain);
    this.trackFilter = g.filter('bandpass', 600, 0.9, clatterAm);
    g.noise(bank.white, this.trackFilter);
    this.clatterLfo = g.osc('square', 4, g.modulate(0.45, clatterAm.gain));

    // Turret servo whine with a little motor vibrato.
    this.servoGain = g.gain(0, this.output);
    this.servoOsc = g.osc('sawtooth', 380, g.filter('bandpass', 1400, 3, this.servoGain));
    g.osc('sine', 27, g.modulate(8, this.servoOsc.frequency));

    this.setRetro(retro);
  }

  update(frame: AudioFrame, now: number): void {
    const maxSpeed = frame.playerMaxSpeed > 0 ? frame.playerMaxSpeed : 1;
    const speedFraction = Math.min(1, Math.abs(frame.playerSpeed) / maxSpeed);
    const e = engineParams(speedFraction, frame.throttle, this.engine);
    const tr = trackParams(frame.playerSpeed, maxSpeed, this.track);
    const sv = servoParams(frame.turretYawRate, PLAYER_TRAVERSE, this.servo);
    const on = frame.playerAlive ? 1 : 0;

    smooth(this.engineOsc.frequency, e.frequency, now, 0.12);
    smooth(this.engineSub.frequency, e.frequency * 0.5, now, 0.12);
    smooth(this.engineFilter.frequency, e.filterHz, now, 0.1);
    smooth(this.chugLfo.frequency, e.chugRate, now, 0.15);
    smooth(this.engineGain.gain, e.gain * ENGINE_LEVEL * on, now, frame.playerAlive ? 0.1 : 0.3);
    smooth(this.rumbleGain.gain, (0.3 + 0.7 * speedFraction) * RUMBLE_LEVEL * on, now, 0.15);
    smooth(this.trackFilter.frequency, tr.filterHz, now, 0.1);
    smooth(this.clatterLfo.frequency, tr.clatterRate, now, 0.1);
    smooth(this.trackGain.gain, tr.gain * TRACK_LEVEL * on, now, 0.08);
    smooth(this.servoOsc.frequency, sv.frequency, now, 0.05);
    smooth(this.servoGain.gain, sv.gain * SERVO_LEVEL * on, now, 0.04);
  }

  setRetro(retro: boolean): void {
    this.engineOsc.type = retro ? 'square' : 'sawtooth';
    this.servoOsc.type = retro ? 'square' : 'sawtooth';
  }

  dispose(): void {
    this.graph.teardown(this.output);
  }
}

interface EnemyVoice {
  /** Enemy id being followed, -1 when free. */
  id: number;
  /** Context time before which the voice is still fading from a previous tank. */
  readyAt: number;
  readonly osc: OscillatorNode;
  readonly filter: BiquadFilterNode;
  readonly gain: GainNode;
  readonly panner: PannerNode;
}

/** Quiet positional engine drones for the nearest enemies (fixed voice pool). */
export class EnemyEngines {
  private readonly graph: LoopGraph;
  private readonly output: GainNode;
  private readonly voices: EnemyVoice[] = [];
  private readonly nearest: number[] = [];
  private readonly params = enemyEngineParams('standard', 0);

  constructor(ctx: BaseAudioContext, dest: AudioNode, retro: boolean) {
    this.graph = new LoopGraph(ctx);
    this.output = this.graph.gain(1, dest);
    for (let i = 0; i < ENEMY_ENGINE_VOICES; i++) {
      this.nearest.push(-1);
      this.voices.push(this.createVoice());
    }
    this.setRetro(retro);
  }

  update(frame: AudioFrame, now: number): void {
    const count = selectNearestEnemies(frame.enemies, frame.playerX, frame.playerZ, ENEMY_ENGINE_RANGE, this.nearest);
    for (const voice of this.voices) {
      if (voice.id >= 0 && !this.isSelected(voice.id, frame.enemies, count)) {
        voice.id = -1;
        smooth(voice.gain.gain, 0, now, 0.15);
      }
    }
    for (let i = 0; i < count; i++) {
      const enemy = frame.enemies[this.nearest[i]!];
      if (enemy) this.follow(enemy, now);
    }
  }

  setRetro(retro: boolean): void {
    for (const voice of this.voices) voice.osc.type = retro ? 'square' : 'sawtooth';
  }

  dispose(): void {
    this.graph.teardown(this.output);
  }

  private createVoice(): EnemyVoice {
    const g = this.graph;
    const panner = g.node(createPanner(g.ctx, ENEMY_REF_DISTANCE, 1));
    panner.connect(this.output);
    const gain = g.gain(0, panner);
    const am = g.gain(0.75, gain);
    const filter = g.filter('lowpass', 300, 1, am);
    const osc = g.osc('sawtooth', 34, filter);
    g.osc('sine', 6 + Math.random() * 4, g.modulate(0.25, am.gain));
    return { id: -1, readyAt: 0, osc, filter, gain, panner };
  }

  private isSelected(id: number, enemies: readonly AudioEnemy[], count: number): boolean {
    for (let i = 0; i < count; i++) {
      if (enemies[this.nearest[i]!]?.id === id) return true;
    }
    return false;
  }

  private voiceFor(id: number): EnemyVoice | null {
    for (const voice of this.voices) if (voice.id === id) return voice;
    return null;
  }

  private follow(enemy: AudioEnemy, now: number): void {
    let voice = this.voiceFor(enemy.id);
    const fresh = voice === null;
    if (!voice) {
      voice = this.voiceFor(-1);
      if (!voice) return;
      voice.id = enemy.id;
      voice.readyAt = now + ENEMY_SWAP_DELAY;
      smooth(voice.gain.gain, 0, now, ENEMY_SWAP_DELAY / 4);
    }
    const when = Math.max(now, voice.readyAt);
    const p = enemyEngineParams(enemy.kind, enemy.speed, this.params);
    setPannerPosition(voice.panner, enemy.x, enemy.y + ENEMY_ENGINE_HEIGHT, enemy.z, when, fresh ? 0 : 0.05);
    if (fresh) {
      voice.osc.frequency.setValueAtTime(p.frequency, when);
      voice.filter.frequency.setValueAtTime(p.filterHz, when);
    } else {
      smooth(voice.osc.frequency, p.frequency, when, 0.2);
      smooth(voice.filter.frequency, p.filterHz, when, 0.2);
    }
    smooth(voice.gain.gain, p.gain * ENEMY_LEVEL, when, 0.25);
  }
}
