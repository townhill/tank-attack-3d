import { describe, expect, it } from 'vitest';
import {
  circleVsObstacle,
  createPushResult,
  NO_HIT,
  segmentVsAabb,
  segmentVsCylinder,
  segmentVsObstacle,
  segmentVsTerrain,
} from '../src/world/Collision';
import type { Obstacle, ObstacleKind, ObstacleShape } from '../src/world/Obstacle';
import {
  boundRadiusOf,
  buildingStoreys,
  hasTaperedProfile,
  pointInsideObstacle,
  profileScale,
  STOREY_HEIGHT,
  toLocalX,
  toLocalZ,
  toWorldX,
  toWorldZ,
} from '../src/world/Obstacle';
import { Terrain } from '../src/world/Terrain';
import { createStaticHit, World } from '../src/world/World';
import { Random } from '../src/utils/random';

interface ObstacleOptions {
  x?: number;
  z?: number;
  yaw?: number;
  baseY?: number;
  height?: number;
  id?: number;
}

function makeObstacle(kind: ObstacleKind, shape: ObstacleShape, options: ObstacleOptions = {}): Obstacle {
  return {
    id: options.id ?? 0,
    kind,
    x: options.x ?? 0,
    z: options.z ?? 0,
    yaw: options.yaw ?? 0,
    shape,
    baseY: options.baseY ?? 0,
    height: options.height ?? 10,
    boundRadius: boundRadiusOf(shape),
    seed: 0,
  };
}

const box = (halfX: number, halfZ: number): ObstacleShape => ({ type: 'box', halfX, halfZ });
const circle = (radius: number): ObstacleShape => ({ type: 'circle', radius });

/** Terrain whose height is `slopeX * x`. */
function makeRamp(slopeX: number, halfSize = 100): Terrain {
  const terrain = new Terrain(halfSize, 5);
  for (let j = 0; j < terrain.resolution; j++) {
    for (let i = 0; i < terrain.resolution; i++) terrain.heights[terrain.index(i, j)] = slopeX * terrain.vertexX(i);
  }
  return terrain;
}

describe('Obstacle geometry helpers', () => {
  it('boundRadiusOf returns the radius for circles and the half-diagonal for boxes', () => {
    expect(boundRadiusOf(circle(3))).toBe(3);
    expect(boundRadiusOf(box(3, 4))).toBe(5);
  });

  it('local and world conversions are inverse operations for any yaw', () => {
    const rng = new Random(4);
    for (let n = 0; n < 50; n++) {
      const yaw = rng.range(-Math.PI, Math.PI);
      const dx = rng.range(-30, 30);
      const dz = rng.range(-30, 30);
      const lx = toLocalX(dx, dz, yaw);
      const lz = toLocalZ(dx, dz, yaw);
      expect(toWorldX(lx, lz, yaw)).toBeCloseTo(dx, 9);
      expect(toWorldZ(lx, lz, yaw)).toBeCloseTo(dz, 9);
    }
  });

  it('yaw uses the compass convention: yaw PI/2 turns the local -Z axis towards +X (east)', () => {
    // A point one metre ahead of the obstacle (local z = -1) sits at world +X for yaw PI/2.
    expect(toWorldX(0, -1, Math.PI / 2)).toBeCloseTo(1, 12);
    expect(toWorldZ(0, -1, Math.PI / 2)).toBeCloseTo(0, 12);
    // And at world -Z (north) for yaw 0.
    expect(toWorldX(0, -1, 0)).toBeCloseTo(0, 12);
    expect(toWorldZ(0, -1, 0)).toBeCloseTo(-1, 12);
  });

  it('profileScale narrows pyramids, domes rocks, tapers towers and leaves other kinds prismatic', () => {
    expect(profileScale('pyramid', 0)).toBe(1);
    expect(profileScale('pyramid', 0.25)).toBeCloseTo(0.75, 12);
    expect(profileScale('pyramid', 1)).toBe(0);
    expect(profileScale('rock', 0)).toBe(1);
    expect(profileScale('rock', 1)).toBeCloseTo(Math.sqrt(0.15), 12);
    expect(profileScale('tower', 1)).toBeCloseTo(0.65, 12);
    for (const kind of ['block', 'bunker', 'wall', 'pylon', 'building'] as const) expect(profileScale(kind, 0.9)).toBe(1);
  });

  it('hasTaperedProfile is true only for pyramid, rock and tower', () => {
    expect(['pyramid', 'rock', 'tower'].every((k) => hasTaperedProfile(k as ObstacleKind))).toBe(true);
    expect(['block', 'bunker', 'wall', 'pylon', 'building'].some((k) => hasTaperedProfile(k as ObstacleKind))).toBe(false);
  });

  it('buildingStoreys recovers the storey count from a building height', () => {
    for (const storeys of [2, 3, 4]) {
      const building = makeObstacle('building', box(8, 6), { height: storeys * STOREY_HEIGHT });
      expect(buildingStoreys(building)).toBe(storeys);
    }
  });

  it('pointInsideObstacle respects the vertical extent, the footprint and the yaw', () => {
    const wall = makeObstacle('wall', box(10, 1), { yaw: Math.PI / 2, baseY: 2, height: 6 });
    // Yaw PI/2 swaps the footprint: 1 m wide in X, 10 m long in Z.
    expect(pointInsideObstacle(wall, 0.5, 4, 8)).toBe(true);
    expect(pointInsideObstacle(wall, 8, 4, 0.5)).toBe(false);
    expect(pointInsideObstacle(wall, 0.5, 1.9, 0)).toBe(false);
    expect(pointInsideObstacle(wall, 0.5, 8.1, 0)).toBe(false);
  });

  it('pointInsideObstacle follows the pyramid slope', () => {
    const pyramid = makeObstacle('pyramid', box(10, 10));
    expect(pointInsideObstacle(pyramid, 9, 1, 0)).toBe(true);
    expect(pointInsideObstacle(pyramid, 9, 5, 0)).toBe(false);
    expect(pointInsideObstacle(pyramid, 4, 5, 4)).toBe(true);
    expect(pointInsideObstacle(pyramid, 6, 5, 6)).toBe(false);
  });

  it('pointInsideObstacle handles circular footprints', () => {
    const pylon = makeObstacle('pylon', circle(2));
    expect(pointInsideObstacle(pylon, 1.9, 5, 0)).toBe(true);
    expect(pointInsideObstacle(pylon, 1.5, 5, 1.5)).toBe(false);
  });
});

