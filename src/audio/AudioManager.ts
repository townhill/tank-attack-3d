/**
 * Procedural Web Audio for VECTOR TANKS. Every sound is synthesised at run
 * time (oscillators, generated noise, envelopes); there are no audio files.
 *
 * Safe to construct anywhere: nothing touches Web Audio until unlock() is
 * called from a user gesture, and every method is a no-op without a context
 * (e.g. in Node tests). Runtime errors are caught and reported once.
 */
import type { GameEvent } from '../game/events';
import { clamp } from '../utils/math';
import { CRITICAL_HEALTH, warningInterval } from './audioMath';
import { playEventSound } from './eventSounds';
import { EnemyEngines, PlayerLoops } from './loops';
import { Mixer } from './mixer';
import { uiBlip, warningBeep, type UiSound } from './sfxCues';
import { getAudioContextCtor } from './synth';
import type { AudioFrame } from './types';

export type { AudioEnemy, AudioFrame } from './types';
export type { UiSound } from './sfxCues';

const PAUSE_FADE = 0.08;
/** Longest frame step honoured by the beep timer (s). */
const MAX_DT = 0.25;

export class AudioManager {
  private mixer: Mixer | null = null;
  private playerLoops: PlayerLoops | null = null;
  private enemyEngines: EnemyEngines | null = null;
  private masterVolume = 0.8;
  private sfxVolume = 1;
  private muted = false;
  private retro = false;
  private paused = false;
  private disposed = false;
  private warned = false;
  private beepTimer = 0;

  /** True once the AudioContext exists and is running. */
  get unlocked(): boolean {
    return this.mixer !== null && this.mixer.ctx.state === 'running';
  }

  /** Create/resume the AudioContext. Called from a user gesture (click/keydown); safe to call repeatedly. */
  unlock(): void {
    if (this.disposed) return;
    try {
      if (!this.mixer) {
        const Ctor = getAudioContextCtor();
        if (!Ctor) return;
        this.mixer = new Mixer(new Ctor());
        this.mixer.setLevels(this.masterVolume, this.sfxVolume, this.muted);
        this.mixer.setLoopLevel(this.paused ? 0 : 1, 0);
      }
      const ctx = this.mixer.ctx;
      if (ctx.state !== 'running' && ctx.state !== 'closed') {
        void ctx.resume().catch((err: unknown) => {
          this.warnOnce(err);
        });
        this.mixer.primeOutput();
      }
    } catch (err) {
      this.warnOnce(err);
    }
  }

  /** Master and effects volume, each 0..1. */
  setVolumes(master: number, sfx: number): void {
    this.masterVolume = clamp(Number.isFinite(master) ? master : 0, 0, 1);
    this.sfxVolume = clamp(Number.isFinite(sfx) ? sfx : 0, 0, 1);
    this.applyLevels();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyLevels();
  }

  /** Retro arcade variants (used in Classic Vector mode). */
  setRetro(retro: boolean): void {
    this.retro = retro;
    try {
      this.playerLoops?.setRetro(retro);
      this.enemyEngines?.setRetro(retro);
    } catch (err) {
      this.warnOnce(err);
    }
  }

  /** Continuous sounds; call once per rendered frame while in a game. */
  update(dt: number, frame: AudioFrame): void {
    const mixer = this.mixer;
    if (!mixer) return;
    try {
      const now = mixer.now;
      mixer.setListener(frame, now);
      if (!this.playerLoops || !this.enemyEngines) this.buildLoops(mixer);
      this.playerLoops?.update(frame, now);
      this.enemyEngines?.update(frame, now);
      this.updateWarning(mixer, dt, frame);
    } catch (err) {
      this.warnOnce(err);
    }
  }

  /** One-shot sounds for simulation events. playerTankId is the player's tank id (0). */
  handleEvent(event: GameEvent, playerTankId: number): void {
    const mixer = this.mixer;
    if (!mixer) return;
    try {
      playEventSound(mixer, event, playerTankId, this.retro);
    } catch (err) {
      this.warnOnce(err);
    }
  }

  playUi(kind: UiSound): void {
    const mixer = this.mixer;
    if (!mixer) return;
    try {
      const retro = this.retro;
      mixer.playDirect(
        0.4,
        (v, t) => {
          uiBlip(v, t, retro, kind, 1);
        },
        true,
      );
    } catch (err) {
      this.warnOnce(err);
    }
  }

  /** Fade continuous loops out while paused / in menus / map open; resume on false. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) this.beepTimer = 0;
    try {
      this.mixer?.setLoopLevel(paused ? 0 : 1, PAUSE_FADE);
    } catch (err) {
      this.warnOnce(err);
    }
  }

  /** Stop everything (e.g. returning to main menu or game over). Loops rebuild on the next update(). */
  stopAll(): void {
    this.beepTimer = 0;
    this.paused = false;
    try {
      this.teardownLoops();
      this.mixer?.killVoices(false);
    } catch (err) {
      this.warnOnce(err);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.teardownLoops();
      this.mixer?.close();
    } catch (err) {
      this.warnOnce(err);
    }
    this.mixer = null;
  }

  private updateWarning(mixer: Mixer, dt: number, frame: AudioFrame): void {
    const interval = warningInterval(frame.playerHealthFraction, frame.playerAlive);
    if (interval <= 0 || this.paused) {
      this.beepTimer = 0;
      return;
    }
    this.beepTimer -= clamp(Number.isFinite(dt) ? dt : 0, 0, MAX_DT);
    if (this.beepTimer > 0) return;
    this.beepTimer = interval;
    const critical = frame.playerHealthFraction < CRITICAL_HEALTH;
    const retro = this.retro;
    mixer.playDirect(0.35, (v, t) => {
      warningBeep(v, t, retro, critical, 1);
    });
  }

  private buildLoops(mixer: Mixer): void {
    this.teardownLoops();
    // New loops start silent, so the loop bus can jump back to its level.
    mixer.setLoopLevel(this.paused ? 0 : 1, 0);
    this.playerLoops = new PlayerLoops(mixer.ctx, mixer.bank, mixer.loopBus, this.retro);
    this.enemyEngines = new EnemyEngines(mixer.ctx, mixer.loopBus, this.retro);
  }

  private teardownLoops(): void {
    this.playerLoops?.dispose();
    this.enemyEngines?.dispose();
    this.playerLoops = null;
    this.enemyEngines = null;
  }

  private applyLevels(): void {
    try {
      this.mixer?.setLevels(this.masterVolume, this.sfxVolume, this.muted);
    } catch (err) {
      this.warnOnce(err);
    }
  }

  private warnOnce(err: unknown): void {
    if (this.warned) return;
    this.warned = true;
    console.warn('[audio] Web Audio error; further audio errors are suppressed.', err);
  }
}
