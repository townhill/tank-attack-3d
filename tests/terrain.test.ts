import { describe, expect, it } from 'vitest';
import { WORLD } from '../src/config/settings';
import type { Obstacle, ObstacleShape } from '../src/world/Obstacle';
import { boundRadiusOf, buildingStoreys, STOREY_HEIGHT } from '../src/world/Obstacle';
import { ObstacleGrid } from '../src/world/ObstacleGrid';
import { Terrain } from '../src/world/Terrain';
import { DEFAULT_WORLD_OPTIONS, generateWorld, MAX_BUILDING_SLOPE, worldOptionsFor } from '../src/world/WorldGenerator';
import { Random } from '../src/utils/random';

/** Terrain whose height is the plane `slopeX * x + slopeZ * z`. */
function makeRamp(slopeX: number, slopeZ: number, halfSize = 50, cellSize = 5): Terrain {
  const terrain = new Terrain(halfSize, cellSize);
  for (let j = 0; j < terrain.resolution; j++) {
    for (let i = 0; i < terrain.resolution; i++) {
      terrain.heights[terrain.index(i, j)] = slopeX * terrain.vertexX(i) + slopeZ * terrain.vertexZ(j);
    }
  }
  return terrain;
}

function makeObstacle(id: number, x: number, z: number, shape: ObstacleShape): Obstacle {
  return {
    id,
    kind: shape.type === 'circle' ? 'rock' : 'block',
    x,
    z,
    yaw: 0,
    shape,
    baseY: 0,
    height: 5,
    boundRadius: boundRadiusOf(shape),
    seed: id,
  };
}

describe('Terrain construction and vertex access', () => {
  it('has (2 * halfSize / cellSize + 1) vertices per side', () => {
    const terrain = new Terrain(10, 5);
    expect(terrain.resolution).toBe(5);
    expect(terrain.heights).toHaveLength(25);
  });

  it('rejects a height array of the wrong size', () => {
    expect(() => new Terrain(10, 5, new Float32Array(24))).toThrow(/does not match/);
  });

  it('adopts a height array of the right size without copying', () => {
    const heights = new Float32Array(25).fill(3);
    const terrain = new Terrain(10, 5, heights);
    expect(terrain.heights).toBe(heights);
    expect(terrain.heightAt(1, 1)).toBeCloseTo(3, 6);
  });

  it('places vertices on a regular grid centred on the origin', () => {
    const terrain = new Terrain(10, 5);
    expect(terrain.vertexX(0)).toBe(-10);
    expect(terrain.vertexX(2)).toBe(0);
    expect(terrain.vertexZ(4)).toBe(10);
    expect(terrain.index(3, 2)).toBe(2 * 5 + 3);
  });

  it('clamps vertexHeight lookups outside the grid to the nearest edge vertex', () => {
    const terrain = new Terrain(10, 5);
    terrain.heights[terrain.index(0, 0)] = 7;
    terrain.heights[terrain.index(4, 4)] = 9;
    expect(terrain.vertexHeight(-3, -3)).toBe(7);
    expect(terrain.vertexHeight(9, 9)).toBe(9);
  });

  it('minMax reports the lowest and highest vertex', () => {
    const terrain = new Terrain(10, 5);
    terrain.heights[3] = -4;
    terrain.heights[7] = 12;
    expect(terrain.minMax()).toEqual({ min: -4, max: 12 });
  });
});

