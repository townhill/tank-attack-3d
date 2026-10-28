import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/game/Simulation';
import type { Point2 } from '../src/ui/MapProjection';
import { bearingOf, clampToRadius, rotateToView, sweepLag, viewAngle } from '../src/ui/MapProjection';
import { ContactTracker } from '../src/ui/tacticalData';

const EAST = Math.PI / 2;

function view(dx: number, dz: number, up: number): Point2 {
  return rotateToView(dx, dz, up, { x: 0, y: 0 });
}

describe('rotateToView', () => {
  it('is the identity for a north-up view', () => {
    const p = view(30, -45, 0);
    expect(p.x).toBeCloseTo(30);
    expect(p.y).toBeCloseTo(-45);
  });

  it('puts the up heading at the top of a heading-up view', () => {
    const ahead = view(100, 0, EAST);
    expect(ahead.x).toBeCloseTo(0);
    expect(ahead.y).toBeCloseTo(-100);
    // Facing east, south is on the right and west is behind (down).
    const south = view(0, 100, EAST);
    expect(south.x).toBeCloseTo(100);
    expect(south.y).toBeCloseTo(0);
    const west = view(-100, 0, EAST);
    expect(west.y).toBeCloseTo(100);
  });

  it('preserves distances', () => {
    for (const up of [0.3, -2.1, 4]) {
      const p = view(37, -81, up);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(Math.hypot(37, -81));
    }
  });

  it('writes into and returns the out parameter', () => {
    const out = { x: 9, y: 9 };
    expect(rotateToView(1, 2, 0, out)).toBe(out);
  });
});

describe('viewAngle and bearingOf', () => {
  it('gives the screen rotation of a heading relative to the view up', () => {
    expect(viewAngle(EAST, 0)).toBeCloseTo(EAST);
    expect(viewAngle(EAST, EAST)).toBeCloseTo(0);
    expect(viewAngle(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2);
  });

  it('measures bearings clockwise from screen up', () => {
    expect(bearingOf(0, -1)).toBeCloseTo(0);
    expect(bearingOf(1, 0)).toBeCloseTo(EAST);
    expect(Math.abs(bearingOf(0, 1))).toBeCloseTo(Math.PI);
    expect(bearingOf(-1, 0)).toBeCloseTo(-EAST);
  });

  it('agrees with rotateToView for a heading drawn in a rotated view', () => {
    const heading = 1.1;
    const up = -0.4;
    const p = view(Math.sin(heading), -Math.cos(heading), up);
    expect(bearingOf(p.x, p.y)).toBeCloseTo(viewAngle(heading, up));
  });
});

describe('clampToRadius', () => {
  it('leaves points inside the circle alone', () => {
    const p = { x: 3, y: -4 };
    expect(clampToRadius(p, 5)).toBe(false);
    expect(p).toEqual({ x: 3, y: -4 });
  });

  it('pulls outside points onto the rim along the same bearing', () => {
    const p = { x: 30, y: -40 };
    expect(clampToRadius(p, 10)).toBe(true);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(10);
    expect(bearingOf(p.x, p.y)).toBeCloseTo(bearingOf(30, -40));
  });
});

describe('sweepLag', () => {
  it('is near zero just after the sweep passes and near one just before', () => {
    expect(sweepLag(1, 1.01)).toBeCloseTo(0.01 / (2 * Math.PI));
    expect(sweepLag(1, 0.99)).toBeGreaterThan(0.99);
  });

  it('wraps around the full circle', () => {
    expect(sweepLag(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(1 - 0.2 / (2 * Math.PI));
    expect(sweepLag(0, 0)).toBe(0);
    expect(sweepLag(0, 2 * Math.PI + 0.5)).toBeCloseTo(0.5 / (2 * Math.PI));
  });
});

describe('ContactTracker', () => {
  function simWithEnemy(): Simulation {
    const sim = new Simulation({ seed: 4242, difficulty: 'normal', firstWaveDelay: 1000 });
    expect(sim.spawnEnemy('heavy')).toBe(true);
    return sim;
  }

  it('marks enemies inside radar range as live at their current position', () => {
    const sim = simWithEnemy();
    const tank = sim.enemies[0]!.tank;
    const tracker = new ContactTracker();
    tracker.update(sim, 5000);
    const c = tracker.get(tank.id);
    expect(c?.live).toBe(true);
    expect(c?.kind).toBe('heavy');
    expect(c?.x).toBe(tank.x);
    expect(c?.seenAt).toBe(sim.time);
  });

  it('keeps the last-known position once an enemy is no longer detected', () => {
    const sim = simWithEnemy();
    const tank = sim.enemies[0]!.tank;
    const tracker = new ContactTracker();
    tracker.update(sim, 5000);
    const seenX = tank.x;
    const seenZ = tank.z;
    // A dead player has no line of sight, so only radar range could detect it.
    sim.player.alive = false;
    tank.x += 40;
    tank.z -= 25;
    sim.time += 3;
    tracker.update(sim, 10);
    const c = tracker.get(tank.id);
    expect(c?.live).toBe(false);
    expect(c?.x).toBe(seenX);
    expect(c?.z).toBe(seenZ);
    expect(c?.seenAt).toBe(0);
  });

  it('never reports destroyed enemies as live', () => {
    const sim = simWithEnemy();
    const tank = sim.enemies[0]!.tank;
    tank.alive = false;
    const tracker = new ContactTracker();
    tracker.update(sim, 5000);
    expect(tracker.get(tank.id)?.live).toBe(false);
    expect(Number.isFinite(tracker.get(tank.id)?.seenAt ?? 0)).toBe(false);
  });

  it('forgets enemies that have left the simulation', () => {
    const sim = simWithEnemy();
    const tracker = new ContactTracker();
    tracker.update(sim, 5000);
    expect(tracker.size).toBe(1);
    sim.enemies.length = 0;
    tracker.update(sim, 5000);
    expect(tracker.size).toBe(0);
  });
});
