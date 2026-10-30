import { describe, expect, it } from 'vitest';
import { PathFinder, Route } from '../src/ai/PathFinder';
import type { Obstacle } from '../src/world/Obstacle';
import { NavGrid } from '../src/world/NavGrid';
import { Terrain } from '../src/world/Terrain';
import { WaterMap } from '../src/world/Water';

const terrain = new Terrain(300, 5);

function wall(id: number, x: number, z: number, halfX: number, halfZ: number): Obstacle {
  return { id, kind: 'wall', x, z, yaw: 0, shape: { type: 'box', halfX, halfZ }, baseY: 0, height: 5, boundRadius: Math.hypot(halfX, halfZ), seed: id };
}

function gridWith(obstacles: Obstacle[]): NavGrid {
  return new NavGrid(250, WaterMap.dry(terrain), [], { terrain, obstacles });
}

/** Every point along the route, sampled every metre, lies on a walkable cell. */
function staysWalkable(nav: NavGrid, sx: number, sz: number, route: Route): boolean {
  let px = sx;
  let pz = sz;
  for (let k = 0; k < route.count; k++) {
    const x = route.xs[k]!;
    const z = route.zs[k]!;
    const steps = Math.ceil(Math.hypot(x - px, z - pz));
    for (let s = 1; s <= steps; s++) {
      if (!nav.isWalkable(px + ((x - px) * s) / steps, pz + ((z - pz) * s) / steps)) return false;
    }
    px = x;
    pz = z;
  }
  return true;
}

describe('PathFinder', () => {
  // A long east-west wall with gaps only at its ends, between the start and the goal.
  const nav = gridWith([wall(0, 0, 0, 180, 3)]);

  it('goes straight to the goal over open ground in one waypoint', () => {
    const finder = new PathFinder(nav);
    const route = new Route();
    expect(finder.find(-100, 100, 100, 150, route)).toBe(true);
    expect(route.count).toBe(1);
    expect(route.xs[0]).toBe(100);
    expect(route.zs[0]).toBe(150);
  });

  it('finds its way round a wall, never crossing it, with a few smoothed waypoints', () => {
    const finder = new PathFinder(nav);
    const route = new Route();
    expect(finder.find(0, 100, 0, -100, route)).toBe(true);
    expect(route.count).toBeGreaterThan(1);
    expect(route.count).toBeLessThan(8);
    expect(route.xs[route.count - 1]).toBe(0);
    expect(route.zs[route.count - 1]).toBe(-100);
    expect(staysWalkable(nav, 0, 100, route)).toBe(true);
    let farthest = 0;
    for (let k = 0; k < route.count; k++) farthest = Math.max(farthest, Math.abs(route.xs[k]!));
    expect(farthest).toBeGreaterThan(180);
  });

  it('settles for a partial route that makes progress when the search budget runs out', () => {
    const finder = new PathFinder(nav, 50);
    const route = new Route();
    expect(finder.find(0, 100, 0, -100, route)).toBe(false);
    expect(route.count).toBeGreaterThan(0);
    expect(finder.lastExpanded).toBeLessThanOrEqual(51);
    expect(staysWalkable(nav, 0, 100, route)).toBe(true);
  });

  it('stops at the nearest walkable cell when the goal itself is blocked', () => {
    const finder = new PathFinder(nav);
    const route = new Route();
    expect(finder.find(0, 100, 0, 1, route)).toBe(true);
    const lastZ = route.zs[route.count - 1]!;
    expect(Math.abs(lastZ)).toBeGreaterThan(3);
    expect(staysWalkable(nav, 0, 100, route)).toBe(true);
  });

  it('gives the same route every time', () => {
    const a = new Route();
    const b = new Route();
    new PathFinder(nav).find(-30, 120, 40, -140, a);
    const finder = new PathFinder(nav);
    finder.find(100, 100, -100, -100, b);
    finder.find(-30, 120, 40, -140, b);
    expect(Array.from(b.xs.subarray(0, b.count))).toEqual(Array.from(a.xs.subarray(0, a.count)));
    expect(Array.from(b.zs.subarray(0, b.count))).toEqual(Array.from(a.zs.subarray(0, a.count)));
  });

  it('reports a route cut short at its waypoint limit as partial, never ending across a wall', () => {
    // Every other column of cells is walled off, open only at alternate ends: a snake needing about 50 waypoints.
    const snake = gridWith([]);
    const cols = snake.cols;
    for (let i = 1; i < cols - 1; i += 2) {
      const gap = ((i - 1) / 2) % 2 === 0 ? 0 : cols - 1;
      for (let j = 0; j < cols; j++) {
        if (j === gap) continue;
        snake.walkable[j * cols + i] = 0;
        snake.cost[j * cols + i] = 0;
      }
    }
    const route = new Route();
    expect(new PathFinder(snake, 20000).find(-245, 0, 245, 0, route)).toBe(false);
    expect(route.count).toBe(route.xs.length);
    expect(staysWalkable(snake, -245, 0, route)).toBe(true);
  });

  it('fails cleanly from or to points off the battlefield', () => {
    const route = new Route();
    expect(new PathFinder(nav).find(0, 400, 0, -100, route)).toBe(false);
    expect(route.count).toBe(0);
  });
});

describe('Route', () => {
  it('holds waypoints up to its capacity and can be cleared', () => {
    const route = new Route();
    let pushed = 0;
    while (route.push(pushed, -pushed)) pushed++;
    expect(pushed).toBe(route.xs.length);
    expect(route.count).toBe(pushed);
    route.clear();
    expect(route.count).toBe(0);
    expect(route.bridgeId).toBe(-1);
  });
});