describe('circleVsObstacle', () => {
  it('reports no contact for a circle clear of a circular obstacle', () => {
    const out = createPushResult();
    expect(circleVsObstacle(10, 0, 2, makeObstacle('rock', circle(5)), out)).toBe(false);
  });

  it('pushes a circle out of a circular obstacle along the line of centres', () => {
    const out = createPushResult();
    expect(circleVsObstacle(6, 0, 2, makeObstacle('rock', circle(5)), out)).toBe(true);
    expect(out.nx).toBeCloseTo(1, 12);
    expect(out.nz).toBeCloseTo(0, 12);
    expect(out.depth).toBeCloseTo(1, 12);

    expect(circleVsObstacle(0, -6, 2, makeObstacle('rock', circle(5)), out)).toBe(true);
    expect(out.nx).toBeCloseTo(0, 12);
    expect(out.nz).toBeCloseTo(-1, 12);
  });

  it('handles a circle centred exactly on a circular obstacle by choosing a stable direction', () => {
    const out = createPushResult();
    expect(circleVsObstacle(0, 0, 2, makeObstacle('rock', circle(5)), out)).toBe(true);
    expect(Math.hypot(out.nx, out.nz)).toBeCloseTo(1, 12);
    expect(out.depth).toBeCloseTo(7, 12);
  });

  it('does not collide when circles are exactly touching', () => {
    const out = createPushResult();
    expect(circleVsObstacle(7, 0, 2, makeObstacle('rock', circle(5)), out)).toBe(false);
  });

  it('reports no contact for a circle beside an axis-aligned box', () => {
    const out = createPushResult();
    expect(circleVsObstacle(8, 0, 3, makeObstacle('block', box(4, 2)), out)).toBe(false);
  });

  it('pushes a circle along the face normal when it overlaps a box face', () => {
    const out = createPushResult();
    expect(circleVsObstacle(6, 0, 3, makeObstacle('block', box(4, 2)), out)).toBe(true);
    expect(out.nx).toBeCloseTo(1, 12);
    expect(out.nz).toBeCloseTo(0, 12);
    expect(out.depth).toBeCloseTo(1, 12);

    expect(circleVsObstacle(0, -4, 3, makeObstacle('block', box(4, 2)), out)).toBe(true);
    expect(out.nx).toBeCloseTo(0, 12);
    expect(out.nz).toBeCloseTo(-1, 12);
    expect(out.depth).toBeCloseTo(1, 12);
  });

  it('pushes diagonally away from a box corner', () => {
    const out = createPushResult();
    const ob = makeObstacle('block', box(4, 2));
    // Nearest box point is the corner (4, 2); the circle centre is at (6, 4).
    expect(circleVsObstacle(6, 4, 3, ob, out)).toBe(true);
    expect(out.nx).toBeCloseTo(Math.SQRT1_2, 9);
    expect(out.nz).toBeCloseTo(Math.SQRT1_2, 9);
    expect(out.depth).toBeCloseTo(3 - Math.hypot(2, 2), 9);
  });

  it('respects the yaw of a rotated box', () => {
    const out = createPushResult();
    // Yaw PI/2: the 4 m half-width lies along world Z and the 2 m half-length along world X.
    const ob = makeObstacle('block', box(4, 2), { yaw: Math.PI / 2 });
    expect(circleVsObstacle(4, 0, 3, ob, out)).toBe(true);
    expect(out.nx).toBeCloseTo(1, 9);
    expect(out.nz).toBeCloseTo(0, 9);
    expect(out.depth).toBeCloseTo(1, 9);

    // 5 m along world Z is within the (rotated) half-width plus radius, but not for the unrotated box.
    expect(circleVsObstacle(0, 5, 2, ob, out)).toBe(true);
    expect(out.nx).toBeCloseTo(0, 9);
    expect(out.nz).toBeCloseTo(1, 9);
    expect(circleVsObstacle(0, 5, 2, makeObstacle('block', box(4, 2)), out)).toBe(false);
  });

  it('pushes a circle whose centre is inside a box out through the nearest face', () => {
    const out = createPushResult();
    const ob = makeObstacle('block', box(4, 2));
    // Nearest face is +X (1 m away), so depth is 1 + radius.
    expect(circleVsObstacle(3, 0.5, 1, ob, out)).toBe(true);
    expect(out.nx).toBeCloseTo(1, 12);
    expect(out.nz).toBeCloseTo(0, 12);
    expect(out.depth).toBeCloseTo(2, 12);

    // Nearest face is local +Z (0.5 m away): world +Z at yaw 0.
    expect(circleVsObstacle(1, 1.5, 1, ob, out)).toBe(true);
    expect(out.nx).toBeCloseTo(0, 12);
    expect(out.nz).toBeCloseTo(1, 12);
    expect(out.depth).toBeCloseTo(1.5, 12);

    // And local -Z (north) when the centre is on the other side.
    expect(circleVsObstacle(-1, -1.5, 1, ob, out)).toBe(true);
    expect(out.nz).toBeCloseTo(-1, 12);

    // And -X.
    expect(circleVsObstacle(-3.5, 0, 1, ob, out)).toBe(true);
    expect(out.nx).toBeCloseTo(-1, 12);
  });

  it('resolves every overlap: applying the push leaves the circle clear, whatever the box yaw', () => {
    const out = createPushResult();
    const check = createPushResult();
    const shapes: ObstacleShape[] = [box(4, 2.5), circle(3)];
    for (const shape of shapes) {
      for (const yaw of [0, 0.3, 1.2, -2]) {
        const ob = makeObstacle(shape.type === 'box' ? 'block' : 'rock', shape, { yaw, x: 2, z: -1 });
        for (let px = -10; px <= 14; px += 0.5) {
          for (let pz = -11; pz <= 9; pz += 0.5) {
            if (!circleVsObstacle(px, pz, 1.5, ob, out)) continue;
            expect(Math.hypot(out.nx, out.nz)).toBeCloseTo(1, 9);
            expect(out.depth).toBeGreaterThan(0);
            const moved = circleVsObstacle(px + out.nx * out.depth, pz + out.nz * out.depth, 1.5, ob, check);
            expect(!moved || check.depth < 1e-6).toBe(true);
          }
        }
      }
    }
  });
});

