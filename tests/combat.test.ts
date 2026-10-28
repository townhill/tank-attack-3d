import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { applyDamage, computeDamage, hitZone, zoneMultiplier } from '../src/combat/DamageSystem';
import type { Damageable, HitZone } from '../src/combat/DamageSystem';
import { ballisticDirection, leadTarget, shellPositionAt, solveElevation, timeOfFlight } from '../src/combat/Ballistics';
import {
  createProjectileHit,
  fireWeapon,
  segmentVsTank,
  stepProjectile,
} from '../src/combat/WeaponSystem';
import { DAMAGE, PROJECTILE, TANK_SPECS, WORLD } from '../src/config/settings';
import type { Faction, TankKind } from '../src/config/settings';
import { Projectile, ProjectilePool } from '../src/entities/Projectile';
import { Tank } from '../src/entities/Tank';
import { DEG } from '../src/utils/math';
import { NO_HIT } from '../src/world/Collision';
import type { Obstacle } from '../src/world/Obstacle';
import { Terrain } from '../src/world/Terrain';
import { World } from '../src/world/World';

const G = WORLD.gravity;
const DT = 1 / 60;

function makeBlock(x: number, z: number, half: number, height: number): Obstacle {
  return {
    id: 0,
    kind: 'block',
    x,
    z,
    yaw: 0,
    shape: { type: 'box', halfX: half, halfZ: half },
    baseY: 0,
    height,
    boundRadius: Math.hypot(half, half),
    seed: 0,
  };
}

function makeFlatWorld(obstacles: Obstacle[] = []): World {
  return new World(1, new Terrain(300, 5), obstacles, 250);
}

function makeTank(id: number, kind: TankKind, faction: Faction, world: World, x = 0, z = 0, heading = 0): Tank {
  const tank = new Tank(id, TANK_SPECS[kind], faction);
  tank.placeAt(x, z, heading, world.terrain);
  return tank;
}

describe('solveElevation', () => {
  const SPEED = 240;
  const cases: [number, number][] = [
    [50, 0],
    [200, 0],
    [600, 30],
    [300, -40],
    [800, 0],
    [1500, 100],
  ];

  it.each(cases)('lands a shell on a target %f m away and %f m above the muzzle', (distance, heightDelta) => {
    const elevation = solveElevation(distance, heightDelta, SPEED, G);
    expect(elevation).not.toBeNull();
    const theta = elevation!;
    const velocity = { x: SPEED * Math.cos(theta), y: SPEED * Math.sin(theta), z: 0 };
    const flightTime = distance / velocity.x;
    const at = shellPositionAt({ x: 0, y: 0, z: 0 }, velocity, G, flightTime, { x: 0, y: 0, z: 0 });
    expect(at.x).toBeCloseTo(distance, 6);
    expect(at.y).toBeCloseTo(heightDelta, 6);
  });

  it('uses the low arc: elevation grows with distance but stays below 45 degrees', () => {
    const near = solveElevation(200, 0, SPEED, G)!;
    const far = solveElevation(4000, 0, SPEED, G)!;
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
    expect(far).toBeLessThan(Math.PI / 4);
  });

  it('returns null when the target is beyond maximum range', () => {
    expect(solveElevation(5950, 0, SPEED, G)).toBeNull();
    expect(solveElevation(5800, 0, SPEED, G)).not.toBeNull();
    expect(solveElevation(100, 3000, SPEED, G)).toBeNull();
  });

  it('fires at exactly 45 degrees at maximum range', () => {
    const maxRange = (SPEED * SPEED) / G;
    expect(solveElevation(maxRange - 1e-6, 0, SPEED, G)!).toBeCloseTo(Math.PI / 4, 3);
  });

  it('is a straight line when gravity is zero', () => {
    expect(solveElevation(100, 0, SPEED, 0)).toBeCloseTo(0, 12);
    expect(solveElevation(100, 50, SPEED, 0)).toBeCloseTo(Math.atan2(50, 100), 12);
    expect(solveElevation(100, -50, SPEED, 0)).toBeCloseTo(Math.atan2(-50, 100), 12);
  });

  it('points straight up or down when the target is directly above or below', () => {
    expect(solveElevation(0, 10, SPEED, G)).toBeCloseTo(Math.PI / 2, 12);
    expect(solveElevation(0, -10, SPEED, G)).toBeCloseTo(-Math.PI / 2, 12);
  });

  it('needs less elevation with a faster shell', () => {
    expect(solveElevation(500, 0, 300, G)!).toBeLessThan(solveElevation(500, 0, 200, G)!);
  });
});

