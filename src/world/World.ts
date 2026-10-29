import { PROJECTILE } from '../config/settings';
import { NO_HIT, segmentVsObstacle, segmentVsTerrain } from './Collision';
import type { Obstacle } from './Obstacle';
import { ObstacleGrid } from './ObstacleGrid';
import type { HeightField, Terrain } from './Terrain';

/** What a static raycast struck; 'none' when the segment reached its end. */
export type StaticSurface = 'none' | 'terrain' | 'obstacle';

export interface StaticHit {
  t: number;
  surface: StaticSurface;
  /** Obstacle hit, or null for any other surface. */
  obstacle: Obstacle | null;
}

export function createStaticHit(): StaticHit {
  return { t: NO_HIT, surface: 'none', obstacle: null };
}

/** The static battlefield: terrain, obstacles and their spatial index. */
export class World implements HeightField {
  readonly grid: ObstacleGrid;
  private readonly scratch: Obstacle[] = [];

  constructor(
    readonly seed: number,
    readonly terrain: Terrain,
    readonly obstacles: readonly Obstacle[],
    readonly playableHalfSize: number,
  ) {
    this.grid = new ObstacleGrid(terrain.halfSize, 40, obstacles);
  }

  /** Height of the drivable ground at (x, z): the surface tank tracks rest on. */
  heightAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z);
  }

  isInsidePlayable(x: number, z: number, margin = 0): boolean {
    const limit = this.playableHalfSize - margin;
    return Math.abs(x) <= limit && Math.abs(z) <= limit;
  }

  /** Nearest terrain or obstacle contact along A->B. Writes into `out`. */
  raycastStatic(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    out: StaticHit,
    terrainStep: number = PROJECTILE.terrainStep,
  ): StaticHit {
    out.t = segmentVsTerrain(ax, ay, az, bx, by, bz, this.terrain, terrainStep);
    out.surface = out.t === NO_HIT ? 'none' : 'terrain';
    out.obstacle = null;
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

  hasLineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
    return this.raycastStatic(ax, ay, az, bx, by, bz, this.losHit, 2).t === NO_HIT;
  }

  obstaclesNear(x: number, z: number, radius: number, out: Obstacle[]): Obstacle[] {
    return this.grid.queryCircle(x, z, radius, out);
  }
}