describe('segmentVsAabb', () => {
  const hit = (ax: number, ay: number, az: number, bx: number, by: number, bz: number): number =>
    segmentVsAabb(ax, ay, az, bx, by, bz, 1, 1, 1);

  it('returns the parametric entry distance for a segment crossing the box', () => {
    expect(hit(-5, 0, 0, 5, 0, 0)).toBeCloseTo(0.4, 12);
    expect(hit(0, 5, 0, 0, -5, 0)).toBeCloseTo(0.4, 12);
    expect(hit(0, 0, 5, 0, 0, -5)).toBeCloseTo(0.4, 12);
  });

  it('misses a segment passing beside the box', () => {
    expect(hit(-5, 2, 0, 5, 2, 0)).toBe(NO_HIT);
    expect(hit(-5, 0, 1.5, 5, 0, 1.5)).toBe(NO_HIT);
  });

  it('misses a segment that stops short of the box', () => {
    expect(hit(-5, 0, 0, -3, 0, 0)).toBe(NO_HIT);
  });

  it('misses a segment that points away from the box', () => {
    expect(hit(-5, 0, 0, -9, 0, 0)).toBe(NO_HIT);
  });

  it('handles segments parallel to an axis, inside and outside the slab', () => {
    expect(hit(0.5, -5, 0.5, 0.5, 5, 0.5)).toBeCloseTo(0.4, 12);
    expect(hit(2, -5, 0, 2, 5, 0)).toBe(NO_HIT);
  });

  it('returns 0 when the segment starts inside the box', () => {
    expect(hit(0, 0, 0, 5, 0, 0)).toBe(0);
    expect(hit(0.2, -0.3, 0.1, 0.3, 0.2, 0.9)).toBe(0);
  });

  it('returns 0 for a zero-length segment inside the box and NO_HIT outside it', () => {
    expect(hit(0, 0, 0, 0, 0, 0)).toBe(0);
    expect(hit(3, 0, 0, 3, 0, 0)).toBe(NO_HIT);
  });

  it('hits a box diagonally', () => {
    expect(hit(-3, -3, -3, 3, 3, 3)).toBeCloseTo(2 / 6, 12);
  });
});

