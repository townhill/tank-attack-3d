/** Cannon firing and swept projectile collision. */
import { Quaternion, Vector3 } from 'three';
import { PROJECTILE, WORLD } from '../config/settings';
import type { Projectile, ProjectilePool } from '../entities/Projectile';
import type { Tank } from '../entities/Tank';
import { NO_HIT, segmentVsAabb } from '../world/Collision';
import type { Obstacle } from '../world/Obstacle';
import type { StaticHit, World } from '../world/World';
import { createStaticHit } from '../world/World';

const muzzlePos = new Vector3();
const muzzleDir = new Vector3();

/** Fires the tank's cannon if loaded. Returns the spawned shell or null. */
export function fireWeapon(tank: Tank, pool: ProjectilePool, reloadMultiplier: number, damage: number): Projectile | null {
  if (!tank.alive || tank.reload > 0) return null;
  const p = pool.acquire();
  if (!p) return null;
  tank.getMuzzle(muzzlePos, muzzleDir);
  const speed = tank.spec.weapon.muzzleSpeed;
  p.ownerId = tank.id;
  p.faction = tank.faction;
  p.x = p.prevX = muzzlePos.x;
  p.y = p.prevY = muzzlePos.y;
  p.z = p.prevZ = muzzlePos.z;
  p.vx = muzzleDir.x * speed;
  p.vy = muzzleDir.y * speed;
  p.vz = muzzleDir.z * speed;
  p.damage = damage;
  tank.reload = tank.spec.weapon.reloadTime * reloadMultiplier;
  tank.recoil = 1;
  return p;
}

const invQuat = new Quaternion();
const localA = new Vector3();
const localB = new Vector3();

/** Segment against a tank's oriented hit box. Returns t in [0, 1] or NO_HIT. */
export function segmentVsTank(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  tank: Tank,
): number {
  const h = tank.spec.hitHalfExtents;
  // Cheap sphere rejection before the oriented box test; the centre follows the hull's tilt.
  const cx = tank.x + tank.up.x * h.y;
  const cy = tank.y + tank.up.y * h.y;
  const cz = tank.z + tank.up.z * h.y;
  const bound = Math.hypot(h.x, h.y, h.z) + 0.05;
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const lenSq = dx * dx + dy * dy + dz * dz;
  let t = lenSq > 0 ? ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / lenSq : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + dx * t - cx;
  const py = ay + dy * t - cy;
  const pz = az + dz * t - cz;
  if (px * px + py * py + pz * pz > bound * bound) return NO_HIT;

  invQuat.copy(tank.orientation).invert();
  localA.set(ax - tank.x, ay - tank.y, az - tank.z).applyQuaternion(invQuat);
  localB.set(bx - tank.x, by - tank.y, bz - tank.z).applyQuaternion(invQuat);
  return segmentVsAabb(localA.x, localA.y - h.y, localA.z, localB.x, localB.y - h.y, localB.z, h.x, h.y, h.z);
}

export type HitSurface = 'tank' | 'obstacle' | 'terrain' | 'expired';

export interface ProjectileHit {
  surface: HitSurface;
  x: number;
  y: number;
  z: number;
  tank: Tank | null;
  obstacle: Obstacle | null;
}

export function createProjectileHit(): ProjectileHit {
  return { surface: 'expired', x: 0, y: 0, z: 0, tank: null, obstacle: null };
}

const staticHit: StaticHit = createStaticHit();

/**
 * Advances a shell by one tick and tests the swept segment against tanks,
 * obstacles and terrain, so fast shells cannot tunnel through anything.
 * Returns true when the shell stopped; details are written to `hit`.
 */
export function stepProjectile(
  p: Projectile,
  dt: number,
  world: World,
  tanks: readonly Tank[],
  hit: ProjectileHit,
): boolean {
  p.prevX = p.x;
  p.prevY = p.y;
  p.prevZ = p.z;
  const g = WORLD.gravity;
  const nx = p.x + p.vx * dt;
  const ny = p.y + p.vy * dt - 0.5 * g * dt * dt;
  const nz = p.z + p.vz * dt;
  p.vy -= g * dt;
  p.age += dt;

  let bestT = NO_HIT;
  let bestTank: Tank | null = null;
  for (const tank of tanks) {
    // A shell cannot hit the tank that fired it during its first moments of flight.
    if (tank.id === p.ownerId && p.age < 0.25) continue;
    const t = segmentVsTank(p.x, p.y, p.z, nx, ny, nz, tank);
    if (t < bestT) {
      bestT = t;
      bestTank = tank;
    }
  }
  world.raycastStatic(p.x, p.y, p.z, nx, ny, nz, staticHit);
  let surface: HitSurface = 'tank';
  let obstacle: Obstacle | null = null;
  if (staticHit.t < bestT) {
    bestT = staticHit.t;
    bestTank = null;
    obstacle = staticHit.obstacle;
    surface = obstacle ? 'obstacle' : 'terrain';
  }

  if (bestT !== NO_HIT) {
    hit.surface = surface;
    hit.x = p.x + (nx - p.x) * bestT;
    hit.y = p.y + (ny - p.y) * bestT;
    hit.z = p.z + (nz - p.z) * bestT;
    hit.tank = bestTank;
    hit.obstacle = obstacle;
    p.x = hit.x;
    p.y = hit.y;
    p.z = hit.z;
    return true;
  }

  p.x = nx;
  p.y = ny;
  p.z = nz;
  const outside = Math.abs(nx) > world.terrain.halfSize || Math.abs(nz) > world.terrain.halfSize;
  if (p.age > PROJECTILE.maxLifetime || outside) {
    hit.surface = 'expired';
    hit.x = nx;
    hit.y = ny;
    hit.z = nz;
    hit.tank = null;
    hit.obstacle = null;
    return true;
  }
  return false;
}