describe('ballisticDirection', () => {
  const origin = { x: 0, y: 2, z: 0 };

  it('always returns a unit vector, including out of range and straight-up cases', () => {
    const targets = [
      { x: 100, y: 2, z: 0 },
      { x: -300, y: 20, z: 400 },
      { x: 0, y: 2, z: -900 },
      { x: 50000, y: 2, z: 0 }, // out of range
      { x: 0, y: 40, z: 0 }, // directly above
      { x: 0, y: -40, z: 0 }, // directly below
      { x: 0, y: 2, z: 0 }, // same point
    ];
    for (const to of targets) {
      const dir = ballisticDirection(origin, to, 240, G, { x: 0, y: 0, z: 0 });
      expect(Math.hypot(dir.x, dir.y, dir.z)).toBeCloseTo(1, 9);
    }
  });

  it('aims horizontally towards the target and lands the shell on it', () => {
    const to = { x: 120, y: 10, z: -160 };
    const dir = ballisticDirection(origin, to, 240, G, { x: 0, y: 0, z: 0 });
    const horizontal = Math.hypot(to.x - origin.x, to.z - origin.z);
    // Horizontal components are parallel to the bearing to the target.
    expect(dir.x / Math.hypot(dir.x, dir.z)).toBeCloseTo((to.x - origin.x) / horizontal, 9);
    expect(dir.z / Math.hypot(dir.x, dir.z)).toBeCloseTo((to.z - origin.z) / horizontal, 9);
    const velocity = { x: dir.x * 240, y: dir.y * 240, z: dir.z * 240 };
    const t = horizontal / Math.hypot(velocity.x, velocity.z);
    const landing = shellPositionAt(origin, velocity, G, t, { x: 0, y: 0, z: 0 });
    expect(landing.x).toBeCloseTo(to.x, 5);
    expect(landing.y).toBeCloseTo(to.y, 5);
    expect(landing.z).toBeCloseTo(to.z, 5);
  });

  it('falls back to 45 degrees when the target is out of reach', () => {
    const dir = ballisticDirection(origin, { x: 50000, y: 2, z: 0 }, 240, G, { x: 0, y: 0, z: 0 });
    expect(dir.y).toBeCloseTo(Math.SQRT1_2, 9);
    expect(dir.x).toBeCloseTo(Math.SQRT1_2, 9);
  });

  it('points straight up or down when the target is directly above or below', () => {
    expect(ballisticDirection(origin, { x: 0, y: 40, z: 0 }, 240, G, { x: 0, y: 0, z: 0 }).y).toBe(1);
    expect(ballisticDirection(origin, { x: 0, y: -40, z: 0 }, 240, G, { x: 0, y: 0, z: 0 }).y).toBe(-1);
  });

  it('writes into and returns the provided object', () => {
    const out = { x: 0, y: 0, z: 0 };
    expect(ballisticDirection(origin, { x: 100, y: 2, z: 0 }, 240, G, out)).toBe(out);
  });
});

describe('leadTarget and shell helpers', () => {
  const shooter = { x: 0, y: 2, z: 0 };
  const target = { x: 240, y: 1.5, z: 0 };

  it('with leadFactor 0 aims at the target regardless of its velocity', () => {
    const out = leadTarget(shooter, target, 30, -20, 240, 0, { x: 0, y: 0, z: 0 });
    expect(out).toEqual({ x: 240, y: 1.5, z: 0 });
  });

  it('with leadFactor 1 leads a receding target by roughly velocity * flight time', () => {
    // Shell speed 240 chasing a target at 240 m moving away at 10 m/s: flight time 240 / 230 s.
    const out = leadTarget(shooter, target, 10, 0, 240, 1, { x: 0, y: 0, z: 0 });
    expect(out.x).toBeCloseTo(240 + 10 * (240 / 230), 1);
    expect(out.z).toBeCloseTo(0, 12);
    expect(out.y).toBe(1.5);
  });

  it('scales the lead with leadFactor', () => {
    const none = leadTarget(shooter, target, 10, 0, 240, 0, { x: 0, y: 0, z: 0 }).x;
    const half = leadTarget(shooter, target, 10, 0, 240, 0.5, { x: 0, y: 0, z: 0 }).x;
    const full = leadTarget(shooter, target, 10, 0, 240, 1, { x: 0, y: 0, z: 0 }).x;
    expect(half).toBeCloseTo(240 + 5 * (240 / 235), 1);
    expect(none).toBeLessThan(half);
    expect(half).toBeLessThan(full);
  });

  it('leads a crossing target sideways', () => {
    const crossing = { x: 0, y: 1.5, z: -240 };
    const out = leadTarget(shooter, crossing, 20, 0, 240, 1, { x: 0, y: 0, z: 0 });
    expect(out.x).toBeGreaterThan(19);
    expect(out.x).toBeLessThan(22);
    expect(out.z).toBeCloseTo(-240, 12);
  });

  it('leaves a stationary target where it is', () => {
    const out = leadTarget(shooter, target, 0, 0, 240, 1, { x: 0, y: 0, z: 0 });
    expect(out).toEqual({ x: 240, y: 1.5, z: 0 });
  });

  it('timeOfFlight divides distance by speed and survives a zero speed', () => {
    expect(timeOfFlight(480, 240)).toBe(2);
    expect(Number.isFinite(timeOfFlight(10, 0))).toBe(true);
  });

  it('shellPositionAt applies uniform motion horizontally and gravity vertically', () => {
    const at = shellPositionAt({ x: 1, y: 2, z: 3 }, { x: 10, y: 20, z: -30 }, 10, 2, { x: 0, y: 0, z: 0 });
    expect(at).toEqual({ x: 21, y: 2 + 40 - 20, z: -57 });
  });
});