describe('segmentVsCylinder', () => {
  const cyl = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    exit?: { t: number },
  ): number => segmentVsCylinder(ax, ay, az, bx, by, bz, 0, 0, 2, 0, 10, exit);

  it('returns entry and exit distances for a horizontal pass through the cylinder', () => {
    const exit = { t: -1 };
    expect(cyl(-5, 5, 0, 5, 5, 0, exit)).toBeCloseTo(0.3, 12);
    expect(exit.t).toBeCloseTo(0.7, 12);
  });

  it('works without an exit argument', () => {
    expect(cyl(-5, 5, 0, 5, 5, 0)).toBeCloseTo(0.3, 12);
  });

  it('misses beside the cylinder, above it and below it', () => {
    expect(cyl(-5, 5, 3, 5, 5, 3)).toBe(NO_HIT);
    expect(cyl(-5, 12, 0, 5, 12, 0)).toBe(NO_HIT);
    expect(cyl(-5, -2, 0, 5, -2, 0)).toBe(NO_HIT);
  });

  it('misses a segment that stops before reaching the cylinder', () => {
    expect(cyl(-9, 5, 0, -4, 5, 0)).toBe(NO_HIT);
  });

  it('enters through the top cap when descending vertically', () => {
    expect(cyl(0, 15, 0, 0, 5, 0)).toBeCloseTo(0.5, 12);
  });

  it('enters through the top cap when descending at an angle inside the radius', () => {
    expect(cyl(-1, 15, 0, 1, 5, 0)).toBeCloseTo(0.5, 12);
  });

  it('misses a vertical segment outside the radius', () => {
    expect(cyl(3, 15, 0, 3, 5, 0)).toBe(NO_HIT);
  });

  it('enters through the bottom cap when rising from below', () => {
    expect(cyl(0, -4, 0, 0, 6, 0)).toBeCloseTo(0.4, 12);
  });

  it('returns 0 when the segment starts inside the cylinder', () => {
    expect(cyl(0.5, 5, 0.5, 10, 5, 0.5)).toBe(0);
  });

  it('treats a segment grazing the side as a hit only if it actually crosses the surface', () => {
    expect(cyl(-5, 5, 1.99, 5, 5, 1.99)).toBeGreaterThan(0);
    expect(cyl(-5, 5, 2.01, 5, 5, 2.01)).toBe(NO_HIT);
  });
});