describe('Terrain.heightAt', () => {
  it('equals the stored vertex height at every grid point', () => {
    const terrain = new Terrain(10, 5);
    const rng = new Random(3);
    for (let k = 0; k < terrain.heights.length; k++) terrain.heights[k] = rng.range(-10, 10);
    for (let j = 0; j < terrain.resolution; j++) {
      for (let i = 0; i < terrain.resolution; i++) {
        expect(terrain.heightAt(terrain.vertexX(i), terrain.vertexZ(j))).toBeCloseTo(terrain.heights[terrain.index(i, j)]!, 5);
      }
    }
  });

  describe('inside a cell with hand-set heights', () => {
    // Cell (1, 1) spans x in [-5, 0], z in [-5, 0]. Corner heights: h00=1, h10=3, h01=5, h11=4.
    const terrain = new Terrain(10, 5);
    terrain.heights[terrain.index(1, 1)] = 1;
    terrain.heights[terrain.index(2, 1)] = 3;
    terrain.heights[terrain.index(1, 2)] = 5;
    terrain.heights[terrain.index(2, 2)] = 4;
    const at = (fx: number, fz: number): number => terrain.heightAt(-5 + fx * 5, -5 + fz * 5);

    it('uses the (i,j)-(i+1,j+1) diagonal: lower triangle plane when fx >= fz', () => {
      // Plane through (0,0,1), (1,0,3), (1,1,4): h = 1 + 2*fx + 1*fz.
      expect(at(0.5, 0.25)).toBeCloseTo(2.25, 5);
      expect(at(0.9, 0.1)).toBeCloseTo(1 + 2 * 0.9 + 0.1, 5);
    });

    it('uses the upper triangle plane when fx < fz', () => {
      // Plane through (0,0,1), (0,1,5), (1,1,4): h = 1 + 4*fz - 1*fx.
      expect(at(0.25, 0.5)).toBeCloseTo(2.75, 5);
      expect(at(0.1, 0.9)).toBeCloseTo(1 + 4 * 0.9 - 0.1, 5);
    });

    it('is continuous across the diagonal itself', () => {
      expect(at(0.5, 0.5)).toBeCloseTo(2.5, 5);
      expect(at(0.5 + 1e-6, 0.5 - 1e-6)).toBeCloseTo(at(0.5 - 1e-6, 0.5 + 1e-6), 4);
    });

    it('differs from bilinear interpolation, proving the split is rendered-surface exact', () => {
      const bilinear = 0.5 * 0.75 * 1 + 0.5 * 0.75 * 3 + 0.5 * 0.25 * 5 + 0.5 * 0.25 * 4;
      expect(Math.abs(at(0.5, 0.25) - bilinear)).toBeGreaterThan(0.2);
    });
  });

  it('matches an independent barycentric evaluation of the correct triangle', () => {
    const terrain = new Terrain(20, 5);
    const rng = new Random(11);
    for (let k = 0; k < terrain.heights.length; k++) terrain.heights[k] = rng.range(-8, 8);
    for (let n = 0; n < 300; n++) {
      const i = rng.int(0, terrain.resolution - 2);
      const j = rng.int(0, terrain.resolution - 2);
      const fx = rng.next();
      const fz = rng.next();
      const h00 = terrain.heights[terrain.index(i, j)]!;
      const h10 = terrain.heights[terrain.index(i + 1, j)]!;
      const h01 = terrain.heights[terrain.index(i, j + 1)]!;
      const h11 = terrain.heights[terrain.index(i + 1, j + 1)]!;
      // Barycentric weights of the triangle on the point's side of the diagonal.
      const expected =
        fx >= fz
          ? h00 + (fx - fz) * (h10 - h00) + fz * (h11 - h00)
          : h00 + (fz - fx) * (h01 - h00) + fx * (h11 - h00);
      const actual = terrain.heightAt(terrain.vertexX(i) + fx * 5, terrain.vertexZ(j) + fz * 5);
      expect(actual).toBeCloseTo(expected, 4);
    }
  });

  it('reproduces any planar surface exactly', () => {
    const terrain = makeRamp(0.3, -0.2);
    for (const [x, z] of [[1.7, -3.2], [-22.5, 14.1], [40.4, 39.9], [-49.9, -0.01]] as const) {
      expect(terrain.heightAt(x, z)).toBeCloseTo(0.3 * x - 0.2 * z, 4);
    }
  });

  it('clamps queries outside the grid to the edge height', () => {
    const terrain = makeRamp(0.5, 0, 10, 5);
    expect(terrain.heightAt(-100, 0)).toBeCloseTo(terrain.heightAt(-10, 0), 6);
    expect(terrain.heightAt(100, 3)).toBeCloseTo(terrain.heightAt(10, 3), 6);
    expect(terrain.heightAt(100, 100)).toBeCloseTo(terrain.heights[terrain.index(4, 4)]!, 6);
    expect(terrain.heightAt(-1e9, -1e9)).toBeCloseTo(terrain.heights[terrain.index(0, 0)]!, 6);
  });
});