describe('hitZone', () => {
  /** Travel direction of a shell fired from a shooter at compass `bearing` from the target. */
  const shellFrom = (bearing: number): [number, number] => [-Math.sin(bearing), Math.cos(bearing)];
  const zoneFor = (targetHeading: number, relativeDegrees: number): HitZone => {
    const [dx, dz] = shellFrom(targetHeading + relativeDegrees * DEG);
    return hitZone(targetHeading, dx, dz);
  };

  it('a shell travelling opposite to the target heading hits the front', () => {
    expect(hitZone(0, 0, 1)).toBe('front');
    expect(hitZone(Math.PI / 2, -1, 0)).toBe('front');
  });

  it('a shell travelling along the target heading hits the rear', () => {
    expect(hitZone(0, 0, -1)).toBe('rear');
    expect(hitZone(Math.PI / 2, 1, 0)).toBe('rear');
  });

  it('a shell crossing the target hits the side', () => {
    expect(hitZone(0, 1, 0)).toBe('side');
    expect(hitZone(0, -1, 0)).toBe('side');
  });

  it.each([0, 1, -2, 3])('classifies by angle relative to a hull heading of %f rad', (heading) => {
    expect(zoneFor(heading, 0)).toBe('front');
    expect(zoneFor(heading, 45)).toBe('front');
    expect(zoneFor(heading, -45)).toBe('front');
    expect(zoneFor(heading, 90)).toBe('side');
    expect(zoneFor(heading, -90)).toBe('side');
    expect(zoneFor(heading, 135)).toBe('side');
    expect(zoneFor(heading, 180)).toBe('rear');
    expect(zoneFor(heading, 150)).toBe('rear');
    expect(zoneFor(heading, -150)).toBe('rear');
  });

  it('switches zone exactly at the configured arcs', () => {
    const front = DAMAGE.frontArc / DEG;
    const rear = DAMAGE.rearArc / DEG;
    expect(zoneFor(0, front - 1)).toBe('front');
    expect(zoneFor(0, front + 1)).toBe('side');
    expect(zoneFor(0, 180 - rear - 1)).toBe('side');
    expect(zoneFor(0, 180 - rear + 1)).toBe('rear');
  });

  it('treats a stationary (zero-length) shell direction as a side hit', () => {
    expect(hitZone(0, 0, 0)).toBe('side');
  });

  it('zoneMultiplier maps each zone to its configured multiplier', () => {
    expect(zoneMultiplier('front')).toBe(DAMAGE.frontMultiplier);
    expect(zoneMultiplier('side')).toBe(DAMAGE.sideMultiplier);
    expect(zoneMultiplier('rear')).toBe(DAMAGE.rearMultiplier);
  });
});

