import { describe, expect, it } from 'vitest';
import type { Obstacle, ObstacleKind } from '../src/world/Obstacle';
import { Terrain } from '../src/world/Terrain';
import { World } from '../src/world/World';
import { NO_COVER_DISTANCE, surveyBattlefield } from './battlefieldSurvey';

const HALF = 250;

/** World whose ground height is `heightOf(x, z)`, with the given obstacles. */
function makeWorld(heightOf: (x: number, z: number) => number, obstacles: Obstacle[] = []): World {
  const terrain = new Terrain(300, 5);
  for (let j = 0; j < terrain.resolution; j++) {
    for (let i = 0; i < terrain.resolution; i++) {
      terrain.heights[terrain.index(i, j)] = heightOf(terrain.vertexX(i), terrain.vertexZ(j));
    }
  }
  return new World(1, terrain, obstacles.map((o, id) => ({ ...o, id })), HALF);
}

function makeObstacle(kind: ObstacleKind, x: number, z: number): Obstacle {
  return { id: 0, kind, x, z, yaw: 0, shape: { type: 'circle', radius: 3 }, baseY: 0, height: 4, boundRadius: 3, seed: 0 };
}

const SMALL = { observers: 60, targetsPerObserver: 8 };

describe('surveyBattlefield', () => {
  it('finds no cover, no relief and no steep ground on a flat empty world', () => {
    const s = surveyBattlefield(makeWorld(() => 0), 1, SMALL);
    expect(s.hiddenShare).toBe(0);
    expect(s.hiddenNear).toBe(0);
    expect(s.hiddenFar).toBe(0);
    expect(s.relief).toBe(0);
    expect(s.steepShare).toBe(0);
    expect(s.spawnableShare).toBe(1);
    expect(s.coverWithin60).toBe(0);
    expect(s.coverDistanceMedian).toBe(NO_COVER_DISTANCE);
  });

  it('hides targets behind a ridge and finds cover beside it', () => {
    const ridge = (x: number): number => (Math.abs(x) < 15 ? 25 : 0);
    const s = surveyBattlefield(makeWorld(ridge), 2, SMALL);
    expect(s.hiddenShare).toBeGreaterThan(0.1);
    expect(s.hiddenShare).toBeLessThan(0.9);
    expect(s.coverWithin60).toBeGreaterThan(0);
  });

  it('counts ground steeper than the enemy safe slope', () => {
    expect(surveyBattlefield(makeWorld((x) => 0.5 * x), 3, SMALL).steepShare).toBe(1);
    expect(surveyBattlefield(makeWorld((x) => 0.2 * x), 3, SMALL).steepShare).toBe(0);
  });

  it('counts ground flat enough for enemy spawns', () => {
    expect(surveyBattlefield(makeWorld((x) => 0.35 * x), 4, SMALL).spawnableShare).toBe(0);
    expect(surveyBattlefield(makeWorld((x) => 0.2 * x), 4, SMALL).spawnableShare).toBe(1);
  });

  it('measures relief as the 5th to 95th percentile height span', () => {
    // Heights run from -50 to 50 across the playable square, so the middle 90% spans about 90 m.
    expect(surveyBattlefield(makeWorld((x) => 0.2 * x), 5, SMALL).relief).toBeCloseTo(90, -1);
  });

  it('counts rocks apart from structures', () => {
    const world = makeWorld(() => 0, [makeObstacle('rock', 50, 50), makeObstacle('rock', -50, 50), makeObstacle('block', 0, -80)]);
    const s = surveyBattlefield(world, 6, SMALL);
    expect(s.rocks).toBe(2);
    expect(s.structures).toBe(1);
  });

  it('gives the same answer for the same seed', () => {
    const world = makeWorld((x, z) => 12 * Math.sin(x / 40) * Math.cos(z / 55));
    expect(surveyBattlefield(world, 7, SMALL)).toEqual(surveyBattlefield(world, 7, SMALL));
  });
});
