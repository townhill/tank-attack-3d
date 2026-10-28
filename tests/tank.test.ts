import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { TANK_SPECS, WORLD } from '../src/config/settings';
import type { TankKind } from '../src/config/settings';
import { Tank } from '../src/entities/Tank';
import { angleDiff, DEG, forwardX, forwardZ, wrapAngle } from '../src/utils/math';
import { Terrain } from '../src/world/Terrain';

const DT = 1 / 60;

function flatTerrain(height = 0): Terrain {
  const terrain = new Terrain(300, 5);
  if (height !== 0) terrain.heights.fill(height);
  return terrain;
}

/** Terrain whose height is the plane `slopeX * x + slopeZ * z`. */
function rampTerrain(slopeX: number, slopeZ: number): Terrain {
  const terrain = new Terrain(300, 5);
  for (let j = 0; j < terrain.resolution; j++) {
    for (let i = 0; i < terrain.resolution; i++) {
      terrain.heights[terrain.index(i, j)] = slopeX * terrain.vertexX(i) + slopeZ * terrain.vertexZ(j);
    }
  }
  return terrain;
}

function makeTank(kind: TankKind, terrain: Terrain, x = 0, z = 0, heading = 0): Tank {
  const tank = new Tank(1, TANK_SPECS[kind], kind === 'player' ? 'player' : 'enemy');
  tank.placeAt(x, z, heading, terrain);
  return tank;
}

interface DriveOptions {
  throttle?: number;
  turn?: number;
  speedMultiplier?: number;
  /** Called after every tick with the tick index. */
  onTick?: (tick: number) => void;
}

/** Runs the hull physics for `seconds` of simulated time. */
function drive(tank: Tank, terrain: Terrain, seconds: number, options: DriveOptions = {}): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i++) {
    tank.controls.throttle = options.throttle ?? 0;
    tank.controls.turn = options.turn ?? 0;
    tank.integrateMotion(DT, terrain, options.speedMultiplier ?? 1);
    tank.settleOnTerrain(terrain, DT);
    options.onTick?.(i);
  }
}

/** Rotates a hull-local (x right, z back) offset into world space for a hull heading. */
function toWorld(lx: number, lz: number, heading: number): { x: number; z: number } {
  return { x: lx * Math.cos(heading) - lz * Math.sin(heading), z: lx * Math.sin(heading) + lz * Math.cos(heading) };
}

