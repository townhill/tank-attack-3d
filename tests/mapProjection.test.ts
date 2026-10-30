import { describe, expect, it } from 'vitest';
import { fitScale, formatDistance, gridIndex, gridLabel, MapProjection, niceScaleLength } from '../src/ui/MapProjection';
import { MOUNTAIN_DIM, shadeRelief, WATER_SHADE_DEPTH } from '../src/ui/tacticalData';
import { tacticalTheme } from '../src/ui/tacticalTheme';
import { Terrain } from '../src/world/Terrain';
import { World } from '../src/world/World';
import { makeRiverWorld } from './waterFixtures';

function projection(): MapProjection {
  return new MapProjection(800, 600, 120, -40, 0.75);
}

describe('MapProjection', () => {
  it('maps the view centre to the middle of the canvas', () => {
    const p = projection();
    expect(p.worldToMapX(120)).toBeCloseTo(400);
    expect(p.worldToMapY(-40)).toBeCloseTo(300);
  });

  it('round-trips world and map coordinates', () => {
    const p = projection();
    for (const [x, z] of [[0, 0], [-500, 500], [333.3, -271.9], [720, -720]] as const) {
      expect(p.mapToWorldX(p.worldToMapX(x))).toBeCloseTo(x, 9);
      expect(p.mapToWorldZ(p.worldToMapY(z))).toBeCloseTo(z, 9);
    }
    for (const [px, py] of [[0, 0], [800, 600], [17.5, 432.25]] as const) {
      expect(p.worldToMapX(p.mapToWorldX(px))).toBeCloseTo(px, 9);
      expect(p.worldToMapY(p.mapToWorldZ(py))).toBeCloseTo(py, 9);
    }
  });

  it('is north-up: smaller z is higher on screen and larger x is further right', () => {
    const p = projection();
    expect(p.worldToMapY(-100)).toBeLessThan(p.worldToMapY(100));
    expect(p.worldToMapX(100)).toBeGreaterThan(p.worldToMapX(-100));
  });

  it('applies the scale in pixels per metre', () => {
    const p = new MapProjection(400, 400, 0, 0, 2);
    expect(p.worldToMapX(100) - p.worldToMapX(0)).toBeCloseTo(200);
    expect(p.worldToMapY(50) - p.worldToMapY(0)).toBeCloseTo(100);
  });

  it('rejects a non-positive scale', () => {
    expect(() => new MapProjection(10, 10, 0, 0, 0)).toThrow(RangeError);
    expect(() => new MapProjection(10, 10, 0, 0, Number.NaN)).toThrow(RangeError);
  });

  it('keeps the view centre at the canvas middle after resize', () => {
    const p = projection();
    p.resize(1024, 300);
    expect(p.worldToMapX(120)).toBeCloseTo(512);
    expect(p.worldToMapY(-40)).toBeCloseTo(150);
  });

  it('zoomAt keeps the world point under the cursor fixed', () => {
    const p = projection();
    const px = 610;
    const py = 95;
    const wx = p.mapToWorldX(px);
    const wz = p.mapToWorldZ(py);
    p.zoomAt(px, py, 1.6, 0.1, 2);
    expect(p.scale).toBeCloseTo(1.2);
    expect(p.mapToWorldX(px)).toBeCloseTo(wx, 9);
    expect(p.mapToWorldZ(py)).toBeCloseTo(wz, 9);
  });

  it('zoomAt clamps the scale and still keeps the cursor point fixed', () => {
    const p = projection();
    const wx = p.mapToWorldX(100);
    const wz = p.mapToWorldZ(500);
    p.zoomAt(100, 500, 100, 0.1, 2);
    expect(p.scale).toBe(2);
    expect(p.mapToWorldX(100)).toBeCloseTo(wx, 9);
    expect(p.mapToWorldZ(500)).toBeCloseTo(wz, 9);
    p.zoomAt(100, 500, 1e-6, 0.1, 2);
    expect(p.scale).toBe(0.1);
    expect(p.mapToWorldX(100)).toBeCloseTo(wx, 9);
  });

  it('zoomAt ignores zero, negative and non-finite factors', () => {
    const p = projection();
    for (const factor of [0, -2, Number.NaN, Infinity]) {
      p.zoomAt(10, 10, factor, 0.1, 2);
      expect(p.scale).toBe(0.75);
      expect(p.centerX).toBe(120);
    }
  });

  it('panByPixels moves the content with the drag', () => {
    const p = new MapProjection(400, 400, 0, 0, 0.5);
    const wx = p.mapToWorldX(150);
    const wz = p.mapToWorldZ(220);
    p.panByPixels(50, -30);
    expect(p.centerX).toBeCloseTo(-100);
    expect(p.centerZ).toBeCloseTo(60);
    // The world point that was under (150, 220) is now under (200, 190).
    expect(p.mapToWorldX(200)).toBeCloseTo(wx);
    expect(p.mapToWorldZ(190)).toBeCloseTo(wz);
  });

  it('clampCenter keeps the centre within the limit on both axes', () => {
    const p = new MapProjection(400, 400, 900, -1200, 1);
    p.clampCenter(720);
    expect(p.centerX).toBe(720);
    expect(p.centerZ).toBe(-720);
    p.centerX = 15;
    p.centerZ = -30;
    p.clampCenter(720);
    expect(p.centerX).toBe(15);
    expect(p.centerZ).toBe(-30);
  });
});