describe('computeDamage', () => {
  it('applies armour and the zone multiplier to the base damage', () => {
    expect(computeDamage({ baseDamage: 100, armor: 0.25, zone: 'front', multiplier: 1 })).toBeCloseTo(100 * 0.75 * DAMAGE.frontMultiplier, 9);
    expect(computeDamage({ baseDamage: 100, armor: 0.25, zone: 'side', multiplier: 1 })).toBeCloseTo(75, 9);
    expect(computeDamage({ baseDamage: 100, armor: 0.25, zone: 'rear', multiplier: 1 })).toBeCloseTo(100 * 0.75 * DAMAGE.rearMultiplier, 9);
  });

  it('applies the extra multiplier, including zero for friendly fire', () => {
    expect(computeDamage({ baseDamage: 40, armor: 0, zone: 'side', multiplier: 0.5 })).toBeCloseTo(20, 9);
    expect(computeDamage({ baseDamage: 40, armor: 0, zone: 'side', multiplier: DAMAGE.friendlyFireMultiplier })).toBe(0);
  });

  it('never returns a negative value', () => {
    expect(computeDamage({ baseDamage: -50, armor: 0, zone: 'rear', multiplier: 1 })).toBe(0);
    expect(computeDamage({ baseDamage: 50, armor: 0, zone: 'rear', multiplier: -2 })).toBe(0);
  });

  it('clamps armour into [0, 0.95]', () => {
    const base = { baseDamage: 100, zone: 'side' as const, multiplier: 1 };
    expect(computeDamage({ ...base, armor: -1 })).toBeCloseTo(100, 9);
    expect(computeDamage({ ...base, armor: 2 })).toBeCloseTo(5, 9);
    expect(computeDamage({ ...base, armor: 1 })).toBeGreaterThan(0);
  });

  it('gives the heavy tank less damage per shell than the standard tank for the same hit', () => {
    const standard = computeDamage({ baseDamage: 30, armor: TANK_SPECS.standard.armor, zone: 'side', multiplier: 1 });
    const heavy = computeDamage({ baseDamage: 30, armor: TANK_SPECS.heavy.armor, zone: 'side', multiplier: 1 });
    expect(heavy).toBeLessThan(standard);
  });
});

describe('applyDamage', () => {
  it('reduces health without destroying a healthy target', () => {
    const target: Damageable = { health: 10, alive: true };
    expect(applyDamage(target, 4)).toBe(false);
    expect(target).toEqual({ health: 6, alive: true });
  });

  it('reports the killing blow exactly once', () => {
    const target: Damageable = { health: 10, alive: true };
    expect(applyDamage(target, 4)).toBe(false);
    expect(applyDamage(target, 10)).toBe(true);
    expect(target).toEqual({ health: 0, alive: false });
    expect(applyDamage(target, 10)).toBe(false);
    expect(applyDamage(target, 1)).toBe(false);
    expect(target.health).toBe(0);
  });

  it('kills on exact lethal damage and never leaves negative health', () => {
    const target: Damageable = { health: 10, alive: true };
    expect(applyDamage(target, 10)).toBe(true);
    expect(target.health).toBe(0);
  });

  it('ignores zero and negative damage', () => {
    const target: Damageable = { health: 10, alive: true };
    expect(applyDamage(target, 0)).toBe(false);
    expect(applyDamage(target, -5)).toBe(false);
    expect(target).toEqual({ health: 10, alive: true });
  });

  it('does not damage a target that is already dead', () => {
    const target: Damageable = { health: 3, alive: false };
    expect(applyDamage(target, 100)).toBe(false);
    expect(target.health).toBe(3);
  });
});

describe('ProjectilePool', () => {
  it('hands out distinct active shells until the pool is exhausted', () => {
    const pool = new ProjectilePool(2);
    const a = pool.acquire();
    const b = pool.acquire();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a).not.toBe(b);
    expect(pool.acquire()).toBeNull();
    expect(pool.activeCount()).toBe(2);
  });

  it('reuses released slots, bumping the generation and resetting the age', () => {
    const pool = new ProjectilePool(1);
    const first = pool.acquire()!;
    expect(first.generation).toBe(1);
    first.age = 3;
    pool.release(first);
    expect(first.active).toBe(false);
    expect(pool.activeCount()).toBe(0);
    const second = pool.acquire()!;
    expect(second).toBe(first);
    expect(second.generation).toBe(2);
    expect(second.age).toBe(0);
  });

  it('clear deactivates every shell', () => {
    const pool = new ProjectilePool(3);
    pool.acquire();
    pool.acquire();
    pool.clear();
    expect(pool.activeCount()).toBe(0);
  });

  it('numbers its slots', () => {
    const pool = new ProjectilePool(3);
    expect(pool.items.map((p) => p.slot)).toEqual([0, 1, 2]);
    expect(pool.items[0]).toBeInstanceOf(Projectile);
  });
});

