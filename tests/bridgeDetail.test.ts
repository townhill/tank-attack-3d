import { describe, expect, it } from 'vitest';
import type { BridgeStyle } from '../src/rendering/bridgeDetail';
import {
  bridgeDetailSegments,
  bridgeStyles,
  CUTWATER_LENGTH,
  DASH_LENGTH,
  DASH_LIFT,
  GIRDER_DEPTH,
  GIRDER_HALF_WEB,
  girderOffsets,
  LAMP_ARM,
  LAMP_HEIGHT,
  pierFootprint,
  RAIL_HEIGHT,
  RAIL_SPACING,
  STIFFENER_SPACING,
  TRUSS_HEIGHT,
  TRUSS_PANEL,
  trussPanelPoints,
} from '../src/rendering/bridgeDetail';
import { DECK_THICKNESS, deckHeightAt, PARAPET_HEIGHT, PARAPET_THICKNESS, PIER_INSET } from '../src/world/Bridge';
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

describe('bridgeStyles', () => {
  it('makes the longest crossing on each river a through truss and the rest plate girders', () => {
    const bridges = [
      makeBridge({ id: 0, riverId: 0, halfSpan: 20 }),
      makeBridge({ id: 1, riverId: 0, halfSpan: 22 }),
      makeBridge({ id: 2, riverId: 0, halfSpan: 19 }),
      makeBridge({ id: 3, riverId: 1, halfSpan: 18 }),
    ];
    expect(bridgeStyles(bridges)).toEqual<BridgeStyle[]>(['girder', 'truss', 'girder', 'truss']);
  });

  it('breaks a tie in favour of the first bridge, so the choice never depends on order of equals', () => {
    const bridges = [makeBridge({ id: 0, halfSpan: 20 }), makeBridge({ id: 1, halfSpan: 20 })];
    expect(bridgeStyles(bridges)).toEqual<BridgeStyle[]>(['truss', 'girder']);
  });
});

describe.each<BridgeStyle>(['girder', 'truss'])('bridgeDetailSegments (%s)', (style) => {
  const bridge = makeBridge({ halfLength: 30, halfSpan: 22, halfWidth: 7, endY: 5, arch: 0.5 });
  const segments = segmentsOf(bridgeDetailSegments(bridge, style));
  const railX = bridge.halfWidth + PARAPET_THICKNESS / 2;
  const onParapet = (s: Segment): boolean => Math.abs(Math.abs(s.x0) - railX) < 1e-9;

  it('comes in whole segments that never leave the deck', () => {
    expect(bridgeDetailSegments(bridge, style).length % 6).toBe(0);
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

  it('leaves headroom for the tallest tank wherever a member crosses over the road', () => {
    for (const s of segments) {
      if (Math.min(Math.abs(s.x0), Math.abs(s.x1)) >= bridge.halfWidth) continue;
      if (Math.max(s.y0, s.y1) <= deckHeightAt(bridge, s.z0) + LAMP_HEIGHT + PARAPET_HEIGHT) continue;
      expect(Math.min(s.y0 - deckHeightAt(bridge, s.z0), s.y1 - deckHeightAt(bridge, s.z1))).toBeGreaterThan(5);
    }
  });
});

describe('truss bridges', () => {
  const bridge = makeBridge({ halfLength: 30, halfSpan: 22, halfWidth: 7, endY: 5, arch: 0.5 });
  const segments = segmentsOf(bridgeDetailSegments(bridge, 'truss'));
  const trussX = bridge.halfWidth + PARAPET_THICKNESS / 2;
  const base = (z: number): number => deckHeightAt(bridge, z) + PARAPET_HEIGHT;
  const points = trussPanelPoints(bridge);

  it('divides the river span into an even number of equal panels', () => {
    const panels = points.length - 1;
    expect(panels % 2).toBe(0);
    expect(panels).toBeGreaterThanOrEqual(4);
    expect(points[0]).toBeCloseTo(-bridge.halfSpan, 9);
    expect(points[panels]).toBeCloseTo(bridge.halfSpan, 9);
    const width = (2 * bridge.halfSpan) / panels;
    expect(width).toBeLessThanOrEqual(TRUSS_PANEL * 1.25);
    for (let k = 1; k <= panels; k++) expect(points[k]! - points[k - 1]!).toBeCloseTo(width, 9);
  });

  it('stands a vertical at every inner panel point on both parapets, the top chord following the arch', () => {
    const verticals = segments.filter((s) => isVertical(s) && Math.abs(Math.abs(s.x0) - trussX) < 1e-9 && Math.abs(height(s) - TRUSS_HEIGHT) < 1e-9);
    expect(verticals).toHaveLength(2 * (points.length - 2));
    for (const s of verticals) {
      expect(Math.min(s.y0, s.y1)).toBeCloseTo(base(s.z0), 9);
      expect(points.slice(1, -1).some((z) => Math.abs(z - s.z0) < 1e-9)).toBe(true);
    }
  });

  it('slopes an end post from each end of the span up to the top chord', () => {
    const first = points[1]!;
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        const z0 = end * bridge.halfSpan;
        const z1 = end * first * -1;
        const post = segments.find((s) => s.x0 === side * trussX && s.x1 === side * trussX && Math.abs(s.z0 - z0) < 1e-9 && Math.abs(s.z1 - z1) < 1e-9);
        expect(post).toBeDefined();
        expect(post!.y0).toBeCloseTo(base(z0), 9);
        expect(post!.y1).toBeCloseTo(base(z1) + TRUSS_HEIGHT, 9);
      }
    }
  });

  it('braces the two trusses together overhead at every inner panel point', () => {
    const struts = segments.filter((s) => s.z0 === s.z1 && Math.abs(s.x0 + s.x1) < 1e-9 && Math.abs(Math.abs(s.x0) - trussX) < 1e-9 && s.y0 === s.y1);
    expect(struts.length).toBeGreaterThanOrEqual(points.length - 2);
    for (const s of struts) expect(s.y0).toBeCloseTo(base(s.z0) + TRUSS_HEIGHT, 9);
  });

  it('keeps the floor stringers under the slab the full length of the deck', () => {
    const under = segments.filter((s) => s.y0 < deckHeightAt(bridge, s.z0) - DECK_THICKNESS);
    expect(new Set(under.map((s) => s.x0)).size).toBe(2);
    let length = 0;
    for (const s of under) length += Math.abs(s.z1 - s.z0);
    expect(length).toBeCloseTo(2 * 2 * bridge.halfLength, 6);
  });
});