describe('fitScale', () => {
  it('fits the square in the smaller viewport dimension after padding', () => {
    expect(fitScale(1200, 800, 500, 0)).toBeCloseTo(0.8);
    expect(fitScale(1200, 800, 500, 50)).toBeCloseTo(0.7);
  });

  it('stays positive for degenerate input', () => {
    expect(fitScale(0, 0, 500, 10)).toBeGreaterThan(0);
    expect(fitScale(100, 100, 0)).toBeGreaterThan(0);
  });
});

describe('gridLabel', () => {
  it('labels the corners A1, J1, A10 and J10', () => {
    expect(gridLabel(-500, -500, 500)).toBe('A1');
    expect(gridLabel(499.9, -500, 500)).toBe('J1');
    expect(gridLabel(-500, 499.9, 500)).toBe('A10');
    expect(gridLabel(500, 500, 500)).toBe('J10');
  });

  it('labels the centre and interior cells', () => {
    expect(gridLabel(0, 0, 500)).toBe('F6');
    expect(gridLabel(-0.01, -0.01, 500)).toBe('E5');
    expect(gridLabel(-250, 150, 500)).toBe('C7');
  });

  it('clamps out-of-range positions to the edge cell', () => {
    expect(gridLabel(-900, 2000, 500)).toBe('A10');
    expect(gridLabel(10_000, -10_000, 500)).toBe('J1');
    expect(gridLabel(Number.NaN, 0, 500)).toBe('A6');
  });

  it('supports other division counts', () => {
    expect(gridLabel(0, 0, 500, 4)).toBe('C3');
    expect(gridLabel(-500, -500, 500, 4)).toBe('A1');
    expect(gridIndex(499, 500, 4)).toBe(3);
  });
});

describe('niceScaleLength', () => {
  it('picks the largest 1/2/5 x 10^n length that fits', () => {
    expect(niceScaleLength(1, 150)).toBe(100);
    expect(niceScaleLength(1, 250)).toBe(200);
    expect(niceScaleLength(1, 600)).toBe(500);
    expect(niceScaleLength(0.1, 150)).toBe(1000);
    expect(niceScaleLength(2, 150)).toBe(50);
    expect(niceScaleLength(10, 15)).toBe(1);
    expect(niceScaleLength(100, 30)).toBeCloseTo(0.2);
  });

  it('accepts lengths exactly at the limit', () => {
    expect(niceScaleLength(1, 1000)).toBe(1000);
    expect(niceScaleLength(0.5, 100)).toBe(200);
  });

  it('never exceeds maxPixels and is at least 40% of it', () => {
    for (let scale = 0.05; scale < 4; scale *= 1.37) {
      for (const maxPixels of [60, 97, 150, 333]) {
        const metres = niceScaleLength(scale, maxPixels);
        expect(metres * scale).toBeLessThanOrEqual(maxPixels + 1e-9);
        expect(metres * scale).toBeGreaterThanOrEqual(maxPixels * 0.4);
      }
    }
  });

  it('returns 0 for invalid input', () => {
    expect(niceScaleLength(0, 100)).toBe(0);
    expect(niceScaleLength(1, 0)).toBe(0);
    expect(niceScaleLength(Number.NaN, 100)).toBe(0);
  });
});

describe('formatDistance', () => {
  it('uses metres below a kilometre and kilometres above', () => {
    expect(formatDistance(250)).toBe('250 m');
    expect(formatDistance(1000)).toBe('1 km');
    expect(formatDistance(1500)).toBe('1.5 km');
    expect(formatDistance(0.5)).toBe('0.5 m');
  });
});

