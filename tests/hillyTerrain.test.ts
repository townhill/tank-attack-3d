import { beforeAll, describe, expect, it } from 'vitest';
import type { TerrainType } from '../src/config/settings';
import type { World } from '../src/world/World';
import { generateWorld, worldOptionsFor } from '../src/world/WorldGenerator';
import type { BattlefieldSurvey } from './battlefieldSurvey';
import { surveyBattlefield } from './battlefieldSurvey';
import { worldFingerprint } from './worldFingerprint';

const SEEDS = [1, 42, 2026];
/** PRD cover target: Hilly hides at least this multiple of what Gentle hides. */
const COVER_TARGET_RATIO = 1.5;
/**
 * Guardrails from the M1 plan (PRD open question 1). The steep limit was raised from 5% to 7% to meet
 * the cover target, and the spawnable floor lowered from 75% to 70% because carved shores are steeper
 * in hilly ground; making water fit Hilly is milestone 2.
 */
const MAX_STEEP_SHARE = 0.07;
const MIN_SPAWNABLE_SHARE = 0.7;
const MIN_OBSTACLE_RATIO = 0.85;
/** The player's spawn stays level: no slope steeper than this within 30 m of the centre. */
const MAX_SPAWN_SLOPE = 0.1;
const SPAWN_RADIUS = 30;

interface Sample {
  readonly world: World;
  readonly survey: BattlefieldSurvey;
}

function sample(terrain: TerrainType): Sample[] {
  return SEEDS.map((seed) => {
    const world = generateWorld(seed, worldOptionsFor('standard', false, terrain));
    return { world, survey: surveyBattlefield(world, seed) };
  });
}

function meanOf(samples: readonly Sample[], pick: (s: BattlefieldSurvey) => number): number {
  return samples.reduce((sum, s) => sum + pick(s.survey), 0) / samples.length;
}

function maxSlopeNearCentre(world: World): number {
  let max = 0;
  for (let z = -SPAWN_RADIUS; z <= SPAWN_RADIUS; z += 5) {
    for (let x = -SPAWN_RADIUS; x <= SPAWN_RADIUS; x += 5) {
      if (Math.hypot(x, z) <= SPAWN_RADIUS) max = Math.max(max, world.terrain.slopeAt(x, z, 3));
    }
  }
  return max;
}

describe('Hilly terrain', () => {
  let gentle: Sample[] = [];
  let hilly: Sample[] = [];

  beforeAll(() => {
    gentle = sample('gentle');
    hilly = sample('hilly');
  });

  it('has at least twice the relief of Gentle', () => {
    expect(meanOf(hilly, (s) => s.relief)).toBeGreaterThanOrEqual(2 * meanOf(gentle, (s) => s.relief));
  });

  it('hides at least 1.5 times as much of the battlefield as Gentle', () => {
    expect(meanOf(hilly, (s) => s.hiddenShare)).toBeGreaterThanOrEqual(COVER_TARGET_RATIO * meanOf(gentle, (s) => s.hiddenShare));
  });

  it('hides at least 1.5 times as much as Gentle at the 60–150 m enemies fight at', () => {
    expect(meanOf(hilly, (s) => s.hiddenNear)).toBeGreaterThanOrEqual(COVER_TARGET_RATIO * meanOf(gentle, (s) => s.hiddenNear));
  });

  // Steep and spawnable shares are battlefield-wide averages, as in the cover report; whether every
  // seed still fills its first wave is checked in tests/simulation.test.ts.
  it('keeps nearly all ground gentle enough for enemies to drive', () => {
    expect(meanOf(hilly, (s) => s.steepShare)).toBeLessThanOrEqual(MAX_STEEP_SHARE);
  });

  it('keeps most ground flat enough for enemies to spawn', () => {
    expect(meanOf(hilly, (s) => s.spawnableShare)).toBeGreaterThanOrEqual(MIN_SPAWNABLE_SHARE);
  });

  it('still places most of the rocks and structures Gentle does', () => {
    hilly.forEach((s, k) => {
      expect(s.world.obstacles.length).toBeGreaterThanOrEqual(MIN_OBSTACLE_RATIO * gentle[k]!.world.obstacles.length);
    });
  });

  it("keeps the player's spawn level", () => {
    for (const s of hilly) expect(maxSlopeNearCentre(s.world)).toBeLessThanOrEqual(MAX_SPAWN_SLOPE);
  });

  it('generates the same battlefield for the same seed, unlike Gentle', () => {
    const again = generateWorld(42, worldOptionsFor('standard', false, 'hilly'));
    expect(worldFingerprint(again)).toBe(worldFingerprint(hilly[1]!.world));
    expect(worldFingerprint(again)).not.toBe(worldFingerprint(gentle[1]!.world));
  });
});