describe('fireWeapon', () => {
  it('spawns the shell at the muzzle with muzzle speed along the barrel', () => {
    const world = makeFlatWorld();
    const tank = makeTank(1, 'standard', 'enemy', world, 20, -30, 0.8);
    tank.turretYaw = 0.5;
    tank.gunPitch = 8 * DEG;
    const muzzle = new Vector3();
    const direction = new Vector3();
    tank.getMuzzle(muzzle, direction);

    const shell = fireWeapon(tank, new ProjectilePool(2), 1, 16);

    expect(shell).not.toBeNull();
    expect(shell!.x).toBeCloseTo(muzzle.x, 9);
    expect(shell!.y).toBeCloseTo(muzzle.y, 9);
    expect(shell!.z).toBeCloseTo(muzzle.z, 9);
    expect(shell!.prevX).toBe(shell!.x);
    expect(shell!.prevY).toBe(shell!.y);
    expect(shell!.prevZ).toBe(shell!.z);
    const speed = Math.hypot(shell!.vx, shell!.vy, shell!.vz);
    expect(speed).toBeCloseTo(TANK_SPECS.standard.weapon.muzzleSpeed, 9);
    expect(shell!.vx / speed).toBeCloseTo(direction.x, 9);
    expect(shell!.vy / speed).toBeCloseTo(direction.y, 9);
    expect(shell!.vz / speed).toBeCloseTo(direction.z, 9);
  });

  it('records ownership, faction and damage on the shell', () => {
    const world = makeFlatWorld();
    const tank = makeTank(7, 'scout', 'enemy', world);
    const shell = fireWeapon(tank, new ProjectilePool(1), 1, 9)!;
    expect(shell.active).toBe(true);
    expect(shell.ownerId).toBe(7);
    expect(shell.faction).toBe('enemy');
    expect(shell.damage).toBe(9);
  });

  it('fires level shots straight ahead of an unrotated hull', () => {
    const world = makeFlatWorld();
    const tank = makeTank(1, 'player', 'player', world);
    const shell = fireWeapon(tank, new ProjectilePool(1), 1, 34)!;
    expect(shell.vx).toBeCloseTo(0, 9);
    expect(shell.vy).toBeCloseTo(0, 9);
    expect(shell.vz).toBeCloseTo(-TANK_SPECS.player.weapon.muzzleSpeed, 9);
  });

  it('starts the reload, kicks the recoil, and refuses a second immediate shot', () => {
    const world = makeFlatWorld();
    const tank = makeTank(1, 'standard', 'enemy', world);
    const pool = new ProjectilePool(4);
    expect(fireWeapon(tank, pool, 1, 16)).not.toBeNull();
    expect(tank.reload).toBeCloseTo(TANK_SPECS.standard.weapon.reloadTime, 12);
    expect(tank.recoil).toBe(1);
    expect(fireWeapon(tank, pool, 1, 16)).toBeNull();
    expect(pool.activeCount()).toBe(1);
  });

  it('can fire again once the reload has elapsed', () => {
    const world = makeFlatWorld();
    const tank = makeTank(1, 'standard', 'enemy', world);
    const pool = new ProjectilePool(4);
    fireWeapon(tank, pool, 1, 16);
    tank.updateTimers(TANK_SPECS.standard.weapon.reloadTime - 0.01);
    expect(fireWeapon(tank, pool, 1, 16)).toBeNull();
    tank.updateTimers(0.02);
    expect(fireWeapon(tank, pool, 1, 16)).not.toBeNull();
  });

  it('scales the reload by the reload multiplier', () => {
    const world = makeFlatWorld();
    const tank = makeTank(1, 'standard', 'enemy', world);
    fireWeapon(tank, new ProjectilePool(1), 1.45, 16);
    expect(tank.reload).toBeCloseTo(TANK_SPECS.standard.weapon.reloadTime * 1.45, 12);
  });

  it('does not fire a destroyed tank', () => {
    const world = makeFlatWorld();
    const tank = makeTank(1, 'standard', 'enemy', world);
    tank.alive = false;
    const pool = new ProjectilePool(1);
    expect(fireWeapon(tank, pool, 1, 16)).toBeNull();
    expect(pool.activeCount()).toBe(0);
  });

  it('leaves the gun loaded when the shell pool is exhausted', () => {
    const world = makeFlatWorld();
    const tank = makeTank(1, 'standard', 'enemy', world);
    const pool = new ProjectilePool(0);
    expect(fireWeapon(tank, pool, 1, 16)).toBeNull();
    expect(tank.reload).toBe(0);
    expect(tank.recoil).toBe(0);
  });
});