describe('segmentVsObstacle', () => {
  const shoot = (ob: Obstacle, ax: number, ay: number, az: number, bx: number, by: number, bz: number): number =>
    segmentVsObstacle(ax, ay, az, bx, by, bz, ob);

  describe('block versus pyramid with the same bounding box', () => {
    const block = makeObstacle('block', box(10, 10));
    const pyramid = makeObstacle('pyramid', box(10, 10));

    it('both are hit by a shot through the middle; the pyramid is entered at its sloped face', () => {
      expect(shoot(block, -20, 5, 0, 20, 5, 0)).toBeCloseTo(0.25, 9);
      // At 5 m height the pyramid is only 5 m wide on each side: x = -5, t = 15 / 40.
      expect(shoot(pyramid, -20, 5, 0, 20, 5, 0)).toBeCloseTo(0.375, 3);
    });

    it('a shot passing near a corner, inside the bounding box, misses the pyramid but hits the block', () => {
      expect(shoot(block, -20, 5, 8, 20, 5, 8)).toBeCloseTo(0.25, 9);
      expect(shoot(pyramid, -20, 5, 8, 20, 5, 8)).toBe(NO_HIT);
    });

    it('a shot skimming just above the slanted face misses the pyramid', () => {
      // The -X face is the line y = 10 + x. This shot runs parallel to it, 0.6 m above.
      expect(shoot(pyramid, -20, -9.4, 0, 20, 30.6, 0)).toBe(NO_HIT);
    });

    it('the same shot lowered by 1.2 m hits the pyramid near its base', () => {
      // This shot follows y = x + 9.4, so it reaches the ground plane (y = 0) at x = -9.4,
      // which is inside the 10 m half-width at the base: t = (-9.4 + 20) / 40.
      expect(shoot(pyramid, -20, -10.6, 0, 20, 29.4, 0)).toBeCloseTo(0.265, 2);
    });

    it('a shot above the apex misses both', () => {
      expect(shoot(pyramid, -20, 10.5, 0, 20, 10.5, 0)).toBe(NO_HIT);
      expect(shoot(block, -20, 10.5, 0, 20, 10.5, 0)).toBe(NO_HIT);
    });

    it('a shot starting inside returns 0', () => {
      expect(shoot(pyramid, 0, 5, 0, 20, 5, 0)).toBe(0);
      expect(shoot(block, 0, 5, 0, 20, 5, 0)).toBe(0);
    });

    it('a shot coming straight down onto the apex region hits the pyramid', () => {
      expect(shoot(pyramid, 0.5, 20, 0.5, 0.5, 0, 0.5)).toBeGreaterThan(0.4);
      expect(shoot(pyramid, 0.5, 20, 0.5, 0.5, 0, 0.5)).toBeLessThan(0.6);
    });
  });

  describe('buildings of different storeys', () => {
    const twoStorey = makeObstacle('building', box(8, 6), { height: 2 * STOREY_HEIGHT });
    const fourStorey = makeObstacle('building', box(8, 6), { height: 4 * STOREY_HEIGHT });

    it('a shot at 12 m clears a two-storey building but strikes a four-storey one', () => {
      expect(shoot(twoStorey, -20, 12, 0, 20, 12, 0)).toBe(NO_HIT);
      expect(shoot(fourStorey, -20, 12, 0, 20, 12, 0)).toBeCloseTo(0.3, 9);
    });

    it('a shot at ground-floor height strikes both', () => {
      expect(shoot(twoStorey, -20, 2, 0, 20, 2, 0)).toBeCloseTo(0.3, 9);
      expect(shoot(fourStorey, -20, 2, 0, 20, 2, 0)).toBeCloseTo(0.3, 9);
    });
  });

  describe('rotated box', () => {
    // Yaw PI/2: 1 m thick along world X, 10 m half-length along world Z.
    const wall = makeObstacle('wall', box(10, 1), { yaw: Math.PI / 2, height: 5 });

    it('is hit along its long axis and missed beside it', () => {
      expect(shoot(wall, -20, 2, 5, 20, 2, 5)).toBeCloseTo(0.475, 9);
      expect(shoot(wall, 5, 2, -20, 5, 2, 20)).toBe(NO_HIT);
      expect(shoot(wall, 0, 2, -20, 0, 2, 20)).toBeCloseTo(0.25, 9);
    });
  });

  describe('circular obstacles', () => {
    it('hits a prismatic pylon and misses over its top', () => {
      const pylon = makeObstacle('pylon', circle(1.6), { height: 14 });
      expect(shoot(pylon, -20, 7, 0, 20, 7, 0)).toBeCloseTo((20 - 1.6) / 40, 9);
      expect(shoot(pylon, -20, 15, 0, 20, 15, 0)).toBe(NO_HIT);
    });

    it('lets a shot pass the narrowed top of a tower that would hit the base', () => {
      const tower = makeObstacle('tower', circle(3), { height: 20 });
      // 2.5 m off-centre: inside the 3 m base radius, outside the ~2 m radius near the top.
      expect(shoot(tower, -20, 19, 2.5, 20, 19, 2.5)).toBe(NO_HIT);
      expect(shoot(tower, -20, 1, 2.5, 20, 1, 2.5)).toBeCloseTo(0.461, 2);
    });

    it('lets a shot pass over the shoulder of a domed rock', () => {
      const rock = makeObstacle('rock', circle(4), { height: 4 });
      expect(shoot(rock, -20, 3.6, 3.5, 20, 3.6, 3.5)).toBe(NO_HIT);
      expect(shoot(rock, -20, 0.4, 3.5, 20, 0.4, 3.5)).toBeGreaterThan(0);
      expect(shoot(rock, -20, 0.4, 3.5, 20, 0.4, 3.5)).toBeLessThan(0.5);
    });

    it('returns 0 for a shot that starts inside a rock', () => {
      const rock = makeObstacle('rock', circle(4), { height: 4 });
      expect(shoot(rock, 0, 1, 0, 20, 1, 0)).toBe(0);
    });
  });
});

