/**
 * Owns the 3D scene for one battlefield: lighting, environment, terrain,
 * obstacles, backdrop, tank and shell views and effects. Synchronises views
 * from simulation state each frame without touching game rules.
 */
import type { Texture } from 'three';
import { BackSide, Color, DirectionalLight, FogExp2, HemisphereLight, Mesh, PMREMGenerator, Scene, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { TankKind } from '../config/settings';
import type { QualityLevel, UserSettings } from '../config/userSettings';
import type { GameEvent } from '../game/events';
import type { Simulation } from '../game/Simulation';
import type { Random } from '../utils/random';
import type { World } from '../world/World';
import { BridgeView } from './BridgeView';
import { Effects } from './Effects';
import type { GraphicsModeSpec } from './GraphicsModes';
import { MaterialLibrary } from './Materials';
import { ObstacleView } from './ObstacleView';
import { ProjectileView } from './ProjectileView';
import type { Renderer } from './Renderer';
import { Sky } from './Sky';
import { TankView } from './TankView';
import { TerrainView } from './TerrainView';
import { WaterView } from './WaterView';

const SUN_OFFSET = new Vector3(-140, 220, 90);
const SHADOW_EXTENT = 75;
const DUST_SPEED = 3;
/** Wading tanks slower than this leave no wake (m/s). */
const WAKE_SPEED = 1;
const SMOKE_HEALTH = 0.35;

function createEnvironmentScene(spec: GraphicsModeSpec): { scene: Scene; dispose(): void } {
  const scene = new Scene();
  const geo = new SphereGeometry(50, 32, 16);
  const material = new ShaderMaterial({
    uniforms: {
      uZenith: { value: new Color(spec.skyZenith) },
      uHorizon: { value: new Color(spec.skyHorizon) },
      uGlow: { value: new Color(spec.horizonGlow) },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader:
      'uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGlow; varying vec3 vDir;' +
      'void main(){ float h = vDir.y; vec3 c = mix(uHorizon, uZenith, pow(clamp(h,0.0,1.0),0.5));' +
      ' c += uGlow * exp(-abs(h) * 10.0) * 2.5; c += vec3(0.35,0.45,0.7) * smoothstep(0.96, 1.0, dot(vDir, normalize(vec3(-0.5,0.7,0.4))));' +
      ' gl_FragColor = vec4(c * 1.6, 1.0); }',
    side: BackSide,
  });
  scene.add(new Mesh(geo, material));
  return {
    scene,
    dispose: (): void => {
      geo.dispose();
      material.dispose();
    },
  };
}

export class WorldView {
  readonly materials = new MaterialLibrary();
  readonly effects: Effects;
  private readonly scene: Scene;
  private terrain: TerrainView;
  private water: WaterView;
  private bridges: BridgeView;
  private obstacles: ObstacleView;
  private sky: Sky;
  private world: World;
  private readonly projectiles: ProjectileView;
  private readonly tankViews = new Map<number, TankView>();
  private readonly tankKinds = new Map<number, TankKind>();
  private readonly hemi: HemisphereLight;
  private readonly sun: DirectionalLight;
  private readonly fog: FogExp2;
  private envTexture: Texture | null = null;
  private spec: GraphicsModeSpec | null = null;
  private shadowsAllowed = true;
  private quality: QualityLevel = 'high';
  private readonly seen = new Set<number>();

  constructor(
    private readonly renderer: Renderer,
    world: World,
    projectileCapacity: number,
    private readonly rng: Random,
  ) {
    this.scene = renderer.scene;
    this.fog = new FogExp2(0x000000, 0.0015);
    this.scene.fog = this.fog;
    this.hemi = new HemisphereLight(0x223355, 0x050505, 0.6);
    this.sun = new DirectionalLight(0xffffff, 1);
    this.sun.shadow.camera.left = -SHADOW_EXTENT;
    this.sun.shadow.camera.right = SHADOW_EXTENT;
    this.sun.shadow.camera.top = SHADOW_EXTENT;
    this.sun.shadow.camera.bottom = -SHADOW_EXTENT;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 600;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.world = world;
    this.terrain = new TerrainView(world, this.materials);
    this.water = new WaterView(world, this.materials);
    this.bridges = new BridgeView(world, this.materials);
    this.obstacles = new ObstacleView(world, this.materials);
    this.sky = new Sky(world.seed, this.materials);
    this.scene.add(this.terrain.group, this.water.group, this.bridges.group, this.obstacles.group, this.sky.group);
    this.projectiles = new ProjectileView(this.scene, projectileCapacity, this.materials);
    this.effects = new Effects(this.scene, this.materials, rng);
  }

  /** Rebuilds static scenery for a new battlefield and drops all tank views. */
  setWorld(world: World): void {
    this.terrain.dispose();
    this.water.dispose();
    this.bridges.dispose();
    this.obstacles.dispose();
    this.sky.dispose();
    this.world = world;
    this.terrain = new TerrainView(world, this.materials);
    this.water = new WaterView(world, this.materials);
    this.bridges = new BridgeView(world, this.materials);
    this.obstacles = new ObstacleView(world, this.materials);
    this.sky = new Sky(world.seed, this.materials);
    this.scene.add(this.terrain.group, this.water.group, this.bridges.group, this.obstacles.group, this.sky.group);
    this.clearTanks();
    this.effects.clear();
    if (this.spec) this.applyModeToScenery(this.spec);
  }

  clearTanks(): void {
    for (const v of this.tankViews.values()) v.dispose();
    this.tankViews.clear();
    this.tankKinds.clear();
  }

  applyMode(spec: GraphicsModeSpec, settings: UserSettings, shadowsAllowed: boolean): void {
    const envChanged = this.spec?.id !== spec.id;
    this.spec = spec;
    this.shadowsAllowed = shadowsAllowed;
    this.quality = settings.quality;
    this.materials.applyMode(spec, { seeThrough: settings.seeThroughWireframe });
    this.applyModeToScenery(spec);
    this.terrain.applyMode(spec, settings.groundGrid);
    for (const v of this.tankViews.values()) v.applyMode(spec);
    this.projectiles.applyMode(spec);
    this.effects.applyMode(spec);

    this.fog.color.setHex(spec.fogColor);
    this.fog.density = spec.fogDensity;
    this.scene.background = new Color(spec.fogColor);
    this.hemi.color.setHex(spec.hemiSky);
    this.hemi.groundColor.setHex(spec.hemiGround);
    this.hemi.intensity = spec.hemiIntensity;
    this.sun.color.setHex(spec.sunColor);
    this.sun.intensity = spec.sunIntensity;
    this.sun.castShadow = spec.shadows && shadowsAllowed;
    if (envChanged) this.rebuildEnvironment(spec);
  }

  private applyModeToScenery(spec: GraphicsModeSpec): void {
    this.terrain.applyMode(spec, true);
    this.water.applyMode(spec);
    this.water.setQuality(this.quality);
    this.obstacles.applyMode(spec);
    this.sky.applyMode(spec);
  }

  setShadowMapSize(size: number): void {
    if (this.sun.shadow.mapSize.x === size) return;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
  }

  private rebuildEnvironment(spec: GraphicsModeSpec): void {
    this.envTexture?.dispose();
    this.envTexture = null;
    if (spec.envIntensity <= 0) {
      this.scene.environment = null;
      return;
    }
    const pmrem = new PMREMGenerator(this.renderer.renderer);
    const env = createEnvironmentScene(spec);
    this.envTexture = pmrem.fromScene(env.scene, 0.02).texture;
    env.dispose();
    pmrem.dispose();
    this.scene.environment = this.envTexture;
  }

  setViewport(heightPx: number, widthPx: number, fov: number): void {
    this.materials.setResolution(widthPx, heightPx);
    this.effects.setViewport(heightPx, fov);
  }

  sync(sim: Simulation, alpha: number, dt: number, time: number, camera: Vector3): void {
    const spec = this.spec;
    this.seen.clear();
    for (const tank of sim.tanks) {
      this.seen.add(tank.id);
      let view = this.tankViews.get(tank.id);
      if (!view) {
        view = new TankView(tank.id, tank, this.materials, this.rng);
        if (spec) view.applyMode(spec);
        this.tankViews.set(tank.id, view);
        this.tankKinds.set(tank.id, tank.spec.kind);
        this.scene.add(view.root);
      }
      const distance = Math.hypot(tank.x - camera.x, tank.z - camera.z);
      view.sync(tank, alpha, dt, time, distance);
      // The water surface over the tank, or NaN on dry ground and on bridge decks.
      const surface = tank.bridgeId < 0 ? this.world.water.surfaceAt(tank.x, tank.z) : Number.NaN;
      const wading = !Number.isNaN(surface);
      if (tank.alive && wading && Math.abs(tank.speed) > WAKE_SPEED && distance < 300) {
        this.effects.wake(tank.x, surface, tank.z, tank.heading, tank.speed, tank.spec.hitHalfExtents, dt);
      }
      if (tank.alive && !wading && Math.abs(tank.speed) > DUST_SPEED && distance < 300 && this.rng.next() < dt * Math.abs(tank.speed) * 1.2) {
        const back = tank.spec.hitHalfExtents.z * 0.9;
        const side = this.rng.chance(0.5) ? 1 : -1;
        const w = tank.spec.hitHalfExtents.x * 0.8;
        this.effects.dust(
          tank.x - Math.sin(tank.heading) * back + Math.cos(tank.heading) * w * side,
          tank.y,
          tank.z + Math.cos(tank.heading) * back + Math.sin(tank.heading) * w * side,
          Math.min(1, Math.abs(tank.speed) / 12),
        );
      }
      if (tank.alive && tank.healthFraction < SMOKE_HEALTH) {
        this.effects.trailSmoke(tank.x, tank.y + 2.6 * tank.spec.scale, tank.z, 10 * (1 - tank.healthFraction / SMOKE_HEALTH), dt);
      }
    }
    for (const [id, view] of this.tankViews) {
      if (this.seen.has(id)) continue;
      view.dispose();
      this.tankViews.delete(id);
      this.tankKinds.delete(id);
    }
    this.projectiles.sync(sim.projectiles, alpha);
    this.water.update(time);
    this.effects.update(dt);
    this.sky.follow(camera.x, camera.z);

    // Keep the shadow frustum centred on the player.
    const p = sim.player;
    this.sun.target.position.set(p.x, p.y, p.z);
    this.sun.position.set(p.x + SUN_OFFSET.x, p.y + SUN_OFFSET.y, p.z + SUN_OFFSET.z);
    this.sun.castShadow = !!spec?.shadows && this.shadowsAllowed;
  }

  handleEvents(events: readonly GameEvent[], camera: Vector3): void {
    const edgeColourOf = (id: number): number => {
      const kind = this.tankKinds.get(id) ?? 'standard';
      return this.spec ? this.spec.tanks[kind].edge : 0xffffff;
    };
    for (const e of events) this.effects.handleEvent(e, camera, edgeColourOf);
  }

  get tankViewCount(): number {
    return this.tankViews.size;
  }

  dispose(): void {
    this.clearTanks();
    this.terrain.dispose();
    this.water.dispose();
    this.bridges.dispose();
    this.obstacles.dispose();
    this.sky.dispose();
    this.projectiles.dispose();
    this.effects.dispose();
    this.envTexture?.dispose();
    this.materials.dispose();
  }
}