describe('segmentVsTank', () => {
  const world = makeFlatWorld();

  it('hits the hull box front-on and reports the entry distance', () => {
    const tank = makeTank(1, 'standard', 'enemy', world);
    // Hull half width is 1.9 m, so a shot along X at mid-height enters at x = -1.9.
    expect(segmentVsTank(-20, 1.5, 0, 20, 1.5, 0, tank)).toBeCloseTo(18.1 / 40, 9);
    expect(segmentVsTank(0, 1.5, -20, 0, 1.5, 20, tank)).toBeCloseTo(16.4 / 40, 9);
  });

  it('misses beside the hull, even when inside the bounding sphere', () => {
    const tank = makeTank(1, 'standard', 'enemy', world);
    // 4 m off-centre is outside the 3.6 m half length but inside the 4.34 m bounding sphere.
    expect(segmentVsTank(-20, 1.5, 4, 20, 1.5, 4, tank)).toBe(NO_HIT);
    expect(segmentVsTank(-20, 1.5, 8, 20, 1.5, 8, tank)).toBe(NO_HIT);
  });

  it('misses above and below the hull', () => {
    const tank = makeTank(1, 'standard', 'enemy', world);
    expect(segmentVsTank(-20, 3.5, 0, 20, 3.5, 0, tank)).toBe(NO_HIT);
    expect(segmentVsTank(-20, -1, 0, 20, -1, 0, tank)).toBe(NO_HIT);
  });

  it('misses a segment that stops short and one that points away', () => {
    const tank = makeTank(1, 'standard', 'enemy', world);
    expect(segmentVsTank(-20, 1.5, 0, -10, 1.5, 0, tank)).toBe(NO_HIT);
    expect(segmentVsTank(-20, 1.5, 0, -30, 1.5, 0, tank)).toBe(NO_HIT);
  });

  it('follows the hull when the tank is rotated by 90 degrees', () => {
    const tank = makeTank(1, 'standard', 'enemy', world, 0, 0, Math.PI / 2);
    // The 7.2 m long axis now lies along world X: a shot along Z at x = 3 hits...
    expect(segmentVsTank(3, 1.5, -20, 3, 1.5, 20, tank)).not.toBe(NO_HIT);
    // ...and a shot along X at z = 3 passes beside the (now narrow) side.
    expect(segmentVsTank(-20, 1.5, 3, 20, 1.5, 3, tank)).toBe(NO_HIT);
    // The same two shots behave the other way round for an unrotated tank.
    const unrotated = makeTank(2, 'standard', 'enemy', world);
    expect(segmentVsTank(3, 1.5, -20, 3, 1.5, 20, unrotated)).toBe(NO_HIT);
    expect(segmentVsTank(-20, 1.5, 3, 20, 1.5, 3, unrotated)).not.toBe(NO_HIT);
  });

  it('is positioned by the tank location', () => {
    const tank = makeTank(1, 'heavy', 'enemy', world, 100, -50);
    expect(segmentVsTank(80, 2, -50, 120, 2, -50, tank)).toBeCloseTo((20 - TANK_SPECS.heavy.hitHalfExtents.x) / 40, 9);
    expect(segmentVsTank(-20, 2, 0, 20, 2, 0, tank)).toBe(NO_HIT);
  });

  it('returns 0 for a zero-length segment inside the hull', () => {
    const tank = makeTank(1, 'standard', 'enemy', world);
    expect(segmentVsTank(0, 1.5, 0, 0, 1.5, 0, tank)).toBe(0);
  });

  it('hits all eight corners of a level hull when a shot clips them', () => {
    const tank = makeTank(1, 'standard', 'enemy', world, 20, 0, Math.PI / 2);
    expect(clipEveryCorner(tank)).toEqual([]);
  });

  it('hits all eight corners of a hull tilted by a 0.3 gradient when a shot clips them', () => {
    const ramp = new Terrain(300, 5);
    for (let j = 0; j < ramp.resolution; j++) {
      for (let i = 0; i < ramp.resolution; i++) ramp.heights[ramp.index(i, j)] = 0.3 * ramp.vertexX(i);
    }
    const tank = new Tank(1, TANK_SPECS.standard, 'enemy');
    tank.placeAt(20, 0, Math.PI / 2, ramp);
    expect(clipEveryCorner(tank)).toEqual([]);
  });
});

/**
 * Fires a short segment at each hit-box corner (from 3 m outside to 0.3 m inside, along the
 * centre-to-corner diagonal) and returns the corners that were wrongly reported as misses.
 */
function clipEveryCorner(tank: Tank): string[] {
  const h = tank.spec.hitHalfExtents;
  const centre = tank.getCentre(new Vector3());
  const missed: string[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const corner = new Vector3(sx * h.x, h.y + sy * h.y, sz * h.z)
          .applyQuaternion(tank.orientation)
          .add(new Vector3(tank.x, tank.y, tank.z));
        const diagonal = corner.clone().sub(centre).normalize();
        const from = corner.clone().addScaledVector(diagonal, 3);
        const to = corner.clone().addScaledVector(diagonal, -0.3);
        if (segmentVsTank(from.x, from.y, from.z, to.x, to.y, to.z, tank) === NO_HIT) missed.push(`${sx},${sy},${sz}`);
      }
    }
  }
  return missed;
}

