/**
 * Steering for AI tanks: seek a goal while avoiding obstacles, other tanks and
 * the battlefield boundary. Produces the same throttle/turn controls a player
 * would, so enemies obey identical vehicle physics.
 */
import { AI } from '../config/settings';
import type { Tank } from '../entities/Tank';
import { angleDiff, clamp, headingOf } from '../utils/math';
import type { Obstacle } from '../world/Obstacle';
import type { World } from '../world/World';

export interface SteeringOutput {
  throttle: number;
  turn: number;
}

const nearby: Obstacle[] = [];
const BOUNDARY_SOFT_ZONE = 40;
const MAX_SAFE_SLOPE = 0.42;

/**
 * Steers `tank` towards (tx, tz) at `speedFraction` of its top speed.
 * Writes into `out` and returns the remaining distance to the goal.
 */
export function steerTowards(
  tank: Tank,
  tx: number,
  tz: number,
  speedFraction: number,
  world: World,
  tanks: readonly Tank[],
  out: SteeringOutput,
  arrivalDistance = 8,
): number {
  const dx = tx - tank.x;
  const dz = tz - tank.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.5) {
    out.throttle = 0;
    out.turn = 0;
    return dist;
  }
  let sx = dx / dist;
  let sz = dz / dist;

  const fx = Math.sin(tank.heading);
  const fz = -Math.cos(tank.heading);
  const rx = Math.cos(tank.heading);
  const rz = Math.sin(tank.heading);
  const radius = tank.spec.collisionRadius;

  // Obstacle avoidance: push sideways away from anything in the path ahead.
  const lookAhead = AI.avoidLookAhead + Math.abs(tank.speed) * 1.5;
  world.obstaclesNear(tank.x + fx * lookAhead * 0.5, tank.z + fz * lookAhead * 0.5, lookAhead, nearby);
  for (const ob of nearby) {
    const ox = ob.x - tank.x;
    const oz = ob.z - tank.z;
    const along = ox * fx + oz * fz;
    if (along < -ob.boundRadius || along > lookAhead + ob.boundRadius) continue;
    const lateral = ox * rx + oz * rz;
    const clearance = ob.boundRadius + radius + 3;
    if (Math.abs(lateral) > clearance) continue;
    const proximity = 1 - clamp(along / (lookAhead + ob.boundRadius), 0, 1);
    const overlap = 1 - Math.abs(lateral) / clearance;
    const side = lateral >= 0 ? -1 : 1;
    const weight = 2.5 * proximity * (0.4 + overlap);
    sx += rx * side * weight;
    sz += rz * side * weight;
  }

  // Separation from other tanks (including wrecks).
  for (const other of tanks) {
    if (other === tank) continue;
    const ox = tank.x - other.x;
    const oz = tank.z - other.z;
    const d = Math.hypot(ox, oz);
    const range = AI.separationRadius + other.spec.collisionRadius;
    if (d < 1e-3 || d > range) continue;
    const w = (1 - d / range) * 1.8;
    sx += (ox / d) * w;
    sz += (oz / d) * w;
  }

  // Stay inside the playable square.
  const limit = world.playableHalfSize - BOUNDARY_SOFT_ZONE;
  if (tank.x > limit) sx -= (tank.x - limit) / BOUNDARY_SOFT_ZONE * 3;
  if (tank.x < -limit) sx -= (tank.x + limit) / BOUNDARY_SOFT_ZONE * 3;
  if (tank.z > limit) sz -= (tank.z - limit) / BOUNDARY_SOFT_ZONE * 3;
  if (tank.z < -limit) sz -= (tank.z + limit) / BOUNDARY_SOFT_ZONE * 3;

  // Avoid steep ground just ahead.
  const probeX = tank.x + fx * 12;
  const probeZ = tank.z + fz * 12;
  if (world.terrain.slopeAt(probeX, probeZ, 3) > MAX_SAFE_SLOPE) {
    sx -= fx * 0.8;
    sz -= fz * 0.8;
    sx += rx * 0.6;
    sz += rz * 0.6;
  }

  const desiredHeading = headingOf(sx, sz);
  const error = angleDiff(tank.heading, desiredHeading);
  out.turn = clamp(error * 2.2, -1, 1);
  const misalignment = Math.abs(error);
  let throttle = speedFraction * (misalignment > 1.4 ? 0.1 : clamp(1 - misalignment / 1.6, 0.15, 1));
  const slowZone = arrivalDistance * 3;
  if (dist < slowZone) throttle *= clamp(dist / slowZone, 0.25, 1);
  out.throttle = throttle;
  return dist;
}

/** Holds position while rotating the hull to face (tx, tz). */
export function faceTowards(tank: Tank, tx: number, tz: number, out: SteeringOutput): void {
  const error = angleDiff(tank.heading, headingOf(tx - tank.x, tz - tank.z));
  out.throttle = 0;
  out.turn = Math.abs(error) < 0.05 ? 0 : clamp(error * 2, -1, 1);
}

/** Backs away from (ax, az) while keeping the nose pointed at it. */
export function reverseAwayFrom(tank: Tank, ax: number, az: number, out: SteeringOutput): void {
  faceTowards(tank, ax, az, out);
  out.throttle = -0.75;
}
