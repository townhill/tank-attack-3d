/**
 * Development helpers that say where to put the player so a river crossing
 * can be seen and tried: on the approach to the nearest bridge, or on the
 * bank beside the nearest ford, facing across the river either way.
 */
import { toWorldX, toWorldZ } from '../world/Obstacle';
import type { World } from '../world/World';

/** How far back from a bridge's deck end, or a ford's bank, the player stands (metres). */
const APPROACH = 20;

export interface Placement {
  readonly x: number;
  readonly z: number;
  /** Compass heading of the hull. */
  readonly heading: number;
}

/** Item of `items` nearest (x, z), or undefined when there is none. */
function nearest<T extends { readonly x: number; readonly z: number }>(items: readonly T[], x: number, z: number): T | undefined {
  let best: T | undefined;
  let bestDistance = Infinity;
  for (const item of items) {
    const d = Math.hypot(item.x - x, item.z - z);
    if (d < bestDistance) {
      best = item;
      bestDistance = d;
    }
  }
  return best;
}

/** On the road beyond one end of the bridge nearest (x, z), facing along the deck; null without bridges. */
export function bridgeApproach(world: World, x: number, z: number): Placement | null {
  const b = nearest(world.bridges, x, z);
  if (!b) return null;
  const along = b.halfLength + APPROACH;
  return { x: b.x + toWorldX(0, along, b.yaw), z: b.z + toWorldZ(0, along, b.yaw), heading: b.yaw };
}

/** On the bank beside the ford nearest (x, z), facing square across the flow; null without fords. */
export function fordApproach(world: World, x: number, z: number): Placement | null {
  const f = nearest(world.fords, x, z);
  if (!f) return null;
  // Across the river: the flow direction turned a quarter.
  const ax = -f.tz;
  const az = f.tx;
  const back = f.halfWidth + APPROACH;
  return { x: f.x - ax * back, z: f.z - az * back, heading: Math.atan2(ax, -az) };
}