describe('stepProjectile', () => {
  function shell(x: number, y: number, z: number, vx: number, vy: number, vz: number, ownerId = 99): Projectile {
    const p = new Projectile(0);
    p.active = true;
    p.ownerId = ownerId;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.damage = 10;
    return p;
  }

  it('advances a free shell under gravity and remembers where it was', () => {
    const world = makeFlatWorld();
    const p = shell(0, 50, 0, 100, 0, 0);
    const hit = createProjectileHit();
    expect(stepProjectile(p, DT, world, [], hit)).toBe(false);
    expect(p.prevX).toBe(0);
    expect(p.prevY).toBe(50);
    expect(p.x).toBeCloseTo(100 * DT, 12);
    expect(p.y).toBeCloseTo(50 - 0.5 * G * DT * DT, 12);
    expect(p.vy).toBeCloseTo(-G * DT, 12);
    expect(p.age).toBeCloseTo(DT, 12);
  });

  it('follows a ballistic arc: a shell aimed by solveElevation lands on the aim point', () => {
    const world = makeFlatWorld();
    const tank = makeTank(1, 'player', 'player', world);
    const muzzle = new Vector3();
    const direction = new Vector3();
    tank.getMuzzle(muzzle, direction);
    const target = { x: 0, y: 0, z: -200 };
    const aim = ballisticDirection(muzzle, target, 240, G, { x: 0, y: 0, z: 0 });
    tank.aimDirection.set(aim.x, aim.y, aim.z);
    const p = shell(muzzle.x, muzzle.y, muzzle.z, aim.x * 240, aim.y * 240, aim.z * 240, tank.id);
    const hit = createProjectileHit();
    let stopped = false;
    for (let i = 0; i < 600 && !stopped; i++) stopped = stepProjectile(p, DT, world, [], hit);
    expect(stopped).toBe(true);
    expect(hit.surface).toBe('terrain');
    expect(Math.abs(hit.z + 200)).toBeLessThan(1);
    expect(Math.abs(hit.x)).toBeLessThan(0.1);
    expect(hit.y).toBeCloseTo(0, 1);
  });

  it('never tunnels through a tank, however the tick phase falls', () => {
    const world = makeFlatWorld();
    const target = makeTank(2, 'standard', 'enemy', world, 0, 30);
    for (let offset = 0; offset < 4; offset += 0.37) {
      const shooter = makeTank(1, 'player', 'player', world, 0, 60 + offset);
      const pool = new ProjectilePool(1);
      const p = fireWeapon(shooter, pool, 1, 34)!;
      const hit = createProjectileHit();
      let stopped = false;
      for (let i = 0; i < 120 && !stopped; i++) stopped = stepProjectile(p, DT, world, [shooter, target], hit);
      expect(stopped).toBe(true);
      expect(hit.surface).toBe('tank');
      expect(hit.tank).toBe(target);
      // The shell comes from the south and hits the rear face of the hull at z = 30 + 3.6.
      expect(hit.z).toBeCloseTo(33.6, 3);
      expect(Math.abs(hit.x)).toBeLessThanOrEqual(1.9 + 1e-6);
      expect(hit.y).toBeGreaterThan(0);
      expect(hit.y).toBeLessThan(2.9);
      expect(hit.obstacle).toBeNull();
      expect(p.x).toBe(hit.x);
      expect(p.z).toBe(hit.z);
    }
  });

  it('catches a fast shell crossing a tank side-on, where a point sample would skip it', () => {
    const world = makeFlatWorld();
    const target = makeTank(2, 'standard', 'enemy', world);
    // Steps are 4 m; samples land at -22, -18, ..., -2, 2: none inside the 3.8 m wide hull.
    const p = shell(-22, 1.4, 0, 240, 0, 0);
    const hit = createProjectileHit();
    let stopped = false;
    for (let i = 0; i < 20 && !stopped; i++) stopped = stepProjectile(p, DT, world, [target], hit);
    expect(stopped).toBe(true);
    expect(hit.surface).toBe('tank');
    expect(hit.x).toBeCloseTo(-1.9, 2);
  });

  it('reports terrain when a shell dives into the ground', () => {
    const world = makeFlatWorld();
    const p = shell(10, 0.5, -20, 0, -60, 0);
    const hit = createProjectileHit();
    expect(stepProjectile(p, DT, world, [], hit)).toBe(true);
    expect(hit.surface).toBe('terrain');
    expect(hit.obstacle).toBeNull();
    expect(hit.tank).toBeNull();
    expect(hit.y).toBeCloseTo(0, 2);
    expect(p.y).toBe(hit.y);
  });

  it('reports an obstacle in the path of a shell', () => {
    const block = makeBlock(0, -20, 3, 10);
    const world = makeFlatWorld([block]);
    const p = shell(0, 5, 0, 0, 0, -240);
    const hit = createProjectileHit();
    let stopped = false;
    for (let i = 0; i < 20 && !stopped; i++) stopped = stepProjectile(p, DT, world, [], hit);
    expect(stopped).toBe(true);
    expect(hit.surface).toBe('obstacle');
    expect(hit.obstacle).toBe(block);
    expect(hit.z).toBeCloseTo(-17, 2);
  });

  it('hits cover in front of a tank rather than the tank behind it', () => {
    const block = makeBlock(0, 30, 3, 10);
    const target = makeTank(2, 'standard', 'enemy', makeFlatWorld());
    const covered = makeFlatWorld([block]);
    const open = makeFlatWorld();
    for (const [world, expected] of [[covered, 'obstacle'], [open, 'tank']] as const) {
      const p = shell(0, 1.4, 60, 0, 0, -240);
      const hit = createProjectileHit();
      let stopped = false;
      for (let i = 0; i < 40 && !stopped; i++) stopped = stepProjectile(p, DT, world, [target], hit);
      expect(hit.surface).toBe(expected);
    }
  });

  it('does not let a shell hit its own firing tank at launch', () => {
    const world = makeFlatWorld();
    const tank = makeTank(5, 'standard', 'enemy', world);
    const inside = shell(0, 1.4, 0, 50, 0, 0, 5);
    const hit = createProjectileHit();
    expect(stepProjectile(inside, DT, world, [tank], hit)).toBe(false);
  });

  it('does hit a different tank from the same position', () => {
    const world = makeFlatWorld();
    const tank = makeTank(5, 'standard', 'enemy', world);
    const stranger = shell(0, 1.4, 0, 50, 0, 0, 6);
    const hit = createProjectileHit();
    expect(stepProjectile(stranger, DT, world, [tank], hit)).toBe(true);
    expect(hit.surface).toBe('tank');
  });

  it('hits the owner once the shell is old enough to have cleared the barrel', () => {
    const world = makeFlatWorld();
    const tank = makeTank(5, 'standard', 'enemy', world);
    const returning = shell(0, 1.4, 0, 50, 0, 0, 5);
    returning.age = 0.3;
    const hit = createProjectileHit();
    expect(stepProjectile(returning, DT, world, [tank], hit)).toBe(true);
    expect(hit.tank).toBe(tank);
  });

  it('a real shell leaves its own barrel without registering a hit', () => {
    const world = makeFlatWorld();
    const tank = makeTank(1, 'player', 'player', world);
    const p = fireWeapon(tank, new ProjectilePool(1), 1, 34)!;
    const hit = createProjectileHit();
    for (let i = 0; i < 30; i++) expect(stepProjectile(p, DT, world, [tank], hit)).toBe(false);
  });

  it('expires a shell after PROJECTILE.maxLifetime', () => {
    const world = makeFlatWorld();
    const p = shell(0, 5, 0, 0, 240, 0);
    const hit = createProjectileHit();
    let steps = 0;
    let stopped = false;
    while (!stopped && steps < 400) {
      stopped = stepProjectile(p, DT, world, [], hit);
      steps++;
    }
    expect(stopped).toBe(true);
    expect(hit.surface).toBe('expired');
    expect(hit.tank).toBeNull();
    expect(hit.obstacle).toBeNull();
    expect(p.age).toBeGreaterThan(PROJECTILE.maxLifetime);
    expect(p.age).toBeLessThan(PROJECTILE.maxLifetime + 2 * DT);
  });

  it('expires a shell that leaves the terrain', () => {
    const world = makeFlatWorld();
    const p = shell(290, 300, 0, 240, 0, 0);
    const hit = createProjectileHit();
    let stopped = false;
    for (let i = 0; i < 20 && !stopped; i++) stopped = stepProjectile(p, DT, world, [], hit);
    expect(stopped).toBe(true);
    expect(hit.surface).toBe('expired');
    expect(p.age).toBeLessThan(PROJECTILE.maxLifetime);
    expect(hit.x).toBeGreaterThan(300);
  });
});
