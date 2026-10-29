import { describe, expect, it } from 'vitest';
import { TANK_SPECS } from '../src/config/settings';
import {
  createBridgeLocal,
  DECK_THICKNESS,
  deckHeightAt,
  isOnDeck,
  kerbPush,
  PARAPET_HEIGHT,
  PARAPET_THICKNESS,
  parapetPush,
  pointInsideBridge,
  segmentVsBridge,
  toBridgeLocal,
} from '../src/world/Bridge';
import { createPushResult, NO_HIT } from '../src/world/Collision';
import { makeBridge } from './waterFixtures';

describe('Bridge local frame and deck profile', () => {
  // Deck axis along X: `along` runs west (towards -X) and `lateral` south (+Z).
  const bridge = makeBridge({ x: 40, z: -10 });

  it('maps world points into deck coordinates', () => {
    const local = toBridgeLocal(bridge, 50, -7, createBridgeLocal());
    expect(local.along).toBeCloseTo(-10, 9);
    expect(local.lateral).toBeCloseTo(3, 9);
  });

  it('has the road at endY at both ends and endY + arch at mid-span', () => {
    expect(deckHeightAt(bridge, 0)).toBeCloseTo(5.5, 9);
    expect(deckHeightAt(bridge, 30)).toBeCloseTo(5, 9);
    expect(deckHeightAt(bridge, -30)).toBeCloseTo(5, 9);
    expect(deckHeightAt(bridge, 12)).toBeCloseTo(deckHeightAt(bridge, -12), 12);
    expect(deckHeightAt(bridge, 12)).toBeGreaterThan(5);
    expect(deckHeightAt(bridge, 12)).toBeLessThan(5.5);
  });

  it('keeps the end height beyond the deck', () => {
    expect(deckHeightAt(bridge, 45)).toBeCloseTo(5, 9);
  });

  it('isOnDeck covers the road between the kerbs, optionally widened', () => {
    const local = createBridgeLocal();
    expect(isOnDeck(bridge, toBridgeLocal(bridge, 40, -10, local))).toBe(true);
    expect(isOnDeck(bridge, toBridgeLocal(bridge, 69, -4, local))).toBe(true);
    expect(isOnDeck(bridge, toBridgeLocal(bridge, 71, -10, local))).toBe(false);
    expect(isOnDeck(bridge, toBridgeLocal(bridge, 40, -2.5, local))).toBe(false);
    expect(isOnDeck(bridge, toBridgeLocal(bridge, 40, -2.5, local), 1)).toBe(true);
  });
});

describe('kerbPush', () => {
  const bridge = makeBridge();
  const radius = TANK_SPECS.standard.collisionRadius;
  const local = createBridgeLocal();
  const push = createPushResult();

  it('pushes a tank that strays towards a kerb back between them', () => {
    toBridgeLocal(bridge, 5, 5, local);
    expect(kerbPush(bridge, local, radius, push)).toBe(true);
    expect(push.depth).toBeCloseTo(5 - (7 - radius), 9);
    expect(push.nx).toBeCloseTo(0, 9);
    expect(push.nz).toBeCloseTo(-1, 9);
  });

  it('leaves a tank alone when its hull clears both kerbs', () => {
    toBridgeLocal(bridge, -15, -3, local);
    expect(kerbPush(bridge, local, radius, push)).toBe(false);
  });

  it('guards the whole deck, where it rests on the banks too, and stops past either end', () => {
    toBridgeLocal(bridge, -(22 + radius + 0.5), 6, local);
    expect(kerbPush(bridge, local, radius, push)).toBe(true);
    toBridgeLocal(bridge, 29.5, 6, local);
    expect(kerbPush(bridge, local, radius, push)).toBe(true);
    toBridgeLocal(bridge, 30.5, 6, local);
    expect(kerbPush(bridge, local, radius, push)).toBe(false);
  });
});

describe('parapetPush', () => {
  const bridge = makeBridge();
  const radius = TANK_SPECS.standard.collisionRadius;
  const local = createBridgeLocal();
  const push = createPushResult();
  const clear = 7 + PARAPET_THICKNESS + radius;

  it('keeps a tank beside the deck outside the parapet', () => {
    toBridgeLocal(bridge, -25, 9, local);
    expect(parapetPush(bridge, local, radius, push)).toBe(true);
    expect(push.depth).toBeCloseTo(clear - 9, 9);
    expect(push.nx).toBeCloseTo(0, 9);
    expect(push.nz).toBeCloseTo(1, 9);
    toBridgeLocal(bridge, 5, -8, local);
    expect(parapetPush(bridge, local, radius, push)).toBe(true);
    expect(push.nz).toBeCloseTo(-1, 9);
  });

  it('leaves tanks clear of the parapet, past the ends or lined up on the road alone', () => {
    toBridgeLocal(bridge, -25, clear + 0.1, local);
    expect(parapetPush(bridge, local, radius, push)).toBe(false);
    toBridgeLocal(bridge, -31, 9, local);
    expect(parapetPush(bridge, local, radius, push)).toBe(false);
    toBridgeLocal(bridge, -29, 4, local);
    expect(parapetPush(bridge, local, radius, push)).toBe(false);
  });
});

describe('Bridge solid volume', () => {
  const bridge = makeBridge();
  const road = deckHeightAt(bridge, 0);

  it('the deck slab is solid just under the road and empty just above it', () => {
    expect(pointInsideBridge(bridge, 0, road - 0.1, 0)).toBe(true);
    expect(pointInsideBridge(bridge, 0, road + 0.1, 0)).toBe(false);
    expect(pointInsideBridge(bridge, 0, road - DECK_THICKNESS - 0.1, 0)).toBe(false);
  });

  it('parapets rise above the road along both edges', () => {
    expect(pointInsideBridge(bridge, 0, road + PARAPET_HEIGHT - 0.1, 7.2)).toBe(true);
    expect(pointInsideBridge(bridge, 0, road + PARAPET_HEIGHT + 0.1, 7.2)).toBe(false);
    expect(pointInsideBridge(bridge, 0, road + 0.5, -7.2)).toBe(true);
  });

  it('piers stand from the riverbed to the underside of the deck', () => {
    // Pier at along = 8 sits at x = -8 for a deck running along X.
    expect(pointInsideBridge(bridge, -8, -3, 0)).toBe(true);
    expect(pointInsideBridge(bridge, -8, -7, 0)).toBe(false);
    expect(pointInsideBridge(bridge, 0, -3, 0)).toBe(false);
  });

  it('a falling shell strikes the road surface', () => {
    const t = segmentVsBridge(3, 20, 1, 3, -20, 1, bridge);
    expect(t).not.toBe(NO_HIT);
    expect(20 - 40 * t).toBeCloseTo(deckHeightAt(bridge, -3), 1);
  });

  it('a shell skimming over the parapets misses', () => {
    expect(segmentVsBridge(-60, road + PARAPET_HEIGHT + 0.6, 0, 60, road + PARAPET_HEIGHT + 0.6, 0, bridge)).toBe(NO_HIT);
  });

  it('a shot along the river under the deck hits a pier', () => {
    const t = segmentVsBridge(-8, -2, -40, -8, -2, 40, bridge);
    expect(t).not.toBe(NO_HIT);
    expect(-40 + 80 * t).toBeCloseTo(-(7 - 1.2), 1);
  });

  it('misses entirely when the segment passes far away', () => {
    expect(segmentVsBridge(0, 3, 100, 10, 3, 120, bridge)).toBe(NO_HIT);
  });
});