describe('Terrain.sampleField', () => {
  it('interpolates a per-vertex field over exactly the triangles heightAt uses', () => {
    const terrain = new Terrain(50, 5);
    const rng = new Random(11);
    for (let k = 0; k < terrain.heights.length; k++) terrain.heights[k] = rng.range(-6, 6);
    const field = terrain.heights.slice();
    for (let n = 0; n < 200; n++) {
      const x = rng.range(-60, 60);
      const z = rng.range(-60, 60);
      expect(terrain.sampleField(field, x, z)).toBe(terrain.heightAt(x, z));
    }
  });

  it('gives NaN only in triangles that touch a NaN vertex', () => {
    const terrain = new Terrain(50, 5);
    const field = new Float32Array(terrain.heights.length).fill(2);
    field[terrain.index(10, 10)] = Number.NaN;
    expect(terrain.sampleField(field, terrain.vertexX(10) + 1, terrain.vertexZ(10) + 1)).toBeNaN();
    expect(terrain.sampleField(field, terrain.vertexX(12) + 1, terrain.vertexZ(12) + 1)).toBe(2);
  });
});

describe('Terrain normals and slopes', () => {
  const origin = { x: 0, y: 0, z: 0 };

  it('normalAt points straight up on flat ground', () => {
    const terrain = new Terrain(50, 5);
    const n = terrain.normalAt(3, -4, { ...origin });
    expect(n.x).toBeCloseTo(0, 9);
    expect(n.y).toBeCloseTo(1, 9);
    expect(n.z).toBeCloseTo(0, 9);
  });

  it('normalAt writes into and returns the provided object', () => {
    const terrain = new Terrain(50, 5);
    const out = { ...origin };
    expect(terrain.normalAt(0, 0, out)).toBe(out);
  });

  it('normalAt tilts away from the uphill direction on a ramp', () => {
    const terrain = makeRamp(0.5, 0);
    const n = terrain.normalAt(0, 0, { ...origin });
    const len = Math.sqrt(1.25);
    expect(n.x).toBeCloseTo(-0.5 / len, 6);
    expect(n.y).toBeCloseTo(1 / len, 6);
    expect(n.z).toBeCloseTo(0, 6);
  });

  it('normalAt is a unit vector on arbitrary terrain', () => {
    const terrain = new Terrain(50, 5);
    const rng = new Random(5);
    for (let k = 0; k < terrain.heights.length; k++) terrain.heights[k] = rng.range(-6, 6);
    for (let n = 0; n < 100; n++) {
      const v = terrain.normalAt(rng.range(-45, 45), rng.range(-45, 45), { ...origin });
      expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(1, 9);
      expect(v.y).toBeGreaterThan(0);
    }
  });

  it('slopeAt is 0 on flat ground', () => {
    expect(new Terrain(50, 5).slopeAt(7, 7)).toBe(0);
  });

  it('slopeAt returns rise over run on a known ramp', () => {
    expect(makeRamp(0.5, 0).slopeAt(0, 0)).toBeCloseTo(0.5, 6);
    expect(makeRamp(0.3, 0.4).slopeAt(-10, 10)).toBeCloseTo(0.5, 6);
  });

  it('slopeAt honours a custom sample distance', () => {
    expect(makeRamp(0.25, 0).slopeAt(0, 0, 5)).toBeCloseTo(0.25, 6);
  });
});

