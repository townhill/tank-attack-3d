import { describe, expect, it } from 'vitest';
import { MapProjection } from '../src/ui/MapProjection';
import { drawBridgeSymbol, drawFordSymbol, tacticalTheme } from '../src/ui/tacticalTheme';
import { drawMapBridges, drawMapFords, fordSignAngle, ShorelineIndex } from '../src/ui/tacticalWater';
import { PARAPET_THICKNESS } from '../src/world/Bridge';
import { shorelineSegments } from '../src/world/shoreline';
import { Terrain } from '../src/world/Terrain';
import type { Ford } from '../src/world/Water';
import { World } from '../src/world/World';
import { generateWorld } from '../src/world/WorldGenerator';
import { makeRiverWorld } from './waterFixtures';

interface Recording {
  readonly ctx: CanvasRenderingContext2D;
  /** Points of each filled and each stroked path, as flat [x, y, ...]. */
  readonly fills: number[][];
  readonly strokes: number[][];
  /** Line dash in force at each stroke. */
  readonly dashes: number[][];
}

/** A stand-in 2D context that records the points of the paths it fills and strokes. */
function recordingContext(): Recording {
  let path: number[] = [];
  let dash: number[] = [];
  const fills: number[][] = [];
  const strokes: number[][] = [];
  const dashes: number[][] = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath: (): void => {
      path = [];
    },
    moveTo: (x: number, y: number): void => {
      path.push(x, y);
    },
    lineTo: (x: number, y: number): void => {
      path.push(x, y);
    },
    closePath: (): void => undefined,
    fill: (): void => {
      fills.push(path);
    },
    stroke: (): void => {
      strokes.push(path);
      dashes.push(dash);
    },
    setLineDash: (segments: number[]): void => {
      dash = segments;
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, strokes, dashes };
}

interface Extent {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function extent(points: readonly number[]): Extent {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let k = 0; k < points.length; k += 2) {
    minX = Math.min(minX, points[k]!);
    maxX = Math.max(maxX, points[k]!);
    minY = Math.min(minY, points[k + 1]!);
    maxY = Math.max(maxY, points[k + 1]!);
  }
  return { minX, maxX, minY, maxY };
}

function expectExtent(actual: Extent, expected: Extent): void {
  expect(actual.minX).toBeCloseTo(expected.minX);
  expect(actual.maxX).toBeCloseTo(expected.maxX);
  expect(actual.minY).toBeCloseTo(expected.minY);
  expect(actual.maxY).toBeCloseTo(expected.maxY);
}

const segmentKey = (x0: number, z0: number, x1: number, z1: number): string => `${x0},${z0},${x1},${z1}`;

/**
 * Queries `world`'s shoreline index all over (and beyond) the terrain and
 * compares each answer with a brute-force scan of every shoreline segment.
 */
function compareWithBruteForce(world: World): { found: number; missing: number; unknown: number; duplicates: number } {
  const index = new ShorelineIndex(world);
  const all = shorelineSegments(world.terrain, world.water.level, 0);
  const known = new Set<string>();
  for (let k = 0; k < all.length; k += 6) known.add(segmentKey(all[k]!, all[k + 2]!, all[k + 3]!, all[k + 5]!));
  const half = world.terrain.halfSize;
  const out: number[] = [];
  const tally = { found: 0, missing: 0, unknown: 0, duplicates: 0 };
  // Centres from beyond the west and north edges to beyond the east and south ones.
  for (const fx of [-1.2, -0.55, -0.1, 0.3, 0.75, 1.15]) {
    for (const fz of [-1.15, -0.6, 0, 0.45, 0.9, 1.2]) {
      for (const radius of [30, 140, 420]) {
        const x = fx * half;
        const z = fz * half;
        index.query(x, z, radius, out);
        const found = new Set<string>();
        for (let n = 0; n < out.length; n += 4) {
          const key = segmentKey(out[n]!, out[n + 1]!, out[n + 2]!, out[n + 3]!);
          if (!known.has(key)) tally.unknown++;
          if (found.has(key)) tally.duplicates++;
          found.add(key);
        }
        for (let k = 0; k < all.length; k += 6) {
          const inside = Math.hypot(all[k]! - x, all[k + 2]! - z) <= radius && Math.hypot(all[k + 3]! - x, all[k + 5]! - z) <= radius;
          if (!inside) continue;
          tally.found++;
          if (!found.has(segmentKey(all[k]!, all[k + 2]!, all[k + 3]!, all[k + 5]!))) tally.missing++;
        }
      }
    }
  }
  return tally;
}

