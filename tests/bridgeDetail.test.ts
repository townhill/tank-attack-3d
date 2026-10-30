import { describe, expect, it } from 'vitest';
import {
  bridgeDetailSegments,
  CUTWATER_LENGTH,
  DASH_LENGTH,
  DASH_LIFT,
  LAMP_ARM,
  LAMP_HEIGHT,
  pierFootprint,
  RAIL_HEIGHT,
  RAIL_SPACING,
} from '../src/rendering/bridgeDetail';
import { DECK_THICKNESS, deckHeightAt, PARAPET_HEIGHT, PARAPET_THICKNESS } from '../src/world/Bridge';
import { makeBridge } from './waterFixtures';

interface Segment {
  readonly x0: number;
  readonly y0: number;
  readonly z0: number;
  readonly x1: number;
  readonly y1: number;
  readonly z1: number;
}

function segmentsOf(values: readonly number[]): Segment[] {
  const out: Segment[] = [];
  for (let k = 0; k < values.length; k += 6) {
    out.push({ x0: values[k]!, y0: values[k + 1]!, z0: values[k + 2]!, x1: values[k + 3]!, y1: values[k + 4]!, z1: values[k + 5]! });
  }
  return out;
}

const isVertical = (s: Segment): boolean => s.x0 === s.x1 && s.z0 === s.z1 && s.y0 !== s.y1;
const height = (s: Segment): number => Math.abs(s.y1 - s.y0);

describe('pierFootprint', () => {
  it('is a hexagon pointed across the deck that stays inside the pier box', () => {
    const points = pierFootprint(5.8, 0.9);
    expect(points).toHaveLength(6);
    for (const [x, z] of points) {
      expect(Math.abs(x)).toBeLessThanOrEqual(5.8 + 1e-9);
      expect(Math.abs(z)).toBeLessThanOrEqual(0.9 + 1e-9);
    }
    const noses = points.filter(([, z]) => z === 0);
    expect(noses.map(([x]) => x).sort((a, b) => a - b)).toEqual([-5.8, 5.8]);
    expect(points[1]![0]).toBeCloseTo(-5.8 + CUTWATER_LENGTH, 9);
  });

  it('shortens the noses on a narrow pier so the body keeps its thickness', () => {
    const points = pierFootprint(2, 0.9);
    expect(points[1]![0]).toBeCloseTo(-2 + 0.9, 9);
  });
});

describe('bridgeDetailSegments', () => {
  const bridge = makeBridge({ halfLength: 30, halfWidth: 7, endY: 5, arch: 0.5 });
  const segments = segmentsOf(bridgeDetailSegments(bridge));
  const railX = bridge.halfWidth + PARAPET_THICKNESS / 2;
  const onParapet = (s: Segment): boolean => Math.abs(Math.abs(s.x0) - railX) < 1e-9;

  it('comes in whole segments that never leave the deck', () => {
    expect(bridgeDetailSegments(bridge).length % 6).toBe(0);
    for (const s of segments) {
      for (const z of [s.z0, s.z1]) expect(Math.abs(z)).toBeLessThanOrEqual(bridge.halfLength + 1e-9);
      for (const x of [s.x0, s.x1]) expect(Math.abs(x)).toBeLessThanOrEqual(bridge.halfWidth + PARAPET_THICKNESS + 1e-9);
    }
  });

  it('stands evenly spaced railing posts on both parapets, with one at each end', () => {
    const posts = segments.filter((s) => isVertical(s) && onParapet(s) && Math.abs(height(s) - RAIL_HEIGHT) < 1e-9);
    const perSide = Math.floor((2 * bridge.halfLength) / RAIL_SPACING) + 1;
    expect(posts).toHaveLength(2 * perSide);
    const zs = posts.filter((s) => s.x0 > 0).map((s) => s.z0).sort((a, b) => a - b);
    expect(zs[0]).toBeCloseTo(-bridge.halfLength, 9);
    expect(zs[zs.length - 1]).toBeCloseTo(bridge.halfLength, 9);
    for (const s of posts) expect(s.y0).toBeCloseTo(deckHeightAt(bridge, s.z0) + PARAPET_HEIGHT, 9);
  });

  it('joins the post tops with a rail that follows the arch', () => {
    const rails = segments.filter((s) => !isVertical(s) && onParapet(s) && s.x0 === s.x1 && Math.abs(s.y0 - deckHeightAt(bridge, s.z0) - PARAPET_HEIGHT - RAIL_HEIGHT) < 1e-9);
    expect(rails).toHaveLength(2 * Math.floor((2 * bridge.halfLength) / RAIL_SPACING));
    for (const s of rails) expect(s.y1).toBeCloseTo(deckHeightAt(bridge, s.z1) + PARAPET_HEIGHT + RAIL_HEIGHT, 9);
  });

  it('puts a lamp post with an arm over the road at each corner', () => {
    const posts = segments.filter((s) => isVertical(s) && onParapet(s) && Math.abs(height(s) - LAMP_HEIGHT) < 1e-9);
    expect(posts).toHaveLength(4);
    const corners = new Set(posts.map((s) => `${Math.sign(s.x0)}:${Math.sign(s.z0)}`));
    expect(corners.size).toBe(4);
    for (const post of posts) {
      const arm = segments.find((s) => s.x0 === post.x0 && s.y0 === post.y1 && s.z0 === post.z0 && s.y1 === post.y1 && s.x1 !== s.x0);
      expect(arm).toBeDefined();
      expect(Math.abs(arm!.x1)).toBeCloseTo(railX - LAMP_ARM, 9);
    }
  });

  it('dashes the centreline just above the road', () => {
    const dashes = segments.filter((s) => s.x0 === 0 && s.x1 === 0);
    expect(dashes.length).toBeGreaterThan(5);
    for (const s of dashes) {
      expect(Math.abs(s.z1 - s.z0)).toBeCloseTo(DASH_LENGTH, 9);
      expect(s.y0).toBeCloseTo(deckHeightAt(bridge, s.z0) + DASH_LIFT, 9);
      expect(s.y1).toBeCloseTo(deckHeightAt(bridge, s.z1) + DASH_LIFT, 9);
    }
  });

  it('hangs stringers under the slab the full length of the deck', () => {
    const under = segments.filter((s) => s.y0 < deckHeightAt(bridge, s.z0) - DECK_THICKNESS);
    expect(under.length).toBeGreaterThan(0);
    const xs = new Set(under.map((s) => s.x0));
    expect(xs.size).toBe(2);
    let length = 0;
    for (const s of under) length += Math.abs(s.z1 - s.z0);
    expect(length).toBeCloseTo(2 * 2 * bridge.halfLength, 6);
  });
});