describe('generateWorld', () => {
  const seedA = 1234;
  const seedB = 4321;
  const worldA = generateWorld(seedA);
  const worldA2 = generateWorld(seedA);
  const worldB = generateWorld(seedB);

  it('is deterministic: the same seed gives identical heights and obstacles', () => {
    expect(worldA2.terrain.heights).toEqual(worldA.terrain.heights);
    expect(worldA2.obstacles).toEqual(worldA.obstacles);
    expect(worldA2.seed).toBe(seedA);
  });

  it('a different seed gives different terrain and obstacles', () => {
    expect(worldB.terrain.heights).not.toEqual(worldA.terrain.heights);
    expect(worldB.obstacles).not.toEqual(worldA.obstacles);
  });

  it('builds the configured terrain and playable square', () => {
    expect(worldA.terrain.halfSize).toBe(WORLD.terrainHalfSize);
    expect(worldA.terrain.cellSize).toBe(WORLD.cellSize);
    expect(worldA.playableHalfSize).toBe(WORLD.playableHalfSize);
  });

  it('places a plausible number of obstacles, all with unique sequential ids', () => {
    const rocks = worldA.obstacles.filter((o) => o.kind === 'rock');
    const structures = worldA.obstacles.length - rocks.length;
    expect(rocks.length).toBeGreaterThan(0);
    expect(rocks.length).toBeLessThanOrEqual(WORLD.rockCount);
    expect(structures).toBeGreaterThan(0);
    expect(structures).toBeLessThanOrEqual(WORLD.structureCount);
    worldA.obstacles.forEach((ob, index) => {
      expect(ob.id).toBe(index);
    });
  });

  describe('buildings', () => {
    const worlds = [worldA, worldB, ...[7, 2024, 99999].map((seed) => generateWorld(seed))];
    const buildings = worlds.flatMap((world) => world.obstacles.filter((o) => o.kind === 'building').map((ob) => ({ world, ob })));

    it('appear on every battlefield', () => {
      for (const world of worlds) expect(world.obstacles.some((o) => o.kind === 'building')).toBe(true);
    });

    it('are boxes two to four whole storeys tall, and all three storey counts occur', () => {
      const counts = new Set<number>();
      for (const { ob } of buildings) {
        expect(ob.shape.type).toBe('box');
        const storeys = buildingStoreys(ob);
        expect(storeys).toBeGreaterThanOrEqual(2);
        expect(storeys).toBeLessThanOrEqual(4);
        expect(ob.height).toBeCloseTo(storeys * STOREY_HEIGHT, 9);
        counts.add(storeys);
      }
      expect([...counts].sort()).toEqual([2, 3, 4]);
    });

    it('stand only on gentle ground so the ground floor is not buried', () => {
      for (const { world, ob } of buildings) {
        expect(world.terrain.slopeAt(ob.x, ob.z)).toBeLessThanOrEqual(MAX_BUILDING_SLOPE);
        for (let a = 0; a < 6; a++) {
          const angle = (a / 6) * Math.PI * 2;
          const x = ob.x + Math.cos(angle) * ob.boundRadius;
          const z = ob.z + Math.sin(angle) * ob.boundRadius;
          expect(world.terrain.slopeAt(x, z)).toBeLessThanOrEqual(MAX_BUILDING_SLOPE);
        }
      }
    });
  });

  it('keeps every obstacle footprint inside the playable square', () => {
    for (const ob of worldA.obstacles) {
      expect(Math.abs(ob.x) + ob.boundRadius).toBeLessThanOrEqual(WORLD.playableHalfSize);
      expect(Math.abs(ob.z) + ob.boundRadius).toBeLessThanOrEqual(WORLD.playableHalfSize);
    }
  });

  it('keeps the spawn clearing free of obstacles', () => {
    for (const ob of worldA.obstacles) {
      expect(Math.hypot(ob.x, ob.z) - ob.boundRadius).toBeGreaterThanOrEqual(WORLD.spawnClearRadius - 1e-9);
    }
  });

  it('never overlaps two obstacle footprints', () => {
    const obs = worldA.obstacles;
    for (let a = 0; a < obs.length; a++) {
      for (let b = a + 1; b < obs.length; b++) {
        const distance = Math.hypot(obs[a]!.x - obs[b]!.x, obs[a]!.z - obs[b]!.z);
        expect(distance).toBeGreaterThanOrEqual(obs[a]!.boundRadius + obs[b]!.boundRadius);
      }
    }
  });

  it('never floats an obstacle above the ground under its centre', () => {
    for (const ob of worldA.obstacles) {
      expect(ob.baseY).toBeLessThanOrEqual(worldA.heightAt(ob.x, ob.z) - 0.4 + 1e-6);
      expect(ob.height).toBeGreaterThan(0);
    }
  });

  it('keeps the player spawn nearly level', () => {
    let worst = 0;
    for (let x = -30; x <= 30; x += 5) {
      for (let z = -30; z <= 30; z += 5) worst = Math.max(worst, Math.abs(worldA.heightAt(x, z)));
    }
    expect(worst).toBeLessThanOrEqual(2.5);
  });

  it('raises a mountain range beyond the playable square', () => {
    for (const [x, z] of [[650, 0], [-650, 0], [0, 650], [0, -650]] as const) {
      expect(worldA.heightAt(x, z)).toBeGreaterThan(25);
    }
  });

  it.each([seedA, 253408])('keeps the banks, levees and bridge approaches a tank can reach no steeper than 0.6 (seed %i)', (seed) => {
    // A fine grid over the carved ground near the water; 253408 has the steepest bank found across 40 seeds.
    const world = seed === seedA ? worldA : generateWorld(seed);
    let maxSlope = 0;
    for (let x = -490; x <= 490; x += 2.5) {
      for (let z = -490; z <= 490; z += 2.5) {
        const clearance = world.water.blockedDistance(x, z);
        if (clearance < 3 || clearance > 40) continue;
        maxSlope = Math.max(maxSlope, world.terrain.slopeAt(x, z));
      }
    }
    expect(maxSlope).toBeLessThan(0.6);
  });

  it.each([seedA, seedB, 99999])('has no slope steeper than 0.6 anywhere a tank can drive (seed %i)', (seed) => {
    const world = seed === seedA ? worldA : seed === seedB ? worldB : generateWorld(seed);
    let maxSlope = 0;
    for (let x = -480; x <= 480; x += 10) {
      for (let z = -480; z <= 480; z += 10) {
        // Deep channels and the ground under bridge spans are closed to tanks; slopeAt samples 2 m either side.
        if (world.water.blockedDistance(x, z) < 3) continue;
        maxSlope = Math.max(maxSlope, world.terrain.slopeAt(x, z));
      }
    }
    expect(maxSlope).toBeLessThan(0.6);
  });

  describe('map sizes', () => {
    const margin = WORLD.terrainHalfSize - WORLD.playableHalfSize;

    it('standard options are the defaults', () => {
      expect(worldOptionsFor('standard')).toEqual(DEFAULT_WORLD_OPTIONS);
    });

    it.each([['large', 2], ['huge', 3]] as const)('%s scales the side length by %i and keeps density and margins', (size, scale) => {
      const opts = worldOptionsFor(size);
      expect(opts.playableHalfSize).toBe(WORLD.playableHalfSize * scale);
      expect(opts.terrainHalfSize).toBe(WORLD.playableHalfSize * scale + margin);
      expect(opts.structureCount).toBe(WORLD.structureCount * scale * scale);
      expect(opts.rockCount).toBe(WORLD.rockCount * scale * scale);
      expect(opts.cellSize).toBe(WORLD.cellSize);
      expect(opts.spawnClearRadius).toBe(WORLD.spawnClearRadius);
      expect(opts.rivers).toBe(WORLD.riverCount * scale);
      expect(opts.lakes).toBe(WORLD.lakeCount * scale * scale);
      expect(opts.ponds).toBe(WORLD.pondCount * scale * scale);
    });

    it('a huge world fills its bigger square with obstacles, all inside it and clear of spawn', () => {
      const opts = worldOptionsFor('huge');
      const huge = generateWorld(seedA, opts);
      expect(huge.playableHalfSize).toBe(opts.playableHalfSize);
      expect(huge.terrain.halfSize).toBe(opts.terrainHalfSize);
      const structures = (w: typeof huge): number => w.obstacles.filter((o) => o.kind !== 'rock').length;
      expect(structures(huge)).toBeGreaterThan(structures(worldA) * 4);
      expect(huge.obstacles.some((o) => Math.abs(o.x) > WORLD.playableHalfSize * 2)).toBe(true);
      for (const ob of huge.obstacles) {
        expect(Math.abs(ob.x) + ob.boundRadius).toBeLessThanOrEqual(opts.playableHalfSize);
        expect(Math.abs(ob.z) + ob.boundRadius).toBeLessThanOrEqual(opts.playableHalfSize);
        expect(Math.hypot(ob.x, ob.z) - ob.boundRadius).toBeGreaterThanOrEqual(opts.spawnClearRadius - 1e-9);
      }
      const edge = opts.playableHalfSize + 150;
      for (const [x, z] of [[edge, 0], [-edge, 0], [0, edge], [0, -edge]] as const) {
        expect(huge.heightAt(x, z)).toBeGreaterThan(25);
      }
    });
  });

  it('honours custom generation options', () => {
    const world = generateWorld(5, {
      terrainHalfSize: 200,
      cellSize: 5,
      playableHalfSize: 150,
      rockCount: 6,
      structureCount: 3,
      spawnClearRadius: 20,
      rivers: 0,
      lakes: 0,
      ponds: 0,
      fords: false,
    });
    expect(world.terrain.halfSize).toBe(200);
    expect(world.playableHalfSize).toBe(150);
    expect(world.obstacles.filter((o) => o.kind === 'rock').length).toBeLessThanOrEqual(6);
    expect(world.obstacles.length - world.obstacles.filter((o) => o.kind === 'rock').length).toBeLessThanOrEqual(3);
    for (const ob of world.obstacles) {
      expect(Math.abs(ob.x)).toBeLessThanOrEqual(125);
      expect(Math.abs(ob.z)).toBeLessThanOrEqual(125);
    }
  });

  it('isInsidePlayable honours the margin', () => {
    expect(worldA.isInsidePlayable(499, -499)).toBe(true);
    expect(worldA.isInsidePlayable(501, 0)).toBe(false);
    expect(worldA.isInsidePlayable(490, 0, 20)).toBe(false);
    expect(worldA.isInsidePlayable(470, 0, 20)).toBe(true);
  });

  it('obstaclesNear never misses an obstacle whose bounding circle touches the query circle', () => {
    const rng = new Random(2);
    const found: Obstacle[] = [];
    for (let n = 0; n < 150; n++) {
      const x = rng.range(-480, 480);
      const z = rng.range(-480, 480);
      const radius = rng.range(5, 120);
      worldA.obstaclesNear(x, z, radius, found);
      const ids = found.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const ob of worldA.obstacles) {
        if (Math.hypot(ob.x - x, ob.z - z) <= radius + ob.boundRadius) expect(ids).toContain(ob.id);
      }
    }
  });
});

