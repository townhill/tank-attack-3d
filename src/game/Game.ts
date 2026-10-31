/**
 * Top-level orchestrator: owns the simulation, renderer, input, audio and UI,
 * runs the fixed-timestep loop and manages menu / play / pause / game-over.
 */
import { Vector3 } from 'three';
import type { AudioEnemy, AudioFrame } from '../audio/AudioManager';
import { AudioManager } from '../audio/AudioManager';
import type { MapSize } from '../config/settings';
import { DIFFICULTY, PROJECTILE, SIM_DT, TANK_SPECS } from '../config/settings';
import type { UserSettings } from '../config/userSettings';
import { browserStorage, GRAPHICS_MODES, SettingsStore } from '../config/userSettings';
import type { Tank } from '../entities/Tank';
import { InputManager } from '../input/InputManager';
import { CameraManager } from '../rendering/CameraManager';
import { AimState, CameraState } from '../rendering/CameraState';
import { GRAPHICS_MODE_SPECS } from '../rendering/GraphicsModes';
import { QUALITY_PRESETS, Renderer } from '../rendering/Renderer';
import { WorldView } from '../rendering/WorldView';
import { HUD } from '../ui/HUD';
import type { GameOverSummary, UiSoundKind } from '../ui/Menu';
import { mapSizeLabel, Menu } from '../ui/Menu';
import { PerfOverlay } from '../ui/PerfOverlay';
import { Radar } from '../ui/Radar';
import { TacticalMap } from '../ui/TacticalMap';
import { Random } from '../utils/random';
import type { World } from '../world/World';
import { WorldLoader } from '../world/WorldLoader';
import { AimSolver } from './Aiming';
import type { GameEvent } from './events';
import { FixedStepAccumulator } from './GameLoop';
import { HudPresenter } from './HudPresenter';
import { PlayerController } from './PlayerController';
import { AutoQuality } from './AutoQuality';
import type { Placement } from './debugPlacement';
import { bridgeApproach, fordApproach } from './debugPlacement';
import { accuracy, BestScoreStore, formatTime } from './Scoring';
import { Simulation } from './Simulation';

export type AppState = 'menu' | 'playing' | 'paused' | 'gameover';