describe('shadeRelief', () => {
  const theme = tacticalTheme('neon');

  function makeWorld(height: (x: number) => number): World {
    const terrain = new Terrain(100, 5);
    for (let j = 0; j < terrain.resolution; j++) {
      for (let i = 0; i < terrain.resolution; i++) terrain.heights[terrain.index(i, j)] = height(terrain.vertexX(i));
    }
    return new World(1, terrain, [], 80);
  }

  function pixel(data: Uint8ClampedArray, size: number, i: number, j: number): number[] {
    const o = (j * size + i) * 4;
    return [data[o]!, data[o + 1]!, data[o + 2]!, data[o + 3]!];
  }

  it('produces opaque size x size RGBA pixels', () => {
    const data = shadeRelief(makeWorld(() => 0), theme, 40);
    expect(data.length).toBe(40 * 40 * 4);
    for (let o = 3; o < data.length; o += 4) expect(data[o]).toBe(255);
  });

  it('tints flat playable ground with the low colour and dims hatched mountains outside', () => {
    const size = 100;
    const data = shadeRelief(makeWorld(() => 0), theme, size);
    const expectRgb = (actual: number[], expected: readonly number[]): void => {
      for (let c = 0; c < 3; c++) expect(Math.abs(actual[c]! - expected[c]!)).toBeLessThanOrEqual(1);
    };
    expectRgb(pixel(data, size, 50, 50), theme.terrainLow);
    const outside = pixel(data, size, 1, 3);
    expectRgb(outside, theme.mountain.map((c) => c * 0.75));
    const hatched = pixel(data, size, 3, 4);
    expect(hatched[2]!).toBeLessThan(outside[2]!);
  });

  it('draws contour lines every 5 m inside the playable square', () => {
    const size = 100;
    // Slope of 0.1 m per metre eastwards: contours at x = -50, 0 and 50.
    const data = shadeRelief(makeWorld((x) => 0.1 * x), theme, size);
    const row = 50;
    const jumps: number[] = [];
    for (let i = 1; i < size; i++) {
      if (pixel(data, size, i, row)[1]! - pixel(data, size, i - 1, row)[1]! > 20) jumps.push(i);
    }
    expect(jumps).toEqual([24, 49, 74]);
  });
});

describe('shadeRelief with water', () => {
  // The river runs north-south through x = 0 and is 3.2 m deep on its centreline.
  const world = makeRiverWorld();
  const size = 120;
  const half = world.terrain.halfSize;
  const column = (x: number): number => Math.floor(((x + half) / (2 * half)) * size);
  const rgb = (data: Uint8ClampedArray, i: number, j: number): number[] => {
    const o = (j * size + i) * 4;
    return [data[o]!, data[o + 1]!, data[o + 2]!];
  };

  it.each(['classic', 'neon', 'hybrid'] as const)('fills the river with the shallow-to-deep colour for its depth, without hill shading (%s)', (mode) => {
    const theme = tacticalTheme(mode);
    const data = shadeRelief(world, theme, size);
    const centre = rgb(data, column(0), 61);
    const depth = world.water.depthAt(-half + ((column(0) + 0.5) * 2 * half) / size, -half + (61.5 * 2 * half) / size);
    const t = Math.min(1, depth / WATER_SHADE_DEPTH);
    for (let c = 0; c < 3; c++) {
      const expected = theme.waterShallow[c]! + (theme.waterDeep[c]! - theme.waterShallow[c]!) * t;
      expect(Math.abs(centre[c]! - expected)).toBeLessThanOrEqual(2);
    }
  });

  it('outlines the shore brighter than both the water and the land beside it', () => {
    const theme = tacticalTheme('neon');
    const data = shadeRelief(world, theme, size);
    const row = 61;
    let shoreline = -1;
    for (let i = column(-40); i < column(0); i++) {
      if (world.water.depthAt(-half + ((i + 0.5) * 2 * half) / size, -half + ((row + 0.5) * 2 * half) / size) > 0) {
        shoreline = i;
        break;
      }
    }
    expect(shoreline).toBeGreaterThan(0);
    const brightness = (p: number[]): number => p[0]! + p[1]! + p[2]!;
    expect(brightness(rgb(data, shoreline, row))).toBeGreaterThan(brightness(rgb(data, shoreline - 2, row)));
    expect(brightness(rgb(data, shoreline, row))).toBeGreaterThan(brightness(rgb(data, column(0), row)));
  });

  it('hatches every fourth row of water so it reads without colour, even in the green-only Classic theme', () => {
    const data = shadeRelief(world, tacticalTheme('classic'), size);
    const green = (j: number): number => rgb(data, column(0), j)[1]!;
    // Rows 56 and 60 are hatch lines; the rows between are plain water of the same depth.
    expect(Math.abs(green(57) - green(59))).toBeLessThanOrEqual(1);
    expect(green(56) - green(57)).toBeGreaterThan(30);
    expect(green(60) - green(59)).toBeGreaterThan(30);
  });

  it('dims water beyond the playable square like the mountains around it', () => {
    const theme = tacticalTheme('neon');
    const data = shadeRelief(world, theme, size);
    const step = (2 * half) / size;
    const depth = (j: number): number => world.water.depthAt(-half + (column(0) + 0.5) * step, -half + (j + 0.5) * step);
    // Row 61 is inside the playable square, row 115 beyond it; neither is a hatch line.
    expect(depth(115)).toBeCloseTo(depth(61), 2);
    const inside = rgb(data, column(0), 61);
    const outside = rgb(data, column(0), 115);
    for (let c = 0; c < 3; c++) expect(Math.abs(outside[c]! - inside[c]! * MOUNTAIN_DIM)).toBeLessThanOrEqual(1);
  });

  it('leaves dry ground exactly as the same terrain without its water', () => {
    const theme = tacticalTheme('neon');
    const dry = shadeRelief(new World(1, world.terrain, [], 250), theme, size);
    const wet = shadeRelief(world, theme, size);
    for (const x of [-150, -60, 60, 150]) expect(rgb(wet, column(x), 30)).toEqual(rgb(dry, column(x), 30));
  });
});