describe('Tank throttle and speed limits on flat ground', () => {
  const terrain = flatTerrain();

  it('reaches maximum speed under full throttle and never exceeds it', () => {
    const tank = makeTank('player', terrain);
    let peak = 0;
    drive(tank, terrain, 6, { throttle: 1, onTick: () => (peak = Math.max(peak, tank.speed)) });
    expect(tank.speed).toBeCloseTo(TANK_SPECS.player.maxSpeed, 9);
    expect(peak).toBeLessThanOrEqual(TANK_SPECS.player.maxSpeed + 1e-9);
  });

  it('accelerates at the configured rate', () => {
    const tank = makeTank('player', terrain);
    drive(tank, terrain, 1, { throttle: 1 });
    expect(tank.speed).toBeCloseTo(TANK_SPECS.player.acceleration, 6);
  });

  it('caps reverse at the reverse speed', () => {
    const tank = makeTank('player', terrain);
    let lowest = 0;
    drive(tank, terrain, 6, { throttle: -1, onTick: () => (lowest = Math.min(lowest, tank.speed)) });
    expect(tank.speed).toBeCloseTo(-TANK_SPECS.player.reverseSpeed, 9);
    expect(lowest).toBeGreaterThanOrEqual(-TANK_SPECS.player.reverseSpeed - 1e-9);
  });

  it('honours the speed multiplier for both directions', () => {
    const forward = makeTank('standard', terrain);
    drive(forward, terrain, 6, { throttle: 1, speedMultiplier: 0.5 });
    expect(forward.speed).toBeCloseTo(TANK_SPECS.standard.maxSpeed * 0.5, 9);

    const reverse = makeTank('standard', terrain);
    drive(reverse, terrain, 6, { throttle: -1, speedMultiplier: 0.5 });
    expect(reverse.speed).toBeCloseTo(-TANK_SPECS.standard.reverseSpeed * 0.5, 9);
  });

  it('scales partial throttle into a proportional target speed', () => {
    const tank = makeTank('player', terrain);
    drive(tank, terrain, 6, { throttle: 0.4 });
    expect(tank.speed).toBeCloseTo(0.4 * TANK_SPECS.player.maxSpeed, 9);
  });

  it('clamps out-of-range throttle input', () => {
    const tank = makeTank('player', terrain);
    drive(tank, terrain, 6, { throttle: 5 });
    expect(tank.speed).toBeCloseTo(TANK_SPECS.player.maxSpeed, 9);
  });

  it('coasts to a stop at the coast deceleration when the throttle is released', () => {
    const tank = makeTank('player', terrain);
    tank.speed = 10;
    const speeds: number[] = [];
    drive(tank, terrain, 1, { onTick: () => speeds.push(tank.speed) });
    expect(tank.speed).toBeCloseTo(10 - TANK_SPECS.player.coastDeceleration, 6);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]!).toBeLessThanOrEqual(speeds[i - 1]!);
    drive(tank, terrain, 3);
    expect(tank.speed).toBe(0);
  });

  it('stops moving once it has coasted to rest', () => {
    const tank = makeTank('player', terrain);
    tank.speed = 3;
    drive(tank, terrain, 3);
    const rest = { x: tank.x, z: tank.z };
    drive(tank, terrain, 1);
    expect(tank.x).toBe(rest.x);
    expect(tank.z).toBe(rest.z);
  });

  it('brakes harder than it coasts when the throttle is reversed', () => {
    const braking = makeTank('player', terrain);
    braking.speed = 10;
    drive(braking, terrain, 0.5, { throttle: -1 });
    expect(braking.speed).toBeCloseTo(10 - TANK_SPECS.player.braking * 0.5, 6);

    const coasting = makeTank('player', terrain);
    coasting.speed = 10;
    drive(coasting, terrain, 0.5);
    expect(braking.speed).toBeLessThan(coasting.speed);
  });

  it('ignores controls once destroyed and rolls to a halt', () => {
    const tank = makeTank('player', terrain);
    tank.speed = 10;
    tank.alive = false;
    drive(tank, terrain, 3, { throttle: 1, turn: 1 });
    expect(tank.speed).toBe(0);
    expect(tank.heading).toBe(0);
  });

  it('gives each tank kind its own top speed', () => {
    for (const kind of ['player', 'standard', 'heavy', 'scout'] as const) {
      const tank = makeTank(kind, terrain);
      drive(tank, terrain, 8, { throttle: 1 });
      expect(tank.speed).toBeCloseTo(TANK_SPECS[kind].maxSpeed, 9);
    }
  });
});

describe('Tank turning', () => {
  const terrain = flatTerrain();

  it('turns clockwise (increasing heading) for positive turn input and anticlockwise for negative', () => {
    const right = makeTank('player', terrain);
    drive(right, terrain, 0.5, { turn: 1 });
    expect(right.heading).toBeGreaterThan(0);

    const left = makeTank('player', terrain);
    drive(left, terrain, 0.5, { turn: -1 });
    expect(left.heading).toBeLessThan(0);
    expect(left.heading).toBeCloseTo(-right.heading, 9);
  });

  it('never turns faster than the spec turn rate', () => {
    const tank = makeTank('player', terrain);
    let fastest = 0;
    drive(tank, terrain, 3, { turn: 1, onTick: () => (fastest = Math.max(fastest, tank.angularVelocity)) });
    expect(fastest).toBeLessThanOrEqual(TANK_SPECS.player.turnRate + 1e-12);
    expect(tank.angularVelocity).toBeCloseTo(TANK_SPECS.player.turnRate, 9);
  });

  it('spins up gradually: heading change in the first second is below turnRate and above 80% of it', () => {
    const tank = makeTank('player', terrain);
    drive(tank, terrain, 1, { turn: 1 });
    expect(tank.heading).toBeLessThan(TANK_SPECS.player.turnRate);
    expect(tank.heading).toBeGreaterThan(0.8 * TANK_SPECS.player.turnRate);
  });

  it('turns more slowly at full speed than in place', () => {
    const moving = makeTank('player', terrain);
    drive(moving, terrain, 8, { throttle: 1, turn: 1 });
    expect(moving.angularVelocity).toBeCloseTo(0.7 * TANK_SPECS.player.turnRate, 9);
  });

  it('keeps the heading wrapped into [-PI, PI)', () => {
    const tank = makeTank('player', terrain);
    drive(tank, terrain, 20, {
      turn: 1,
      onTick: () => {
        expect(tank.heading).toBeGreaterThanOrEqual(-Math.PI);
        expect(tank.heading).toBeLessThan(Math.PI);
      },
    });
  });

  it('spins the tracks in opposite directions when turning on the spot', () => {
    const tank = makeTank('player', terrain);
    drive(tank, terrain, 1, { turn: 1 });
    expect(tank.trackPhaseLeft).toBeGreaterThan(0);
    expect(tank.trackPhaseRight).toBeLessThan(0);
    expect(tank.trackPhaseLeft).toBeCloseTo(-tank.trackPhaseRight, 9);
  });

  it('spins both tracks together when driving straight', () => {
    const tank = makeTank('player', terrain);
    drive(tank, terrain, 2, { throttle: 1 });
    expect(tank.trackPhaseLeft).toBeCloseTo(tank.trackPhaseRight, 9);
    expect(tank.trackPhaseLeft).toBeGreaterThan(0);
  });
});

