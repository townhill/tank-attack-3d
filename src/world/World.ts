import { PROJECTILE } from '../config/settings';
import type { Bridge } from './Bridge';
import { bridgeBoundRadius, createBridgeLocal, deckHeightAt, isOnDeck, kerbPush, PARAPET_THICKNESS, parapetPush, segmentVsBridge, toBridgeLocal } from './Bridge';
import type { PushResult } from './Collision';
import { NO_HIT, segmentVsObstacle, segmentVsTerrain, segmentVsWater } from './Collision';
import { NavGrid } from './NavGrid';
import type { Obstacle } from './Obstacle';
import { ObstacleGrid } from './ObstacleGrid';
import type { HeightField, Terrain } from './Terrain';
import type { Lake, River } from './Water';
import { WaterMap } from './Water';

/** What a static raycast struck; 'none' when the segment reached its end. */
export type StaticSurface = 'none' | 'terrain' | 'water' | 'bridge' | 'obstacle';

export interface StaticHit {
  t: number;
  surface: StaticSurface;
  /** Obstacle hit, or null for any other surface. */
  obstacle: Obstacle | null;
}

export function createStaticHit(): StaticHit {
  return { t: NO_HIT, surface: 'none', obstacle: null };
}

/** Rivers, lakes and bridges laid over the terrain. */
export interface WorldFeatures {
  readonly water: WaterMap;
  readonly rivers: readonly River[];
  readonly lakes: readonly Lake[];
  readonly bridges: readonly Bridge[];
}

export function dryFeatures(terrain: Terrain): WorldFeatures {
  return { water: WaterMap.dry(terrain), rivers: [], lakes: [], bridges: [] };
}

/** The deck slab carries tracks out to the parapets' outer faces, beyond each kerb (metres). */
const DECK_GROUND_MARGIN = PARAPET_THICKNESS;

/** The static battlefield: terrain, water, bridges, obstacles and their spatial index. */
export class World implements HeightField {
  readonly grid: ObstacleGrid;
  readonly water: WaterMap;
  readonly rivers: readonly River[];
  readonly lakes: readonly Lake[];
  readonly bridges: readonly Bridge[];
  private readonly bridgeRadii: readonly number[];
  private readonly scratch: Obstacle[] = [];
  private readonly local = createBridgeLocal();
  private navGrid: NavGrid | null = null;

  constructor(
    readonly seed: number,
    readonly terrain: Terrain,
    readonly obstacles: readonly Obstacle[],
    readonly playableHalfSize: number,
    features: WorldFeatures = dryFeatures(terrain),
  ) {
    this.grid = new ObstacleGrid(terrain.halfSize, 40, obstacles);
    this.water = features.water;
    this.rivers = features.rivers;
    this.lakes = features.lakes;
    this.bridges = features.bridges;
    this.bridgeRadii = features.bridges.map(bridgeBoundRadius);
  }

  /** Navigation grid of the battlefield (water, bridges, obstacles and slopes), built on first use. */
  get nav(): NavGrid {
    this.navGrid ??= new NavGrid(this.playableHalfSize, this.water, this.bridges, { terrain: this.terrain, obstacles: this.obstacles });
    return this.navGrid;
  }

  /** Height of the drivable ground at (x, z): the surface tank tracks rest on, bridge decks included. */
  heightAt(x: number, z: number): number {
    let h = this.terrain.heightAt(x, z);
    const local = this.local;
    for (let i = 0; i < this.bridges.length; i++) {
      const b = this.bridges[i]!;
      const r = this.bridgeRadii[i]!;
      if ((x - b.x) * (x - b.x) + (z - b.z) * (z - b.z) > r * r) continue;
      toBridgeLocal(b, x, z, local);
      if (!isOnDeck(b, local, DECK_GROUND_MARGIN)) continue;
      const road = deckHeightAt(b, local.along);
      if (road > h) h = road;
    }
    return h;
  }

  /** Top of whatever is at (x, z): the ground, a bridge deck or the water surface. */
  surfaceHeightAt(x: number, z: number): number {
    const ground = this.heightAt(x, z);
    const water = this.water.surfaceAt(x, z);
    return water > ground ? water : ground;
  }