describe('ObstacleGrid', () => {
  const wall = makeObstacle(0, 0, 0, { type: 'box', halfX: 45, halfZ: 2 });
  const rock = makeObstacle(1, 60, 60, { type: 'circle', radius: 4 });
  const grid = new ObstacleGrid(100, 10, [wall, rock]);

  it('returns an obstacle that spans many cells exactly once', () => {
    const out: Obstacle[] = [];
    grid.queryRect(-100, -100, 100, 100, out);
    expect(out.filter((o) => o === wall)).toHaveLength(1);
    expect(out.filter((o) => o === rock)).toHaveLength(1);
    expect(out).toHaveLength(2);
  });

  it('returns only nearby obstacles for a small query', () => {
    const out: Obstacle[] = [];
    grid.queryCircle(60, 60, 3, out);
    expect(out).toEqual([rock]);
    grid.queryCircle(-40, 0, 3, out);
    expect(out).toEqual([wall]);
  });

  it('returns nothing for a query in empty space', () => {
    const out: Obstacle[] = [];
    grid.queryCircle(-60, -60, 5, out);
    expect(out).toEqual([]);
  });

  it('clears the output array before filling it', () => {
    const out: Obstacle[] = [rock, rock, wall];
    grid.queryCircle(-60, -60, 5, out);
    expect(out).toHaveLength(0);
  });

  it('querySegment collects obstacles along the segment bounds', () => {
    const out: Obstacle[] = [];
    grid.querySegment(-90, 0, 90, 0, out);
    expect(out).toContain(wall);
    expect(out).not.toContain(rock);
    grid.querySegment(90, 90, 20, 50, out);
    expect(out).toContain(rock);
  });

  it('gives consistent results over repeated queries (dedupe stamps reset each call)', () => {
    const out: Obstacle[] = [];
    for (let n = 0; n < 5; n++) {
      grid.queryRect(-100, -100, 100, 100, out);
      expect(out).toHaveLength(2);
    }
  });

  it('clamps queries that extend beyond the grid', () => {
    const out: Obstacle[] = [];
    grid.queryRect(-1e6, -1e6, 1e6, 1e6, out);
    expect(out).toHaveLength(2);
  });

  it('keeps deduplicating correctly when the stamp counter wraps around', () => {
    const wrapping = new ObstacleGrid(100, 10, [wall, rock]);
    (wrapping as unknown as { stamp: number }).stamp = 0xffffffff;
    const out: Obstacle[] = [];
    wrapping.queryRect(-100, -100, 100, 100, out);
    expect(out).toHaveLength(2);
    wrapping.queryRect(-100, -100, 100, 100, out);
    expect(out).toHaveLength(2);
  });

  it('copes with an empty obstacle list', () => {
    const empty = new ObstacleGrid(100, 10, []);
    const out: Obstacle[] = [wall];
    expect(empty.queryRect(-100, -100, 100, 100, out)).toEqual([]);
  });
});