describe('Tank position integration', () => {
  const terrain = flatTerrain();

  it('moves along forward(heading) every tick while curving', () => {
    const tank = makeTank('player', terrain);
    // Warm up so the check below covers a tank that is both accelerating and cruising.
    drive(tank, terrain, 1, { throttle: 1, turn: 0.5 });
    for (let i = 0; i < 240; i++) {
      const before = { x: tank.x, z: tank.z };
      tank.controls.throttle = 1;
      tank.controls.turn = 0.5;
      tank.integrateMotion(DT, terrain, 1);
      expect(tank.x - before.x).toBeCloseTo(forwardX(tank.heading) * tank.speed * DT, 9);
      expect(tank.z - before.z).toBeCloseTo(forwardZ(tank.heading) * tank.speed * DT, 9);
      expect(tank.vx).toBeCloseTo(forwardX(tank.heading) * tank.speed, 9);
      expect(tank.vz).toBeCloseTo(forwardZ(tank.heading) * tank.speed, 9);
    }
  });

  it('drives north (-Z) from heading 0 and east (+X) from heading PI/2', () => {
    const north = makeTank('player', terrain, 0, 0, 0);
    drive(north, terrain, 3, { throttle: 1 });
    expect(north.z).toBeLessThan(-20);
    expect(north.x).toBeCloseTo(0, 9);

    const east = makeTank('player', terrain, 0, 0, Math.PI / 2);
    drive(east, terrain, 3, { throttle: 1 });
    expect(east.x).toBeGreaterThan(20);
    expect(east.z).toBeCloseTo(0, 6);
  });

  it('covers the analytic distance for an accelerate-then-cruise run', () => {
    const tank = makeTank('player', terrain);
    drive(tank, terrain, 3, { throttle: 1 });
    // 15 m/s reached after 15 / 6.5 s, then cruising: distance = v^2 / (2a) + v * (3 - v / a).
    const rampTime = TANK_SPECS.player.maxSpeed / TANK_SPECS.player.acceleration;
    const expected =
      (TANK_SPECS.player.maxSpeed * rampTime) / 2 + TANK_SPECS.player.maxSpeed * (3 - rampTime);
    expect(-tank.z).toBeCloseTo(expected, 0);
  });

  it('keeps the previous-frame snapshot untouched until saveSnapshot is called', () => {
    const tank = makeTank('player', terrain, 5, 6);
    drive(tank, terrain, 1, { throttle: 1 });
    expect(tank.prev.x).toBe(5);
    expect(tank.prev.z).toBe(6);
    tank.saveSnapshot();
    expect(tank.prev.x).toBe(tank.x);
    expect(tank.prev.z).toBe(tank.z);
    expect(tank.prev.y).toBe(tank.y);
    expect(tank.prev.orientation.equals(tank.orientation)).toBe(true);
  });
});