  /**
   * Bridge a tank centred at (x, z) is on, given the one it was on (-1 for
   * none). A tank joins a deck by driving onto the road over an end, and
   * leaves it past either end; the parapets close both sides.
   */
  trackBridge(current: number, x: number, z: number): number {
    const local = this.local;
    const onDeck = this.bridges[current];
    if (onDeck && Math.abs(toBridgeLocal(onDeck, x, z, local).along) <= onDeck.halfLength) return current;
    for (let i = 0; i < this.bridges.length; i++) {
      const b = this.bridges[i]!;
      if (isOnDeck(b, toBridgeLocal(b, x, z, local))) return i;
    }
    return -1;
  }

  /** Keeps a tank crossing bridge `bridgeId` between its kerbs; see `kerbPush`. */
  kerbPush(bridgeId: number, x: number, z: number, radius: number, out: PushResult): boolean {
    const b = this.bridges[bridgeId];
    return b ? kerbPush(b, toBridgeLocal(b, x, z, this.local), radius, out) : false;
  }

  /** Keeps a tank that is not on a deck outside every bridge's parapets; see `parapetPush`. */
  parapetPush(x: number, z: number, radius: number, out: PushResult): boolean {
    for (let i = 0; i < this.bridges.length; i++) {
      const b = this.bridges[i]!;
      const reach = this.bridgeRadii[i]! + radius;
      if ((x - b.x) * (x - b.x) + (z - b.z) * (z - b.z) > reach * reach) continue;
      if (parapetPush(b, toBridgeLocal(b, x, z, this.local), radius, out)) return true;
    }
    return false;
  }

  isInsidePlayable(x: number, z: number, margin = 0): boolean {
    const limit = this.playableHalfSize - margin;
    return Math.abs(x) <= limit && Math.abs(z) <= limit;
  }

  /**
   * Nearest terrain, water, bridge or obstacle contact along A->B. Writes into
   * `out`. Sight lines pass `water = false` to see through the surface.
   */
  raycastStatic(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    out: StaticHit,
    terrainStep: number = PROJECTILE.terrainStep,
    water = true,
  ): StaticHit {
    out.t = segmentVsTerrain(ax, ay, az, bx, by, bz, this.terrain, terrainStep);
    out.surface = out.t === NO_HIT ? 'none' : 'terrain';
    out.obstacle = null;
    if (water) {
      const t = segmentVsWater(ax, ay, az, bx, by, bz, this.water, terrainStep);
      if (t < out.t) {
        out.t = t;
        out.surface = 'water';
      }
    }
    for (let i = 0; i < this.bridges.length; i++) {
      const b = this.bridges[i]!;
      if (!segmentPassesNear(ax, az, bx, bz, b.x, b.z, this.bridgeRadii[i]!)) continue;
      const t = segmentVsBridge(ax, ay, az, bx, by, bz, b);
      if (t < out.t) {
        out.t = t;
        out.surface = 'bridge';
      }
    }
    const candidates = this.grid.querySegment(ax, az, bx, bz, this.scratch);
    for (const ob of candidates) {
      const t = segmentVsObstacle(ax, ay, az, bx, by, bz, ob);
      if (t < out.t) {
        out.t = t;
        out.surface = 'obstacle';
        out.obstacle = ob;
      }
    }
    return out;
  }

  private readonly losHit = createStaticHit();

  /** True when nothing solid lies between A and B; water does not block sight. */
  hasLineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    return this.raycastStatic(ax, ay, az, bx, by, bz, this.losHit, 2, false).t === NO_HIT;
  }

  obstaclesNear(x: number, z: number, radius: number, out: Obstacle[]): Obstacle[] {
    return this.grid.queryCircle(x, z, radius, out);
  }
}

/** True when segment A->B on the XZ plane comes within `radius` of (px, pz). */
function segmentPassesNear(ax: number, az: number, bx: number, bz: number, px: number, pz: number, radius: number): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  let t = lenSq > 0 ? ((px - ax) * dx + (pz - az) * dz) / lenSq : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = ax + dx * t - px;
  const ez = az + dz * t - pz;
  return ex * ex + ez * ez <= radius * radius;
}