describe('segmentVsTerrain', () => {
  it('finds the first crossing on a ramp', () => {
    const terrain = makeRamp(0.25);
    // Ground height is 0.25 x; the shot height is 20 - 0.25 x, so they meet at x = 40 (t = 0.5).
    expect(segmentVsTerrain(0, 20, 0, 80, 0, 0, terrain, 1)).toBeCloseTo(0.5, 3);
  });

  it('finds the crossing on flat ground for a vertical dive', () => {
    const terrain = new Terrain(100, 5);
    expect(segmentVsTerrain(0, 10, 0, 0, -10, 0, terrain, 1)).toBeCloseTo(0.5, 3);
  });

  it('returns 0 when the segment starts below or on the ground', () => {
    const terrain = makeRamp(0.25);
    expect(segmentVsTerrain(0, -5, 0, 10, 50, 0, terrain, 1)).toBe(0);
    expect(segmentVsTerrain(10, terrain.heightAt(10, 0), 0, 30, 50, 0, terrain, 1)).toBe(0);
  });

  it('returns NO_HIT for a segment that stays above the ground', () => {
    const terrain = makeRamp(0.25);
    expect(segmentVsTerrain(0, 50, 0, 40, 50, 0, terrain, 1)).toBe(NO_HIT);
    expect(segmentVsTerrain(0, 5, 0, 0, 5, 0, new Terrain(100, 5), 1)).toBe(NO_HIT);
  });

  it('does not miss a narrow ridge when the step is shorter than the ridge', () => {
    const terrain = new Terrain(100, 5);
    terrain.heights[terrain.index(20, 20)] = 6; // a spike at (0, 0)
    expect(segmentVsTerrain(-20, 2, 0, 20, 2, 0, terrain, 1)).toBeLessThan(1);
  });
});