describe('ShorelineIndex', () => {
  const index = new ShorelineIndex(makeRiverWorld());
  const out: number[] = [];

  it('finds the river banks near a point beside the river, as flat x/z segment pairs', () => {
    index.query(-40, 100, 60, out);
    expect(out.length).toBeGreaterThan(0);
    expect(out.length % 4).toBe(0);
    for (let k = 0; k < out.length; k += 2) {
      expect(Math.abs(out[k]!)).toBeGreaterThan(10);
      expect(Math.abs(out[k]!)).toBeLessThan(20);
    }
  });

  it('finds nothing far from any water', () => {
    expect(index.query(-220, 100, 60, out)).toBe(out);
    expect(out).toEqual([]);
  });

  it('is empty on a dry battlefield', () => {
    const dry = new ShorelineIndex(new World(1, new Terrain(100, 5), [], 80));
    expect(dry.query(0, 0, 500, out)).toEqual([]);
  });

  it.each([
    ['a straight river', makeRiverWorld()],
    ['a generated battlefield with a river and lakes', generateWorld(2)],
  ])('returns every shoreline segment within the radius exactly once, and nothing made up (%s)', (_, world) => {
    const tally = compareWithBruteForce(world);
    expect(tally.found).toBeGreaterThan(100);
    expect(tally).toEqual({ found: tally.found, missing: 0, unknown: 0, duplicates: 0 });
  });
});

describe('drawBridgeSymbol', () => {
  const theme = tacticalTheme('neon');
  // Half length 20 px, half width 4 px: the kerbs flare out by 0.7 x 4 = 2.8 px.
  const flare = 2.8;

  it('stands a bridge with heading 0 (deck along the Z axis) upright, kerbs flared at both ends', () => {
    const { ctx, fills, strokes } = recordingContext();
    drawBridgeSymbol(ctx, theme, 100, 50, 20, 4, 0);
    expect(fills).toHaveLength(1);
    expect(strokes).toHaveLength(1);
    expectExtent(extent(fills[0]!), { minX: 96, maxX: 104, minY: 30, maxY: 70 });
    expectExtent(extent(strokes[0]!), { minX: 96 - flare, maxX: 104 + flare, minY: 30 - flare, maxY: 70 + flare });
  });

  it('turns with the angle: a quarter turn lays it across the screen', () => {
    const { ctx, fills, strokes } = recordingContext();
    drawBridgeSymbol(ctx, theme, 100, 50, 20, 4, Math.PI / 2);
    expectExtent(extent(fills[0]!), { minX: 80, maxX: 120, minY: 46, maxY: 54 });
    expectExtent(extent(strokes[0]!), { minX: 80 - flare, maxX: 120 + flare, minY: 46 - flare, maxY: 54 + flare });
  });
});

describe('drawMapBridges', () => {
  const theme = tacticalTheme('classic');
  // One bridge crossing the north-south river east-west.
  const world = makeRiverWorld();
  const bridge = world.bridges[0]!;

  it('draws the bridge at its map position, across the river, to scale', () => {
    const { ctx, fills } = recordingContext();
    drawMapBridges(ctx, theme, world, new MapProjection(800, 600, bridge.x, bridge.z, 2), 40);
    expect(fills).toHaveLength(1);
    const deck = extent(fills[0]!);
    expect((deck.minX + deck.maxX) / 2).toBeCloseTo(400);
    expect((deck.minY + deck.maxY) / 2).toBeCloseTo(300);
    expect(deck.maxX - deck.minX).toBeCloseTo(2 * bridge.halfLength * 2);
    expect(deck.maxY - deck.minY).toBeCloseTo(2 * (bridge.halfWidth + PARAPET_THICKNESS) * 2);
  });

  it('keeps the sign readable when zoomed far out', () => {
    const { ctx, fills } = recordingContext();
    drawMapBridges(ctx, theme, world, new MapProjection(800, 600, bridge.x, bridge.z, 0.01), 40);
    const deck = extent(fills[0]!);
    expect(deck.maxX - deck.minX).toBeCloseTo(10);
    expect(deck.maxY - deck.minY).toBeCloseTo(4);
  });

  it('skips bridges well outside the view', () => {
    const { ctx, fills } = recordingContext();
    drawMapBridges(ctx, theme, world, new MapProjection(800, 600, bridge.x + 2000, bridge.z, 2), 40);
    expect(fills).toHaveLength(0);
  });
});

