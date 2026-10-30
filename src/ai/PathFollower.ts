/**
 * Leads one enemy along a planned route whenever water stands between it
 * and its goal: re-plans when the goal moves, the route grows old or the
 * tank strays, sees a bridge crossing through once started, and holds the
 * tank on the approach while oncoming enemies have the deck.
 */
import { NAV } from '../config/settings';
import type { Tank } from '../entities/Tank';
import type { NavPlanner } from './NavPlanner';
import { Route } from './PathFinder';

/** Within this distance of the line-up point a tank asks for the bridge (metres)... */
const CLAIM_DISTANCE = 30;
/** ...and, when refused, waits once it is this close to it. */
const HOLD_DISTANCE = 8;
/** A goal that has moved less than this counts as standing still (metres). */
const GOAL_STILL = 1;

/** Where to steer next. */
export interface Waypoint {
  x: number;
  z: number;
  /** Distance at which it counts as reached. */
  arrival: number;
  /** True while the tank should stop and wait for a bridge to clear. */
  hold: boolean;
}

export function createWaypoint(): Waypoint {
  return { x: 0, z: 0, arrival: NAV.waypointRadius, hold: false };
}

export class PathFollower {
  private readonly route = new Route();
  private index = 0;
  private active = false;
  private stale = false;
  private goalX = 0;
  private goalZ = 0;
  private plannedAt = -Infinity;
  /** Start of the stretch of route being driven, for spotting a tank that has strayed. */
  private fromX = 0;
  private fromZ = 0;

  /** Drops the route at the next decision, after an unstick manoeuvre for example. */
  invalidate(): void {
    this.stale = true;
  }

  /**
   * Fills `out` with where to steer to reach (gx, gz) and returns true, or
   * returns false when nothing stands in the way and the tank may steer
   * straight at the goal. Routes are only planned on `think` ticks.
   */
  steer(tank: Tank, gx: number, gz: number, planner: NavPlanner, think: boolean, time: number, out: Waypoint): boolean {
    if (think) this.decide(tank, gx, gz, planner, time);
    if (!this.active) return false;
    this.advance(tank);
    const route = this.route;
    if (this.index >= route.count) {
      this.active = false;
      return false;
    }
    const k = this.index;
    out.x = route.xs[k]!;
    out.z = route.zs[k]!;
    const crossing = route.bridgeId >= 0 && k >= route.crossingStart;
    out.arrival = crossing ? NAV.bridgeWaypointRadius : NAV.waypointRadius;
    out.hold = false;
    if (crossing && tank.bridgeId < 0 && k <= route.crossingStart + 1) {
      const toLineUp = Math.hypot(route.xs[route.crossingStart]! - tank.x, route.zs[route.crossingStart]! - tank.z);
      const onApproach = k > route.crossingStart;
      if ((onApproach || toLineUp < CLAIM_DISTANCE) && !planner.claimCrossing(route.bridgeId, route.direction)) {
        out.hold = onApproach || toLineUp < HOLD_DISTANCE;
      }
    }
    return true;
  }

  private decide(tank: Tank, gx: number, gz: number, planner: NavPlanner, time: number): void {
    // A crossing is driven through as planned once the tank is on the deck, and from its
    // line-up point onto the deck unless the tank is shoved off the approach or gets stuck.
    const route = this.route;
    if (this.active && route.bridgeId >= 0) {
      if (tank.bridgeId >= 0) return;
      const approaching = this.index === route.crossingStart + 1;
      if (approaching && !this.stale && !this.strayed(tank)) return;
    }
    if (tank.bridgeId < 0 && planner.isDirectRouteClear(tank, gx, gz)) {
      this.active = false;
      return;
    }
    const shift = Math.hypot(gx - this.goalX, gz - this.goalZ);
    const replan =
      !this.active ||
      this.stale ||
      shift > NAV.replanGoalShift ||
      (shift > GOAL_STILL && time - this.plannedAt > NAV.replanInterval) ||
      this.strayed(tank);
    if (!replan || !planner.canPlan()) return;
    this.active = planner.planLeg(tank, gx, gz, this.route);
    this.index = 0;
    this.fromX = tank.x;
    this.fromZ = tank.z;
    this.goalX = gx;
    this.goalZ = gz;
    this.plannedAt = time;
    this.stale = false;
  }

  /** Moves on past every waypoint the tank has reached, or has driven past towards the next one. */
  private advance(tank: Tank): void {
    const route = this.route;
    while (this.index < route.count) {
      const k = this.index;
      const x = route.xs[k]!;
      const z = route.zs[k]!;
      const crossing = route.bridgeId >= 0 && k >= route.crossingStart;
      const arrival = crossing ? NAV.bridgeWaypointRadius : NAV.waypointRadius;
      let passed = Math.hypot(x - tank.x, z - tank.z) < arrival;
      // The line-up point has to be reached; any other waypoint also counts once the tank is past it.
      if (!passed && k + 1 < route.count && k !== route.crossingStart) {
        const nx = route.xs[k + 1]!;
        const nz = route.zs[k + 1]!;
        passed = crossing
          ? (tank.x - x) * (nx - x) + (tank.z - z) * (nz - z) > 0
          : Math.hypot(nx - tank.x, nz - tank.z) < Math.hypot(nx - x, nz - z);
      }
      if (!passed) return;
      this.fromX = x;
      this.fromZ = z;
      this.index++;
    }
  }

  /** True when the tank is further than the stray distance from the stretch of route it is driving. */
  private strayed(tank: Tank): boolean {
    if (!this.active || this.index >= this.route.count) return false;
    const x = this.route.xs[this.index]!;
    const z = this.route.zs[this.index]!;
    const dx = x - this.fromX;
    const dz = z - this.fromZ;
    const lenSq = dx * dx + dz * dz;
    let t = lenSq > 0 ? ((tank.x - this.fromX) * dx + (tank.z - this.fromZ) * dz) / lenSq : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(tank.x - this.fromX - dx * t, tank.z - this.fromZ - dz * t) > NAV.strayDistance;
  }
}