describe('World raycasts', () => {
  const buildWorld = (obstacles: Obstacle[], terrain = new Terrain(100, 5)): World => new World(1, terrain, obstacles, 80);

  it('createStaticHit starts as a miss', () => {
    expect(createStaticHit()).toEqual({ t: NO_HIT, surface: 'none', obstacle: null });
  });

  it('heightAt delegates to the terrain', () => {
    const terrain = makeRamp(0.25);
    expect(buildWorld([], terrain).heightAt(12, 3)).toBeCloseTo(3, 4);
  });

  it('raycastStatic reports an obstacle hit with the obstacle itself', () => {
    const block = makeObstacle('block', box(3, 3), { x: 20, z: 0 });
    const world = buildWorld([block]);
    const out = createStaticHit();
    world.raycastStatic(-30, 5, 0, 60, 5, 0, out);
    expect(out.surface).toBe('obstacle');
    expect(out.obstacle).toBe(block);
    expect(out.t).toBeCloseTo(47 / 90, 9);
  });

  it('raycastStatic reports a terrain hit with no obstacle when only the ground is hit', () => {
    const block = makeObstacle('block', box(3, 3), { x: 20, z: 0 });
    const world = buildWorld([block]);
    const out = createStaticHit();
    world.raycastStatic(-30, 5, 0, 0, -5, 0, out);
    expect(out.surface).toBe('terrain');
    expect(out.obstacle).toBeNull();
    expect(out.t).toBeCloseTo(0.5, 2);
  });

  it('raycastStatic reports a clean miss', () => {
    const world = buildWorld([makeObstacle('block', box(3, 3), { x: 20, z: 0 })]);
    const out = createStaticHit();
    world.raycastStatic(-30, 50, 0, 60, 50, 0, out);
    expect(out.t).toBe(NO_HIT);
    expect(out.surface).toBe('none');
    expect(out.obstacle).toBeNull();
  });

  it('raycastStatic clears the surface of a reused hit record on a miss', () => {
    const world = buildWorld([makeObstacle('block', box(3, 3), { x: 20, z: 0 })]);
    const out = createStaticHit();
    world.raycastStatic(-30, 5, 0, 60, 5, 0, out);
    world.raycastStatic(-30, 50, 0, 60, 50, 0, out);
    expect(out.surface).toBe('none');
    expect(out.obstacle).toBeNull();
  });

  it('raycastStatic picks the nearer of an obstacle and the terrain', () => {
    // The descending ray y = -0.2 x meets the ground at x = 0 (t = 0.5).
    const nearBlock = makeObstacle('block', box(3, 3), { x: -20, z: 0, baseY: -1, height: 10 });
    const out = createStaticHit();
    buildWorld([nearBlock]).raycastStatic(-40, 8, 0, 40, -8, 0, out);
    expect(out.surface).toBe('obstacle');
    expect(out.obstacle).toBe(nearBlock);
    expect(out.t).toBeCloseTo(17 / 80, 9);

    // A block on the far side only gets hit below ground level, after the terrain.
    const farBlock = makeObstacle('block', box(3, 3), { x: 20, z: 0, baseY: -10, height: 20 });
    buildWorld([farBlock]).raycastStatic(-40, 8, 0, 40, -8, 0, out);
    expect(out.surface).toBe('terrain');
    expect(out.obstacle).toBeNull();
    expect(out.t).toBeCloseTo(0.5, 2);
  });

  it('hasLineOfSight is true across open ground', () => {
    expect(buildWorld([]).hasLineOfSight(-40, 3, 0, 40, 3, 0)).toBe(true);
  });

  it('hasLineOfSight is blocked by an obstacle and clear above it', () => {
    const world = buildWorld([makeObstacle('block', box(3, 3), { x: 20, z: 0 })]);
    expect(world.hasLineOfSight(0, 5, 0, 40, 5, 0)).toBe(false);
    expect(world.hasLineOfSight(0, 15, 0, 40, 15, 0)).toBe(true);
    expect(world.hasLineOfSight(0, 5, 10, 40, 5, 10)).toBe(true);
  });

  it('hasLineOfSight is blocked by a hill and clear over its crest', () => {
    const hill = new Terrain(100, 5);
    for (let j = 0; j < hill.resolution; j++) {
      for (let i = 0; i < hill.resolution; i++) hill.heights[hill.index(i, j)] = Math.max(0, 12 - 0.6 * Math.abs(hill.vertexX(i)));
    }
    const world = buildWorld([], hill);
    expect(world.hasLineOfSight(-50, 2, 0, 50, 2, 0)).toBe(false);
    expect(world.hasLineOfSight(-50, 20, 0, 50, 20, 0)).toBe(true);
  });

  it('obstaclesNear returns the obstacles around a point', () => {
    const a = makeObstacle('rock', circle(3), { x: 10, z: 10, id: 0 });
    const b = makeObstacle('rock', circle(3), { x: -60, z: -60, id: 1 });
    const out: Obstacle[] = [];
    const world = buildWorld([a, b]);
    expect(world.obstaclesNear(10, 10, 5, out)).toContain(a);
    expect(out).not.toContain(b);
  });
});