describe('drawFordSymbol', () => {
  const theme = tacticalTheme('neon');

  it('marks the crossing with two dashed lines across the river, then clears the dash', () => {
    const { ctx, fills, strokes, dashes } = recordingContext();
    // A ford crossing east-west (a quarter turn): lines 20 px long either side, 4 px up and down stream.
    drawFordSymbol(ctx, theme, 100, 50, 20, 4, Math.PI / 2);
    expect(fills).toHaveLength(0);
    expect(strokes).toHaveLength(1);
    expect(dashes[0]!.length).toBeGreaterThan(0);
    expectExtent(extent(strokes[0]!), { minX: 80, maxX: 120, minY: 46, maxY: 54 });
    const ys = strokes[0]!.filter((_, k) => k % 2 === 1);
    expect(new Set(ys.map((y) => Math.round(y)))).toEqual(new Set([46, 54]));
    ctx.stroke();
    expect(dashes[1]).toEqual([]);
  });

  it('turns with the angle: unturned it stands upright', () => {
    const { ctx, strokes } = recordingContext();
    drawFordSymbol(ctx, theme, 100, 50, 20, 4, 0);
    expectExtent(extent(strokes[0]!), { minX: 96, maxX: 104, minY: 30, maxY: 70 });
  });
});

describe('drawMapFords', () => {
  const theme = tacticalTheme('hybrid');
  const river = makeRiverWorld();
  // A ford on the north-south river: the crossing runs east-west.
  const ford: Ford = { id: 0, riverId: 0, x: 0, z: -150, s: 150, tx: 0, tz: 1, halfWidth: 14, halfLength: 10, depth: 0.6 };
  const world = new World(river.seed, river.terrain, [], river.playableHalfSize, { water: river.water, rivers: river.rivers, lakes: [], bridges: [], fords: [ford] });

  it('draws the ford sign across the river at its map position, to scale', () => {
    const { ctx, strokes } = recordingContext();
    drawMapFords(ctx, theme, world, new MapProjection(800, 600, ford.x, ford.z, 2), 40);
    expect(strokes).toHaveLength(1);
    const sign = extent(strokes[0]!);
    expect((sign.minX + sign.maxX) / 2).toBeCloseTo(400);
    expect((sign.minY + sign.maxY) / 2).toBeCloseTo(300);
    expect(sign.maxX - sign.minX).toBeGreaterThan(2 * ford.halfWidth * 2);
    expect(sign.maxY - sign.minY).toBeCloseTo(2 * ford.halfLength * 2);
  });

  it('keeps the sign readable when zoomed far out, and skips fords outside the view', () => {
    const far = recordingContext();
    drawMapFords(far.ctx, theme, world, new MapProjection(800, 600, ford.x, ford.z, 0.01), 40);
    const sign = extent(far.strokes[0]!);
    expect(sign.maxX - sign.minX).toBeCloseTo(10);
    expect(sign.maxY - sign.minY).toBeCloseTo(4);
    const away = recordingContext();
    drawMapFords(away.ctx, theme, world, new MapProjection(800, 600, ford.x + 2000, ford.z, 2), 40);
    expect(away.strokes).toHaveLength(0);
  });

  it('turns the sign square to the flow', () => {
    // Flowing south, the crossing runs east-west: a quarter turn, like a bridge deck along X.
    expect(Math.abs(fordSignAngle(ford))).toBeCloseTo(Math.PI / 2);
    expect(Math.abs(fordSignAngle({ ...ford, tx: 1, tz: 0 }))).toBeCloseTo(Math.PI);
  });

  it('draws nothing on a battlefield without fords', () => {
    const { ctx, strokes } = recordingContext();
    drawMapFords(ctx, theme, river, new MapProjection(800, 600, 0, 0, 2), 40);
    expect(strokes).toHaveLength(0);
  });
});