describe('girder bridges', () => {
  const bridge = makeBridge({ halfLength: 30, halfSpan: 22, halfWidth: 7, endY: 5, arch: 0.5 });
  const segments = segmentsOf(bridgeDetailSegments(bridge, 'girder'));
  const underside = (z: number): number => deckHeightAt(bridge, z) - DECK_THICKNESS;

  it('carries the deck on a pair of girders that rest on the piers', () => {
    const offsets = girderOffsets(bridge);
    expect(offsets).toHaveLength(2);
    expect(offsets[0]).toBeCloseTo(-offsets[1], 9);
    for (const x of offsets) expect(Math.abs(x)).toBeLessThan(bridge.halfWidth - PIER_INSET);
  });

  it('stiffens both faces of each girder web at regular intervals the full length of the deck', () => {
    for (const x of girderOffsets(bridge)) {
      for (const face of [-1, 1]) {
        // Just proud of the web's face, so the solid web never hides them.
        const stiffeners = segments
          .filter((s) => isVertical(s) && Math.sign(s.x0 - x) === face && Math.abs(s.x0 - x) > GIRDER_HALF_WEB && Math.abs(s.x0 - x) < GIRDER_HALF_WEB + 0.1)
          .sort((a, b) => a.z0 - b.z0);
        expect(stiffeners.length).toBeGreaterThan(2);
        expect(stiffeners[0]!.z0).toBeCloseTo(-bridge.halfLength, 9);
        expect(stiffeners[stiffeners.length - 1]!.z0).toBeCloseTo(bridge.halfLength, 9);
        for (let k = 1; k < stiffeners.length; k++) expect(stiffeners[k]!.z0 - stiffeners[k - 1]!.z0).toBeLessThanOrEqual(STIFFENER_SPACING + 1e-9);
        for (const s of stiffeners) {
          expect(Math.max(s.y0, s.y1)).toBeCloseTo(underside(s.z0), 9);
          expect(height(s)).toBeCloseTo(GIRDER_DEPTH, 9);
        }
      }
    }
  });

  it('draws nothing inside a girder web, where the solid would hide it', () => {
    for (const x of girderOffsets(bridge)) {
      for (const s of segments) {
        const inside = (px: number, py: number, pz: number): boolean =>
          Math.abs(px - x) <= GIRDER_HALF_WEB && py <= underside(pz) + 1e-9 && py >= underside(pz) - GIRDER_DEPTH - 1e-9;
        expect(inside(s.x0, s.y0, s.z0) && inside(s.x1, s.y1, s.z1)).toBe(false);
      }
    }
  });

  it('has no truss above the parapets', () => {
    for (const s of segments) {
      const top = Math.max(s.y0, s.y1) - deckHeightAt(bridge, s.z0);
      expect(top).toBeLessThanOrEqual(PARAPET_HEIGHT + LAMP_HEIGHT + 1e-9);
    }
  });
});