describe('Tank on slopes', () => {
  const slope = 0.3;
  const terrain = rampTerrain(slope, 0);

  it('climbs slower than it drives on the flat', () => {
    const flat = makeTank('player', flatTerrain(), 0, 0, Math.PI / 2);
    drive(flat, flatTerrain(), 1, { throttle: 1 });
    const uphill = makeTank('player', terrain, 0, 0, Math.PI / 2);
    drive(uphill, terrain, 1, { throttle: 1 });
    expect(uphill.speed).toBeLessThan(flat.speed - 1);
  });

  it('covers less ground while climbing than on the flat over the same time', () => {
    const flat = makeTank('player', flatTerrain(), 0, 0, Math.PI / 2);
    drive(flat, flatTerrain(), 2, { throttle: 1 });
    const uphill = makeTank('player', terrain, 0, 0, Math.PI / 2);
    drive(uphill, terrain, 2, { throttle: 1 });
    expect(uphill.x).toBeLessThan(flat.x);
    expect(uphill.x).toBeGreaterThan(0);
  });

  it('speeds up faster when driving downhill', () => {
    const flat = makeTank('player', flatTerrain(), 0, 0, -Math.PI / 2);
    drive(flat, flatTerrain(), 1, { throttle: 1 });
    const downhill = makeTank('player', terrain, 0, 0, -Math.PI / 2);
    drive(downhill, terrain, 1, { throttle: 1 });
    expect(downhill.speed).toBeGreaterThan(flat.speed + 1);
  });

  it('cruises at least 1 m/s slower than its flat top speed on a 30% gradient', () => {
    const climber = makeTank('player', terrain, -200, 0, Math.PI / 2);
    drive(climber, terrain, 8, { throttle: 1 });
    expect(climber.speed).toBeLessThan(TANK_SPECS.player.maxSpeed - 1);
  });

  it('slows a rolling tank faster uphill than on the flat', () => {
    const flat = makeTank('player', flatTerrain(), 0, 0, Math.PI / 2);
    flat.speed = 8;
    drive(flat, flatTerrain(), 0.5);
    const uphill = makeTank('player', terrain, 0, 0, Math.PI / 2);
    uphill.speed = 8;
    drive(uphill, terrain, 0.5);
    expect(uphill.speed).toBeLessThan(flat.speed);
  });
});

describe('Tank.settleOnTerrain', () => {
  it('levels the hull and puts it on the ground on flat terrain', () => {
    const terrain = flatTerrain();
    const tank = makeTank('standard', terrain, 12, -7, 0.9);
    expect(tank.y).toBeCloseTo(0, 9);
    expect(tank.up.x).toBeCloseTo(0, 9);
    expect(tank.up.y).toBeCloseTo(1, 9);
    expect(tank.up.z).toBeCloseTo(0, 9);
  });

  it('sits on raised flat ground', () => {
    const terrain = flatTerrain(5);
    expect(makeTank('standard', terrain, 12, -7).y).toBeCloseTo(5, 6);
  });

  it('tilts the hull to the slope and rests on the surface', () => {
    const terrain = rampTerrain(0.3, 0);
    const len = Math.sqrt(1.09);
    for (const heading of [0, Math.PI / 2, -Math.PI / 2, 2.5]) {
      const tank = makeTank('standard', terrain, 10, 0, heading);
      expect(tank.y).toBeCloseTo(3, 4);
      expect(tank.up.x).toBeCloseTo(-0.3 / len, 4);
      expect(tank.up.y).toBeCloseTo(1 / len, 4);
      expect(tank.up.z).toBeCloseTo(0, 4);
      expect(tank.up.length()).toBeCloseTo(1, 9);
    }
  });

  it('pitches the nose down when facing downhill and up when facing uphill', () => {
    const terrain = rampTerrain(0, 0.3);
    const downhill = makeTank('standard', terrain, 0, 10, 0); // facing -Z, ground falls that way
    const uphill = makeTank('standard', terrain, 0, 10, Math.PI);
    const forwardOf = (t: Tank): Vector3 => new Vector3(0, 0, -1).applyQuaternion(t.orientation);
    expect(forwardOf(downhill).y).toBeLessThan(-0.25);
    expect(forwardOf(uphill).y).toBeGreaterThan(0.25);
  });

  it('keeps the orientation consistent with heading and up vector', () => {
    const terrain = rampTerrain(0.3, 0);
    const tank = makeTank('standard', terrain, 10, 0, Math.PI / 2);
    const up = new Vector3(0, 1, 0).applyQuaternion(tank.orientation);
    const forward = new Vector3(0, 0, -1).applyQuaternion(tank.orientation);
    expect(up.distanceTo(tank.up)).toBeLessThan(1e-6);
    // Facing east, uphill: the forward vector climbs at the slope angle and stays in the XY plane.
    expect(forward.z).toBeCloseTo(0, 6);
    expect(forward.x).toBeGreaterThan(0.9);
    expect(forward.y).toBeCloseTo(0.3 / Math.sqrt(1.09), 6);
  });

  it('faces along the heading on flat terrain', () => {
    const terrain = flatTerrain();
    for (const heading of [0, 1, -2, 3]) {
      const tank = makeTank('standard', terrain, 0, 0, heading);
      const forward = new Vector3(0, 0, -1).applyQuaternion(tank.orientation);
      expect(forward.x).toBeCloseTo(forwardX(heading), 9);
      expect(forward.z).toBeCloseTo(forwardZ(heading), 9);
      expect(forward.y).toBeCloseTo(0, 9);
    }
  });

  it('eases towards the slope when given a time step instead of snapping', () => {
    const terrain = rampTerrain(0.3, 0);
    const tank = new Tank(1, TANK_SPECS.standard, 'enemy');
    tank.x = 10;
    tank.heading = Math.PI / 2;
    tank.settleOnTerrain(terrain, DT);
    const target = -0.3 / Math.sqrt(1.09);
    expect(tank.up.x).toBeLessThan(0);
    expect(tank.up.x).toBeGreaterThan(target);
    for (let i = 0; i < 180; i++) tank.settleOnTerrain(terrain, DT);
    expect(tank.up.x).toBeCloseTo(target, 3);
  });
});

