import { describe, expect, it } from 'vitest';
import { FORD_MARKER_HEIGHT, FORD_MARKER_SETBACK, fordMarkerSegments } from '../src/rendering/fordMarkers';
import type { Ford } from '../src/world/Water';
import { makeRiverWorld } from './waterFixtures';

// The fixture's river flows north to south through x = 0; this ford crosses it east-west.
const world = makeRiverWorld();
const ford: Ford = { id: 0, riverId: 0, x: 0, z: -150, s: 150, tx: 0, tz: 1, halfWidth: 14, halfLength: 10, depth: 0.6 };

/** Vertical segments (the posts) of a flat [x0, y0, z0, x1, y1, z1, ...] list. */
function posts(segments: readonly number[]): number[][] {
  const out: number[][] = [];
  for (let k = 0; k < segments.length; k += 6) {
    const s = segments.slice(k, k + 6);
    if (s[0] === s[3] && s[2] === s[5]) out.push(s);
  }
  return out;
}

describe('fordMarkerSegments', () => {
  const segments = fordMarkerSegments(ford, world);

  it('stands a post on each bank at both ends of the ford', () => {
    const found = posts(segments);
    expect(found).toHaveLength(4);
    const corners = found.map(([x, , z]) => `${Math.round(x!)},${Math.round(z!)}`).sort();
    const reach = ford.halfWidth + FORD_MARKER_SETBACK;
    expect(corners).toEqual([`${-reach},-160`, `${-reach},-140`, `${reach},-160`, `${reach},-140`].sort());
  });

  it('plants each post on the ground and stands it FORD_MARKER_HEIGHT tall', () => {
    for (const [x, y0, z, , y1] of posts(segments)) {
      expect(y0).toBeCloseTo(world.heightAt(x!, z!));
      expect(y1! - y0!).toBeCloseTo(FORD_MARKER_HEIGHT);
    }
  });

  it('flies a pennant from the top of each post, pointing across towards the river', () => {
    // Every non-post segment lies within a metre and a half of a post top, on the river side.
    const tops = posts(segments).map(([x, , z, , y1]) => [x!, y1!, z!] as const);
    for (let k = 0; k < segments.length; k += 6) {
      const s = segments.slice(k, k + 6);
      if (s[0] === s[3] && s[2] === s[5]) continue;
      const top = tops.find(([x, , z]) => Math.hypot(s[0]! - x, s[2]! - z) < 1.6);
      expect(top).toBeDefined();
      expect(Math.abs(s[3]!)).toBeLessThanOrEqual(Math.abs(top![0]) + 1e-9);
      expect(s[1]!).toBeLessThanOrEqual(top![1] + 1e-9);
    }
    expect(segments.length / 6).toBeGreaterThan(4);
  });
});