const RADAR_RANGE = 400;
const ATTRACT_SPIN = 0.07;
const MAP_PAN_SPEED = 260;
const VISIBILITY_RANGE = 900;
const MAX_FRAME_TIME = 0.1;
/** After the browser refuses pointer lock, clicks fire normally for this long before retrying. */
const LOCK_RETRY_MS = 3000;

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/** Battlefield seed from `?seed=1234` in the URL, if present and valid. */
function seedFromUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get('seed');
  if (raw === null || !/^\d{1,10}$/.test(raw)) return null;
  return Number(raw) >>> 0;
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly input: InputManager;
  private readonly audio = new AudioManager();
  private readonly hud: HUD;
  private readonly presenter: HudPresenter;
  private readonly radar: Radar;
  private readonly map: TacticalMap;
  private readonly menu: Menu;
  private readonly perf: PerfOverlay;
  private readonly settingsStore: SettingsStore;
  private readonly bestStore: BestScoreStore;
  private settings: UserSettings;
  private best: number;
  private sim: Simulation;
  private seed: number;
  /** Map size the current world was generated at (settings may since have changed). */
  private mapSize: MapSize;
  /** Whether the current world was generated with fords (settings may since have changed). */
  private worldFords: boolean;
  private readonly worldView: WorldView;
  private readonly cameraState = new CameraState('third');
  private readonly aim = new AimState();
  private readonly cameraManager: CameraManager;
  private readonly aimSolver = new AimSolver();
  private readonly controller = new PlayerController();
  private readonly accumulator = new FixedStepAccumulator(SIM_DT);
  private readonly rng = new Random(0x51ed);
  private state: AppState = 'menu';
  private mapOpen = false;
  private expectingUnlock = false;
  private lockFailedAt = Number.NEGATIVE_INFINITY;
  private lastTime = 0;
  private time = 0;
  private readonly autoQuality = new AutoQuality();
  private readonly worldLoader = new WorldLoader();
  /** Counts battlefield requests, so only the latest one starts a game when it arrives. */
  private worldRequest = 0;
  private width = 1;
  private height = 1;
  private readonly gunDirection = new Vector3();
  private readonly cameraForward = new Vector3();
  private readonly visibleEnemies = new Set<Tank>();
  private readonly sightPoint = new Vector3();
  private readonly enemyCentre = new Vector3();
  private readonly audioEnemies: AudioEnemy[] = [];
  private readonly audioFrame: AudioFrame;
  private rafId = 0;

  constructor(private readonly root: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    this.canvas.setAttribute('aria-label', 'Battlefield view');
    root.appendChild(this.canvas);

    const storage = browserStorage();
    this.settingsStore = new SettingsStore(storage);
    this.bestStore = new BestScoreStore(storage);
    this.settings = this.settingsStore.load();
    this.best = this.bestStore.load();

    this.renderer = new Renderer(this.canvas);
    this.input = new InputManager(this.canvas);
    this.seed = seedFromUrl() ?? randomSeed();
    this.mapSize = this.settings.mapSize;
    this.worldFords = this.settings.fords;
    this.sim = this.createAttractSimulation();
    this.worldView = new WorldView(this.renderer, this.sim.world, PROJECTILE.poolSize, this.rng);
    this.cameraManager = new CameraManager(this.renderer.camera, this.sim.world, this.rng);

    this.hud = new HUD(root);
    this.presenter = new HudPresenter(this.hud);
    this.radar = new Radar(root);
    this.radar.setRange(RADAR_RANGE);
    this.map = new TacticalMap(root, this.sim.world);
    this.perf = new PerfOverlay(root);
    this.menu = new Menu(root, this.settings, {
      onStart: () => { this.startNewGame(seedFromUrl() ?? randomSeed()); },
      onContinue: () => { this.resume(); },
      onRestart: () => { this.startNewGame(this.seed); },
      onMainMenu: () => { this.toMainMenu(); },
      onSettingsChange: (next) => { this.applySettings(next); },
      onUiSound: (kind) => { this.playUi(kind); },
    });
    this.menu.showMain(false, this.best);

    this.audioFrame = {
      listenerX: 0, listenerY: 0, listenerZ: 0, listenerForwardX: 0, listenerForwardY: 0, listenerForwardZ: -1,
      playerX: 0, playerY: 0, playerZ: 0, playerSpeed: 0, playerMaxSpeed: TANK_SPECS.player.maxSpeed, throttle: 0,
      turretYawRate: 0, playerHealthFraction: 1, playerAlive: true, playerWadeDepth: 0, enemies: this.audioEnemies,
    };

    this.bindEvents();
    this.applySettings(this.settings);
    this.aim.reset(this.sim.player.heading);
  }

  start(): void {
    this.resize();
    this.lastTime = performance.now();
    const loop = (now: number): void => {
      this.rafId = requestAnimationFrame(loop);
      try {
        this.frame(now);
      } catch (error) {
        console.error('Frame failed', error);
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- setup

  /** The menu's background battle, on `world` when given, else on the battlefield it generates. */
  private createAttractSimulation(world?: World): Simulation {
    const { seed, mapSize, worldFords: fords } = this;
    return new Simulation({ seed, difficulty: this.settings.difficulty, mapSize, fords, world, firstWaveDelay: Number.POSITIVE_INFINITY });
  }

  /** Drops any battlefield still being generated, so its arrival starts nothing. */
  private cancelWorldLoad(): void {
    this.worldRequest++;
    this.menu.setStatus(null);
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => { this.resize(); });
    document.addEventListener('fullscreenchange', () => { this.resize(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
    const unlockAudio = (): void => {
      this.audio.unlock();
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);

    this.input.onPointerLockChange = (locked) => {
      if (locked) return;
      if (this.expectingUnlock) {
        this.expectingUnlock = false;
        return;
      }
      // Escape released the pointer: treat it as a pause request.
      if (this.state === 'playing' && !this.mapOpen) this.pause();
    };
    this.input.onKeyPressed = (code, event) => { this.handleKey(code, event); };
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing' || this.mapOpen || this.input.pointerLocked) return;
      // Without pointer lock (refused or unsupported) the click simply fires.
      if (performance.now() - this.lockFailedAt < LOCK_RETRY_MS) return;
      if (e.button === 0) this.controller.suppressFire = true;
      void this.requestLock();
    });
  }

  /** Requests pointer lock, remembering refusals so play continues unlocked. */
  private async requestLock(): Promise<void> {
    const ok = await this.input.requestPointerLock();
    if (!ok) {
      this.lockFailedAt = performance.now();
      this.controller.suppressFire = false;
    }
  }

  private resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setSize(this.width, this.height);
    this.worldView.setViewport(this.height, this.width, this.renderer.camera.fov);
    this.hud.resize(this.width, this.height);
    this.radar.resize();
    this.map.resize();
  }

  private applySettings(next: UserSettings): void {
    const previous = this.settings;
    this.settings = next;
    this.settingsStore.save(next);
    const spec = GRAPHICS_MODE_SPECS[next.graphicsMode];
    const preset = QUALITY_PRESETS[next.quality];
    this.renderer.configure({ quality: next.quality, mode: spec, bloomMultiplier: next.bloomStrength, scanlines: next.scanlines, flicker: next.flicker });
    this.worldView.setShadowMapSize(preset.shadowMapSize);
    // A new quality level brings back reflections auto-quality turned off.
    if (previous.quality !== next.quality) this.worldView.setReflectionsAllowed(true);
    this.worldView.applyMode(spec, next, preset.shadows);
    this.hud.setTheme(spec.hudTheme);
    this.radar.setTheme(next.graphicsMode);
    this.radar.setOrientation(next.radarOrientation);
    this.map.setTheme(next.graphicsMode);
    this.map.setIntel(next.mapIntel, RADAR_RANGE);
    this.map.setRealtimeLabel(next.mapRealtime);
    this.audio.setVolumes(next.masterVolume, next.sfxVolume);
    this.audio.setMuted(next.muted);
    this.audio.setRetro(next.retroSound && next.graphicsMode === 'classic');
    this.perf.setVisible(next.showPerf);
    document.body.dataset.mode = next.graphicsMode;
    this.updateRadarVisibility();
    if (previous.graphicsMode !== next.graphicsMode || previous.quality !== next.quality) this.autoQuality.reset();
    this.menu.setSettings(next);
    this.resize();
  }

  private updateSettings(patch: Partial<UserSettings>): void {
    this.applySettings({ ...this.settings, ...patch });
  }

  private updateRadarVisibility(): void {
    const inGame = this.state === 'playing' || this.state === 'paused';
    this.radar.setVisible(this.settings.radarVisible && inGame && !this.mapOpen);
  }

  private playUi(kind: UiSoundKind): void {
    this.audio.unlock();
    this.audio.playUi(kind);
  }

  // ---------------------------------------------------------------- states

  /**
   * Starts a game on the battlefield for `seed` at the chosen map size, with
   * fords if they are turned on. The
   * current battlefield is reused when it matches; otherwise a new one is
   * generated off the main thread while the menu stays up, and the game
   * starts when it arrives unless another start was asked for meanwhile.
   */
  private startNewGame(seed: number): void {
    const mapSize = this.settings.mapSize;
    const fords = this.settings.fords;
    const request = ++this.worldRequest;
    if (seed === this.sim.world.seed && mapSize === this.mapSize && fords === this.worldFords) {
      this.menu.setStatus(null);
      this.beginGame(seed, mapSize, fords, this.sim.world);
      return;
    }
    this.menu.setStatus('GENERATING BATTLEFIELD…');
    this.worldLoader.load(seed, mapSize, fords).then(
      (world) => {
        if (request !== this.worldRequest) return;
        this.menu.setStatus(null);
        this.beginGame(seed, mapSize, fords, world);
      },
      (error: unknown) => {
        console.error('Battlefield generation failed', error);
        if (request === this.worldRequest) this.menu.setStatus('BATTLEFIELD GENERATION FAILED');
      },
    );
  }

  /** Starts play on `world`, the battlefield for `seed` at `mapSize`, with or without `fords`. */
  private beginGame(seed: number, mapSize: MapSize, fords: boolean, world: World): void {
    const sameWorld = world === this.sim.world;
    this.seed = seed;
    this.mapSize = mapSize;
    this.worldFords = fords;
    this.sim = new Simulation({ seed, difficulty: this.settings.difficulty, mapSize, world });
    if (!sameWorld) {
      this.worldView.setWorld(this.sim.world);
      this.worldView.applyMode(GRAPHICS_MODE_SPECS[this.settings.graphicsMode], this.settings, QUALITY_PRESETS[this.settings.quality].shadows);
      this.map.setWorld(this.sim.world);
      this.cameraManager.setWorld(this.sim.world);
    } else {
      this.worldView.clearTanks();
      this.worldView.effects.clear();
    }
    this.aim.reset(this.sim.player.heading);
    this.accumulator.reset();
    this.hud.reset();
    this.hud.toggleHelp(false);
    this.closeMap(false);
    this.state = 'playing';
    this.menu.hide();
    this.hud.setVisible(true);
    this.input.captureKeys = true;
    this.audio.stopAll();
    this.audio.setPaused(false);
    this.updateRadarVisibility();
    const banner = `${DIFFICULTY[this.settings.difficulty].label}  ·  ${mapSizeLabel(mapSize)}  ·  BATTLEFIELD ${seed}${fords ? '  ·  FORDS' : ''}`;
    this.hud.showBanner('ENGAGE', banner.toUpperCase(), 2.4);
    void this.requestLock();
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    if (this.mapOpen) this.closeMap(false);
    this.state = 'paused';
    this.input.releaseAll();
    this.controller.neutral();
    this.audio.setPaused(true);
    this.menu.showMain(true, Math.max(this.best, this.sim.stats.score));
    this.input.captureKeys = false;
    if (this.input.pointerLocked) {
      this.expectingUnlock = true;
      this.input.exitPointerLock();
    }
    this.updateRadarVisibility();
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.cancelWorldLoad();
    this.state = 'playing';
    this.menu.hide();
    this.accumulator.reset();
    this.input.captureKeys = true;
    this.audio.setPaused(false);
    this.updateRadarVisibility();
    void this.requestLock();
  }

  private gameOver(): void {
    this.state = 'gameover';
    const stats = this.sim.stats;
    const newRecord = this.bestStore.submit(stats.score);
    this.best = this.bestStore.load() || Math.max(this.best, stats.score);
    this.closeMap(false);
    this.input.captureKeys = false;
    if (this.input.pointerLocked) {
      this.expectingUnlock = true;
      this.input.exitPointerLock();
    }
    this.audio.stopAll();
    const summary: GameOverSummary = {
      score: stats.score,
      best: this.best,
      newRecord,
      wave: stats.wave,
      kills: stats.kills,
      killsByKind: stats.killsByKind,
      survivalTime: formatTime(stats.survivalTime),
      shotsFired: stats.shotsFired,
      hits: stats.hits,
      accuracy: accuracy(stats.shotsFired, stats.hits),
      difficulty: DIFFICULTY[this.sim.difficulty].label,
      mapSize: mapSizeLabel(this.mapSize),
      seed: this.seed,
    };
    this.menu.showGameOver(summary);
    this.updateRadarVisibility();
  }

  private toMainMenu(): void {
    this.cancelWorldLoad();
    this.state = 'menu';
    this.sim = this.createAttractSimulation(this.sim.world);
    this.worldView.clearTanks();
    this.worldView.effects.clear();
    this.hud.setVisible(false);
    this.closeMap(false);
    this.audio.stopAll();
    this.input.captureKeys = false;
    this.menu.showMain(false, this.best);
    this.updateRadarVisibility();
  }

  private toggleMap(): void {
    if (this.mapOpen) this.closeMap(true);
    else this.openMap();
  }

  private openMap(): void {
    if (this.state !== 'playing') return;
    this.mapOpen = true;
    this.controller.neutral();
    this.input.releaseAll();
    this.map.open(this.sim);
    if (!this.settings.mapRealtime) this.audio.setPaused(true);
    if (this.input.pointerLocked) {
      this.expectingUnlock = true;
      this.input.exitPointerLock();
    }
    this.updateRadarVisibility();
  }

  private closeMap(relock: boolean): void {
    if (!this.mapOpen) return;
    this.mapOpen = false;
    this.map.close();
    this.accumulator.reset();
    if (this.state === 'playing') this.audio.setPaused(false);
    this.updateRadarVisibility();
    if (relock && this.state === 'playing') void this.requestLock();
  }

  private cycleCamera(): void {
    const from = this.cameraState.mode;
    const to = this.cameraState.cycle();
    if (to === 'overhead') this.aim.syncGroundFromAim();
    else if (from === 'overhead') this.aim.syncAimFromGround();
  }

  private cycleGraphicsMode(): void {
    const i = GRAPHICS_MODES.indexOf(this.settings.graphicsMode);
    const mode = GRAPHICS_MODES[(i + 1) % GRAPHICS_MODES.length]!;
    this.updateSettings({ graphicsMode: mode });
    this.hud.toast(GRAPHICS_MODE_SPECS[mode].label.toUpperCase());
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    document.documentElement.requestFullscreen().catch((error: unknown) => {
      console.warn('Fullscreen unavailable', error);
    });
  }

  private handleKey(code: string, event: KeyboardEvent): void {
    if (code === 'Escape') {
      if (this.menu.visible) {
        if (!this.menu.back() && this.state === 'paused') this.resume();
      } else if (this.state === 'playing') {
        if (this.hud.toggleHelp(false)) return;
        if (this.mapOpen) this.closeMap(true);
        else this.pause();
      }
      return;
    }
    if (this.state === 'gameover' && code === 'Enter') {
      event.preventDefault();
      this.startNewGame(this.seed);
      return;
    }
    if (code === 'KeyF') {
      this.toggleFullscreen();
      return;
    }
    if (code === 'KeyC' && this.state !== 'menu') {
      this.cycleGraphicsMode();
      return;
    }
    if (code === 'Backquote' || code === 'KeyP') {
      this.updateSettings({ showPerf: !this.settings.showPerf });
      return;
    }
    if (this.state !== 'playing') return;
    switch (code) {
      case 'KeyM':
        this.toggleMap();
        break;
      case 'KeyV':
        if (!this.mapOpen) this.cycleCamera();
        break;
      case 'KeyR':
        this.updateSettings({ radarVisible: !this.settings.radarVisible });
        this.hud.toast(this.settings.radarVisible ? 'RADAR ON' : 'RADAR OFF');
        break;
      case 'KeyH':
        this.hud.toggleHelp();
        break;
      case 'Space':
        if (this.mapOpen) this.map.centerOnPlayer(this.sim);
        break;
      case 'Equal':
      case 'NumpadAdd':
        if (this.mapOpen) this.map.zoomBy(1.25);
        break;
      case 'Minus':
      case 'NumpadSubtract':
        if (this.mapOpen) this.map.zoomBy(0.8);
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- frame

  private frame(now: number): void {
    const dt = Math.min(MAX_FRAME_TIME, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.time += dt;
    const camera = this.renderer.camera;
    const pad = this.input.pollGamepad();
    if (pad.pausePressed) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }

    const playing = this.state === 'playing';
    if (playing) {
      if (pad.mapPressed) this.toggleMap();
      if (pad.cameraPressed && !this.mapOpen) this.cycleCamera();
      if (pad.radarPressed) this.updateSettings({ radarVisible: !this.settings.radarVisible });
    }

    // Player input.
    const controlling = playing && !this.mapOpen;
    if (controlling) {
      this.controller.update(dt, this.input, pad, this.cameraState, this.aim, this.settings, camera.fov);
      this.cameraState.adjustZoom(this.input.consumeWheel());
    } else {
      this.controller.neutral();
      this.cameraState.zoomHeld = false;
      this.input.consumeMouse(this.cameraForward);
      this.input.consumeWheel();
      if (this.mapOpen) this.panMapWithKeys(dt);
    }
    if (this.state === 'menu') this.aim.yaw += ATTRACT_SPIN * dt;

    // Simulation.
    const simRunning = (playing && (!this.mapOpen || this.settings.mapRealtime)) || this.state === 'menu';
    if (simRunning) {
      const steps = this.accumulator.advance(dt);
      for (let i = 0; i < steps; i++) {
        this.sim.step(SIM_DT, this.controller.command);
        this.processEvents(this.sim.events);
        this.sim.clearEvents();
        if (this.state !== 'playing' && this.state !== 'menu') break;
      }
    }
    const alpha = simRunning ? this.accumulator.alpha : 1;

    // Camera and aiming.
    const player = this.sim.player;
    const effects = this.worldView.effects;
    this.cameraState.update(dt);
    const trauma = this.settings.cameraShake ? effects.trauma : 0;
    this.cameraManager.update(dt, this.cameraState, this.aim, player, alpha, this.settings.fov, trauma);
    effects.trauma = this.cameraManager.decayTrauma(effects.trauma, dt);
    effects.setViewport(this.height, camera.fov);
    this.solveAim();

    // Presentation.
    this.worldView.sync(this.sim, alpha, dt, this.time, camera.position);
    if (this.state !== 'menu') {
      this.updateVisibleEnemies();
      const spec = GRAPHICS_MODE_SPECS[this.settings.graphicsMode];
      this.presenter.fill(this.sim, camera, this.cameraState.mode, spec, this.aimSolver, this.best, this.width, this.height, this.settings.targetMarkers, this.visibleEnemies);
      const lockRefused = performance.now() - this.lockFailedAt < LOCK_RETRY_MS;
      this.hud.frame.showPrompt = playing && !this.mapOpen && !this.input.pointerLocked && !lockRefused && 'pointerLockElement' in document;
      this.hud.render(dt);
      if (this.settings.radarVisible && !this.mapOpen) this.radar.render(dt, this.sim, this.radarUpHeading());
      if (this.mapOpen) this.map.render(dt, this.sim);
    }
    if (playing) this.updateAudio(dt);

    this.renderer.render(dt);
    this.perf.update(dt, this.renderer.stats, {
      tanks: this.sim.tanks.length,
      shells: this.sim.projectiles.activeCount(),
      particles: effects.particleCount,
      quality: this.settings.quality,
    });
    if (playing) this.checkPerformance(dt);
    this.input.endFrame();
  }

  private processEvents(events: readonly GameEvent[]): void {
    if (events.length === 0) return;
    const camera = this.renderer.camera;
    this.worldView.handleEvents(events, camera.position);
    if (this.state === 'menu') return;
    const spec = GRAPHICS_MODE_SPECS[this.settings.graphicsMode];
    const viewYaw = this.presenter.viewYaw(camera, this.cameraState.mode);
    for (const e of events) {
      this.audio.handleEvent(e, this.sim.player.id);
      this.presenter.handleEvent(e, this.sim, spec, viewYaw);
      if (e.type === 'gameOver') this.gameOver();
    }
  }

  private solveAim(): void {
    const sim = this.sim;
    const player = sim.player;
    if (this.cameraState.mode === 'overhead') {
      this.aimSolver.groundCursor(player.x + this.aim.groundOffsetX, player.z + this.aim.groundOffsetZ, sim.world, sim.tanks, player);
    } else {
      this.aimSolver.castRay(this.cameraManager.aimOrigin, this.cameraManager.aimDirection, sim.world, sim.tanks, player);
    }
    this.aimSolver.gunDirection(player, this.cameraManager.aimDirection, this.gunDirection);
    const cmd = this.controller.command;
    cmd.aimX = this.gunDirection.x;
    cmd.aimY = this.gunDirection.y;
    cmd.aimZ = this.gunDirection.z;
    this.aimSolver.predictImpact(player, sim.world, sim.tanks);
  }

  /** Enemies with a clear line of sight from the camera (no wall-hacks in the 3D view). */
  private updateVisibleEnemies(): void {
    this.visibleEnemies.clear();
    const cam = this.renderer.camera.position;
    this.sightPoint.copy(cam);
    for (const e of this.sim.enemies) {
      const t = e.tank;
      if (!t.alive) continue;
      if (Math.hypot(t.x - cam.x, t.z - cam.z) > VISIBILITY_RANGE) continue;
      t.getCentre(this.enemyCentre);
      if (this.sim.world.hasLineOfSight(cam.x, cam.y, cam.z, this.enemyCentre.x, this.enemyCentre.y + 0.5, this.enemyCentre.z)) this.visibleEnemies.add(t);
    }
  }

  private radarUpHeading(): number {
    if (this.cameraState.mode === 'overhead') return this.aim.yaw;
    return this.presenter.viewYaw(this.renderer.camera, this.cameraState.mode);
  }

  private panMapWithKeys(dt: number): void {
    const step = MAP_PAN_SPEED * dt;
    let dx = 0;
    let dz = 0;
    if (this.input.isDown('ArrowLeft') || this.input.isDown('KeyA')) dx -= step;
    if (this.input.isDown('ArrowRight') || this.input.isDown('KeyD')) dx += step;
    if (this.input.isDown('ArrowUp') || this.input.isDown('KeyW')) dz -= step;
    if (this.input.isDown('ArrowDown') || this.input.isDown('KeyS')) dz += step;
    if (dx !== 0 || dz !== 0) this.map.panBy(dx, dz);
  }

  private updateAudio(dt: number): void {
    const camera = this.renderer.camera;
    const p = this.sim.player;
    const f = this.audioFrame;
    camera.getWorldDirection(this.cameraForward);
    f.listenerX = camera.position.x;
    f.listenerY = camera.position.y;
    f.listenerZ = camera.position.z;
    f.listenerForwardX = this.cameraForward.x;
    f.listenerForwardY = this.cameraForward.y;
    f.listenerForwardZ = this.cameraForward.z;
    f.playerX = p.x;
    f.playerY = p.y;
    f.playerZ = p.z;
    f.playerSpeed = p.speed;
    f.throttle = p.controls.throttle;
    f.turretYawRate = p.turretYawRate;
    f.playerHealthFraction = p.healthFraction;
    f.playerAlive = p.alive;
    f.playerWadeDepth = p.bridgeId < 0 ? this.sim.world.water.depthAt(p.x, p.z) : 0;
    this.audioEnemies.length = 0;
    for (const e of this.sim.enemies) {
      if (!e.tank.alive) continue;
      this.audioEnemies.push({ id: e.tank.id, kind: e.kind, x: e.tank.x, y: e.tank.y, z: e.tank.z, speed: e.tank.speed });
    }
    this.audio.update(dt, f);
  }

  /** Steps the graphics down when the frame rate stays low (if enabled): lake reflections first, then the quality preset. */
  private checkPerformance(dt: number): void {
    if (!this.settings.autoQuality) return;
    // Turning reflections off only helps while a lake is actually being mirrored.
    const step = this.autoQuality.update(dt, this.perf.fps, this.settings.quality, this.worldView.reflectedLake >= 0);
    if (!step) return;
    if (step.kind === 'reflections') {
      this.worldView.setReflectionsAllowed(false);
      this.hud.toast('LOW FRAME RATE: LAKE REFLECTIONS OFF');
      return;
    }
    this.updateSettings({ quality: step.level });
    this.hud.toast(`LOW FRAME RATE: QUALITY SET TO ${step.level.toUpperCase()}`);
  }

  // ---------------------------------------------------------------- debug

  /** Read-only snapshot used by automated smoke tests in development builds. */
  debugSnapshot(): Record<string, unknown> {
    const p = this.sim.player;
    return {
      state: this.state,
      mapOpen: this.mapOpen,
      camera: this.cameraState.mode,
      graphicsMode: this.settings.graphicsMode,
      quality: this.settings.quality,
      seed: this.seed,
      mapSize: this.mapSize,
      playableHalfSize: this.sim.world.playableHalfSize,
      player: { x: p.x, z: p.z, heading: p.heading, speed: p.speed, health: p.health, turretYaw: p.turretYaw, gunPitch: p.gunPitch, alive: p.alive },
      enemies: this.sim.enemies.map((e) => ({ id: e.tank.id, kind: e.kind, x: e.tank.x, z: e.tank.z, alive: e.tank.alive, state: e.controller.state })),
      stats: { ...this.sim.stats },
      wave: this.sim.waves.wave,
      shells: this.sim.projectiles.activeCount(),
      tankViews: this.worldView.tankViewCount,
      fps: this.perf.fps,
      render: this.renderer.stats,
      water: {
        rivers: this.sim.world.rivers.length,
        lakes: this.sim.world.lakes.length,
        bridges: this.sim.world.bridges.length,
        fords: this.sim.world.fords.length,
        playerBridge: p.bridgeId,
        playerDepth: this.sim.world.water.depthAt(p.x, p.z),
        reflecting: this.worldView.reflectingLakes,
        reflectedLake: this.worldView.reflectedLake,
      },
    };
  }

  /** Development helper: drive the game from automated tests. */
  debugCommand(command: 'start' | 'pause' | 'resume' | 'camera' | 'map' | 'mode' | 'kill-player' | 'spawn' | 'bridge' | 'ford'): void {
    switch (command) {
      case 'start':
        this.startNewGame(this.seed);
        break;
      case 'pause':
        this.pause();
        break;
      case 'resume':
        this.resume();
        break;
      case 'camera':
        this.cycleCamera();
        break;
      case 'map':
        this.toggleMap();
        break;
      case 'mode':
        this.cycleGraphicsMode();
        break;
      case 'kill-player':
        this.sim.player.health = 1;
        break;
      case 'spawn':
        this.sim.spawnEnemy('standard');
        break;
      case 'bridge':
        this.placePlayer(bridgeApproach(this.sim.world, this.sim.player.x, this.sim.player.z));
        break;
      case 'ford':
        this.placePlayer(fordApproach(this.sim.world, this.sim.player.x, this.sim.player.z));
        break;
    }
  }

  /** Development helper: puts the player at `spot`, if there is one. */
  private placePlayer(spot: Placement | null): void {
    if (spot) this.sim.player.placeAt(spot.x, spot.z, spot.heading, this.sim.world);
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.worldLoader.dispose();
    this.input.dispose();
    this.audio.dispose();
    this.radar.dispose();
    this.map.dispose();
    this.worldView.dispose();
    this.renderer.dispose();
    this.root.replaceChildren();
  }
}