describe('Tank.placeAt', () => {
  it('wraps the heading, zeroes motion, aims forward and syncs the snapshot', () => {
    const terrain = flatTerrain();
    const tank = new Tank(1, TANK_SPECS.standard, 'enemy');
    tank.speed = 7;
    tank.angularVelocity = 1;
    tank.placeAt(30, -40, 3 * Math.PI + 0.5, terrain);
    expect(tank.speed).toBe(0);
    expect(tank.angularVelocity).toBe(0);
    expect(angleDiff(tank.heading, 3 * Math.PI + 0.5)).toBeCloseTo(0, 9);
    expect(tank.heading).toBeGreaterThanOrEqual(-Math.PI);
    expect(tank.heading).toBeLessThan(Math.PI);
    expect(tank.aimDirection.x).toBeCloseTo(Math.sin(0.5 + Math.PI), 9);
    expect(tank.aimDirection.z).toBeCloseTo(-Math.cos(0.5 + Math.PI), 9);
    expect(tank.prev.x).toBe(30);
    expect(tank.prev.z).toBe(-40);
  });
});

describe('Tank.updateTurret', () => {
  const terrain = flatTerrain();

  it('traverses at most turretTraverse * dt per step and reaches the aim exactly', () => {
    const tank = makeTank('player', terrain);
    tank.aimDirection.set(1, 0, 0);
    const maxStep = TANK_SPECS.player.turretTraverse * DT;
    let previous = tank.turretYaw;
    let stepsToReach = 0;
    for (let i = 0; i < 120; i++) {
      tank.updateTurret(DT);
      expect(Math.abs(tank.turretYaw - previous)).toBeLessThanOrEqual(maxStep + 1e-12);
      previous = tank.turretYaw;
      if (stepsToReach === 0 && Math.abs(tank.turretYaw - Math.PI / 2) < 1e-9) stepsToReach = i + 1;
    }
    expect(tank.turretYaw).toBeCloseTo(Math.PI / 2, 9);
    expect(stepsToReach).toBe(Math.ceil(Math.PI / 2 / maxStep));
  });

  it('traverses anticlockwise towards a target on the left', () => {
    const tank = makeTank('player', terrain);
    tank.aimDirection.set(-1, 0, 0);
    for (let i = 0; i < 120; i++) tank.updateTurret(DT);
    expect(tank.turretYaw).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('reports the instantaneous traverse rate', () => {
    const tank = makeTank('player', terrain);
    tank.aimDirection.set(1, 0, 0);
    tank.updateTurret(DT);
    expect(tank.turretYawRate).toBeCloseTo(TANK_SPECS.player.turretTraverse, 6);
    for (let i = 0; i < 120; i++) tank.updateTurret(DT);
    expect(tank.turretYawRate).toBeCloseTo(0, 9);
  });

  it('elevates at elevationRate and clamps to the maximum elevation', () => {
    const tank = makeTank('player', terrain);
    tank.aimDirection.set(0, 1, -0.2).normalize();
    tank.updateTurret(DT);
    expect(tank.gunPitch).toBeCloseTo(TANK_SPECS.player.elevationRate * DT, 9);
    for (let i = 0; i < 200; i++) {
      tank.updateTurret(DT);
      expect(tank.gunPitch).toBeLessThanOrEqual(TANK_SPECS.player.maxElevation + 1e-12);
    }
    expect(tank.gunPitch).toBeCloseTo(TANK_SPECS.player.maxElevation, 9);
  });

  it('depresses the gun and clamps to the minimum elevation', () => {
    const tank = makeTank('player', terrain);
    tank.aimDirection.set(0, -1, -0.2).normalize();
    for (let i = 0; i < 200; i++) {
      tank.updateTurret(DT);
      expect(tank.gunPitch).toBeGreaterThanOrEqual(TANK_SPECS.player.minElevation - 1e-12);
    }
    expect(tank.gunPitch).toBeCloseTo(TANK_SPECS.player.minElevation, 9);
  });

  it('settles on an aim inside the elevation limits', () => {
    const tank = makeTank('player', terrain);
    tank.aimDirection.set(0, Math.sin(5 * DEG), -Math.cos(5 * DEG));
    for (let i = 0; i < 100; i++) tank.updateTurret(DT);
    expect(tank.gunPitch).toBeCloseTo(5 * DEG, 9);
  });

  it('reports a zero traverse rate for a zero-length step instead of dividing by zero', () => {
    const tank = makeTank('player', terrain);
    tank.aimDirection.set(1, 0, 0);
    tank.updateTurret(0);
    expect(tank.turretYaw).toBe(0);
    expect(tank.turretYawRate).toBe(0);
  });

  it('does not move a destroyed tank turret', () => {
    const tank = makeTank('player', terrain);
    tank.aimDirection.set(1, 0.2, 0).normalize();
    tank.alive = false;
    tank.updateTurret(DT);
    expect(tank.turretYaw).toBe(0);
    expect(tank.gunPitch).toBe(0);
    expect(tank.turretYawRate).toBe(0);
  });

  it('holds its world aim while the hull turns underneath it', () => {
    const tank = makeTank('player', terrain);
    tank.aimDirection.set(1, 0, 0); // due east
    for (let i = 0; i < 240; i++) {
      tank.controls.throttle = 0;
      tank.controls.turn = i < 60 ? 1 : 0;
      tank.integrateMotion(DT, terrain, 1);
      tank.settleOnTerrain(terrain, DT);
      tank.updateTurret(DT);
      if (i === 119 || i === 239) {
        expect(angleDiff(wrapAngle(tank.heading + tank.turretYaw), Math.PI / 2)).toBeCloseTo(0, 6);
      }
    }
    // The hull really did turn.
    expect(tank.heading).toBeGreaterThan(0.5);
  });

  it('keeps the world-space barrel direction on the aim direction', () => {
    const tank = makeTank('player', terrain, 0, 0, 0.7);
    tank.aimDirection.set(Math.sin(2), Math.sin(0.1), -Math.cos(2)).normalize();
    for (let i = 0; i < 200; i++) tank.updateTurret(DT);
    const position = new Vector3();
    const direction = new Vector3();
    tank.getMuzzle(position, direction);
    expect(direction.dot(tank.aimDirection)).toBeCloseTo(1, 6);
  });

  it('uses the faster traverse of a lighter tank', () => {
    const scout = makeTank('scout', terrain);
    const heavy = makeTank('heavy', terrain);
    scout.aimDirection.set(1, 0, 0);
    heavy.aimDirection.set(1, 0, 0);
    for (let i = 0; i < 30; i++) {
      scout.updateTurret(DT);
      heavy.updateTurret(DT);
    }
    expect(scout.turretYaw).toBeGreaterThan(heavy.turretYaw);
    expect(heavy.turretYaw).toBeCloseTo(TANK_SPECS.heavy.turretTraverse * 0.5, 6);
  });
});

describe('Tank.getMuzzle', () => {
  const terrain = flatTerrain();

  function expectedMuzzle(kind: TankKind, heading: number, turretYaw: number, gunPitch: number): { position: Vector3; direction: Vector3 } {
    const s = TANK_SPECS[kind];
    const k = s.scale;
    // Independent derivation: the gun pivot sits `-gunPivotZ` ahead of the turret ring along the turret's facing.
    const local = {
      x: -s.gunPivotZ * Math.sin(turretYaw) * k,
      y: (s.turretPivotY + s.gunPivotY) * k,
      z: (s.turretPivotZ - s.gunPivotZ * -Math.cos(turretYaw)) * k,
    };
    const dir = {
      x: Math.sin(turretYaw) * Math.cos(gunPitch),
      y: Math.sin(gunPitch),
      z: -Math.cos(turretYaw) * Math.cos(gunPitch),
    };
    const muzzleLocal = {
      x: local.x + dir.x * s.barrelLength * k,
      y: local.y + dir.y * s.barrelLength * k,
      z: local.z + dir.z * s.barrelLength * k,
    };
    const m = toWorld(muzzleLocal.x, muzzleLocal.z, heading);
    const d = toWorld(dir.x, dir.z, heading);
    return { position: new Vector3(m.x, muzzleLocal.y, m.z), direction: new Vector3(d.x, dir.y, d.z) };
  }

  it('is barrelLength ahead of the gun pivot along the barrel for any turret yaw and elevation', () => {
    const cases: [number, number][] = [
      [0, 0],
      [0.7, 0.1],
      [-1.2, 0.3],
      [Math.PI, 0],
      [2.4, -0.1],
    ];
    for (const [yaw, pitch] of cases) {
      const tank = makeTank('standard', terrain);
      tank.turretYaw = yaw;
      tank.gunPitch = pitch;
      const position = new Vector3();
      const direction = new Vector3();
      tank.getMuzzle(position, direction);
      const expected = expectedMuzzle('standard', 0, yaw, pitch);
      expect(position.distanceTo(expected.position)).toBeLessThan(1e-9);
      expect(direction.distanceTo(expected.direction)).toBeLessThan(1e-9);
      expect(direction.length()).toBeCloseTo(1, 9);
    }
  });

  it('puts the muzzle 4.4 m beyond the gun pivot for a level, forward-facing standard tank', () => {
    const tank = makeTank('standard', terrain);
    const position = new Vector3();
    const direction = new Vector3();
    tank.getMuzzle(position, direction);
    const s = TANK_SPECS.standard;
    expect(position.x).toBeCloseTo(0, 9);
    expect(position.y).toBeCloseTo(s.turretPivotY + s.gunPivotY, 9);
    expect(position.z).toBeCloseTo(s.turretPivotZ + s.gunPivotZ - s.barrelLength, 9);
    expect(direction.z).toBeCloseTo(-1, 9);
  });

  it('swings sideways with the turret', () => {
    const tank = makeTank('standard', terrain);
    const position = new Vector3();
    const direction = new Vector3();
    tank.turretYaw = Math.PI / 2;
    tank.getMuzzle(position, direction);
    expect(position.x).toBeGreaterThan(5);
    expect(direction.x).toBeCloseTo(1, 9);
    expect(direction.z).toBeCloseTo(0, 9);
  });

  it('follows the hull heading, position and scale', () => {
    for (const kind of ['heavy', 'scout'] as const) {
      const tank = makeTank(kind, terrain, 40, -25, 1.1);
      tank.turretYaw = -0.4;
      tank.gunPitch = 0.05;
      const position = new Vector3();
      const direction = new Vector3();
      tank.getMuzzle(position, direction);
      const expected = expectedMuzzle(kind, 1.1, -0.4, 0.05);
      expect(position.x - 40).toBeCloseTo(expected.position.x, 9);
      expect(position.y).toBeCloseTo(expected.position.y, 9);
      expect(position.z + 25).toBeCloseTo(expected.position.z, 9);
      expect(direction.distanceTo(expected.direction)).toBeLessThan(1e-9);
    }
  });

  it('rises with the terrain', () => {
    const tank = makeTank('standard', flatTerrain(8));
    const position = new Vector3();
    const direction = new Vector3();
    tank.getMuzzle(position, direction);
    expect(position.y).toBeCloseTo(8 + TANK_SPECS.standard.turretPivotY + TANK_SPECS.standard.gunPivotY, 6);
  });

  it('aims along the compass heading plus turret yaw', () => {
    const tank = makeTank('standard', terrain, 0, 0, 0.8);
    tank.turretYaw = 0.5;
    const position = new Vector3();
    const direction = new Vector3();
    tank.getMuzzle(position, direction);
    expect(direction.x).toBeCloseTo(forwardX(1.3), 9);
    expect(direction.z).toBeCloseTo(forwardZ(1.3), 9);
  });
});

describe('Tank state helpers', () => {
  const terrain = flatTerrain();

  it('healthFraction is clamped to [0, 1]', () => {
    const tank = makeTank('standard', terrain);
    expect(tank.healthFraction).toBe(1);
    tank.health = TANK_SPECS.standard.maxHealth / 2;
    expect(tank.healthFraction).toBeCloseTo(0.5, 12);
    tank.health = -10;
    expect(tank.healthFraction).toBe(0);
    tank.health = 1e6;
    expect(tank.healthFraction).toBe(1);
  });

  it('starts with full health, alive and loaded', () => {
    const tank = makeTank('heavy', terrain);
    expect(tank.health).toBe(TANK_SPECS.heavy.maxHealth);
    expect(tank.alive).toBe(true);
    expect(tank.reload).toBe(0);
    expect(tank.reloadFraction).toBe(1);
  });

  it('reloadFraction rises from 0 to 1 as the gun reloads', () => {
    const tank = makeTank('standard', terrain);
    tank.reload = TANK_SPECS.standard.weapon.reloadTime;
    expect(tank.reloadFraction).toBe(0);
    tank.reload = TANK_SPECS.standard.weapon.reloadTime / 2;
    expect(tank.reloadFraction).toBeCloseTo(0.5, 12);
  });

  it('updateTimers counts reload, recoil and damage flash down to zero without going negative', () => {
    const tank = makeTank('standard', terrain);
    tank.reload = 1;
    tank.recoil = 1;
    tank.damageFlash = 1;
    tank.updateTimers(0.2);
    expect(tank.reload).toBeCloseTo(0.8, 12);
    expect(tank.recoil).toBeCloseTo(1 - 2.2 * 0.2, 12);
    expect(tank.damageFlash).toBeCloseTo(1 - 3.5 * 0.2, 12);
    tank.updateTimers(10);
    expect(tank.reload).toBe(0);
    expect(tank.recoil).toBe(0);
    expect(tank.damageFlash).toBe(0);
  });

  it('getCentre is the middle of the hit box above the ground', () => {
    const tank = makeTank('heavy', terrain, 10, 20);
    const centre = tank.getCentre(new Vector3());
    expect(centre.x).toBeCloseTo(10, 9);
    expect(centre.y).toBeCloseTo(TANK_SPECS.heavy.hitHalfExtents.y, 9);
    expect(centre.z).toBeCloseTo(20, 9);
  });

  it('getSightPoint sits above and slightly behind the hull centre, and turns with the hull', () => {
    const forward = makeTank('standard', terrain);
    const point = forward.getSightPoint(new Vector3());
    expect(point.x).toBeCloseTo(0, 9);
    expect(point.y).toBeCloseTo(TANK_SPECS.standard.turretPivotY + TANK_SPECS.standard.gunPivotY + 0.9, 9);
    expect(point.z).toBeCloseTo(TANK_SPECS.standard.turretPivotZ, 9);

    const east = makeTank('standard', terrain, 0, 0, Math.PI / 2);
    const rotated = east.getSightPoint(new Vector3());
    expect(rotated.x).toBeCloseTo(-TANK_SPECS.standard.turretPivotZ, 9);
    expect(rotated.z).toBeCloseTo(0, 9);
  });

  it('exposes the gravity constant used by slope physics', () => {
    expect(WORLD.gravity).toBeGreaterThan(0);
  });
});
