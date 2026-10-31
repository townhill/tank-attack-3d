/**
 * Route planning shared by every enemy: a cap on path searches per tick,
 * legs that cross rivers by the best bridge or ford for each tank, and right
 * of way on each bridge for enemies already crossing it. Everything is
 * decided in tank order from simulation state, so planning stays
 * deterministic.
 */
import { NAV } from '../config/settings';
import type { Tank } from '../entities/Tank';
import type { Bridge } from '../world/Bridge';
import type { NavGrid, Portal, PortalEnd } from '../world/NavGrid';
import { toWorldX, toWorldZ } from '../world/Obstacle';
import type { World } from '../world/World';
import type { Route } from './PathFinder';
import { PathFinder } from './PathFinder';

/** Driving across a bank costs this much more than the straight line between two points on it. */
const DETOUR_FACTOR = 1.3;
/** Crossings line up on the approach this far beyond the deck end, or at the ramp's foot if nearer (metres). */
const LINE_UP_DISTANCE = 22;
/** Crossing waypoints on the road sit this far inside each deck end (metres). */
const DECK_INSET = 4;
/** Waypoints kept free at the end of a route for the crossing that follows the approach. */
const CROSSING_WAYPOINTS = 3;
/** Wading a ford counts this much longer than its width, for the slower going in the water. */
const FORD_COST_FACTOR = 1.6;

interface Crossing {
  readonly portal: Portal;
  /** The end the tank sets off from: onto the deck, or into the ford. */
  readonly end: PortalEnd;
}

export class NavPlanner {
  readonly nav: NavGrid;
  readonly finder: PathFinder;
  /** Most searches started in one tick and most cells one search expanded, for tests and tuning. */
  readonly stats = { maxPlansInTick: 0, maxExpanded: 0 };
  private readonly bridges: readonly Bridge[];
  /** Direction of travel along each deck that holds right of way this tick, or 0 while it is free. */
  private readonly rightOfWay: Int8Array;
  private plansLeft: number = NAV.plansPerTick;
  private plansThisTick = 0;
  private readonly nodeCost: Float64Array;
  private readonly nodeFrom: Int32Array;
  private readonly nodeDone: Uint8Array;

  constructor(world: World) {
    this.nav = world.nav;
    this.bridges = world.bridges;
    this.finder = new PathFinder(this.nav);
    this.rightOfWay = new Int8Array(world.bridges.length);
    const nodes = 2 + 2 * this.nav.portals.length;
    this.nodeCost = new Float64Array(nodes);
    this.nodeFrom = new Int32Array(nodes);
    this.nodeDone = new Uint8Array(nodes);
  }

  /** Starts a tick: renews the search budget and gives each bridge to the enemy traffic already on it. */
  beginTick(tanks: readonly Tank[]): void {
    this.plansLeft = NAV.plansPerTick;
    this.plansThisTick = 0;
    this.rightOfWay.fill(0);
    for (const t of tanks) {
      const b = this.bridges[t.bridgeId];
      if (b && t.alive && t.faction === 'enemy') this.rightOfWay[t.bridgeId] = travelDirection(b, t.heading);
    }
  }

  /** True while this tick still has a path search to spare. */
  canPlan(): boolean {
    return this.plansLeft > 0;
  }

  /**
   * Asks for the way onto bridge `bridgeId` in `direction`. True when the
   * deck is free or already held for that direction this tick; the first
   * claim on a free deck takes it.
   */
  claimCrossing(bridgeId: number, direction: number): boolean {
    const held = this.rightOfWay[bridgeId];
    if (held === undefined) return true;
    if (held === 0) {
      this.rightOfWay[bridgeId] = direction;
      return true;
    }
    return held === direction;
  }

  /** True when the tank can drive straight at (gx, gz) on its own bank without meeting deep water. */
  isDirectRouteClear(tank: Tank, gx: number, gz: number): boolean {
    const nav = this.nav;
    return nav.isWaterClear(tank.x, tank.z, gx, gz, tank.spec.collisionRadius + 1) && nav.sideAt(tank.x, tank.z) === nav.sideAt(gx, gz);
  }

  /**
   * Plans the tank's next leg towards (gx, gz) into `route`: straight there
   * on the same bank, or to and across the best bridge towards another bank
   * (the next leg starts from the far side). Returns false when no leg could
   * be planned; a partial leg that makes progress still counts.
   */
  planLeg(tank: Tank, gx: number, gz: number, route: Route): boolean {
    route.clear();
    this.plansLeft--;
    this.plansThisTick++;
    this.stats.maxPlansInTick = Math.max(this.stats.maxPlansInTick, this.plansThisTick);
    if (this.bridges[tank.bridgeId]) return this.finishCrossing(tank, route);
    const nav = this.nav;
    const wading = nav.fordAt(tank.x, tank.z);
    if (wading >= 0) return this.finishFord(tank, wading, gx, gz, route);
    const from = nav.sideAt(tank.x, tank.z);
    const to = nav.sideAt(gx, gz);
    if (from < 0 || to < 0) return false;
    if (from === to) return this.search(tank.x, tank.z, gx, gz, route) || route.count > 0;

    const crossing = this.chooseCrossing(tank, from, to, gx, gz);
    if (!crossing) return false;
    if (crossing.portal.bridgeId < 0) return this.planFord(tank, crossing, route);
    const bridgeId = crossing.portal.bridgeId;
    const b = this.bridges[bridgeId]!;
    const sign = crossing.end.sign;
    const direction = -sign;
    const lane = -direction * NAV.laneOffset;
    const approachLane = -direction * NAV.approachLaneOffset;
    const lineUp = sign * (b.halfLength + Math.min(LINE_UP_DISTANCE, b.rampLength));
    const reached = this.search(tank.x, tank.z, deckX(b, lineUp, approachLane), deckZ(b, lineUp, approachLane), route);
    if (!reached || route.count > route.xs.length - CROSSING_WAYPOINTS) return route.count > 0;
    route.bridgeId = bridgeId;
    route.direction = direction;
    route.crossingStart = route.count - 1;
    for (const along of [sign * (b.halfLength - DECK_INSET), -sign * (b.halfLength - DECK_INSET)]) {
      route.push(deckX(b, along, lane), deckZ(b, along, lane));
    }
    route.push(deckX(b, -lineUp, approachLane), deckZ(b, -lineUp, approachLane));
    return true;
  }

  private search(sx: number, sz: number, gx: number, gz: number, route: Route): boolean {
    const found = this.finder.find(sx, sz, gx, gz, route);
    this.stats.maxExpanded = Math.max(this.stats.maxExpanded, this.finder.lastExpanded);
    return found;
  }

  /** To the near bank of a ford, then straight across the shallows to the far bank. */
  private planFord(tank: Tank, crossing: Crossing, route: Route): boolean {
    const near = crossing.end;
    const far = farEnd(crossing.portal, near);
    const reached = this.search(tank.x, tank.z, near.x, near.z, route);
    if (!reached || !route.push(far.x, far.z)) return route.count > 0;
    return true;
  }

  /**
   * The rest of a ford crossing already under way: out onto the goal's bank,
   * or onto the bank ahead when the goal lies on neither.
   */
  private finishFord(tank: Tank, fordId: number, gx: number, gz: number, route: Route): boolean {
    const portal = this.nav.portals.find((p) => p.fordId === fordId);
    if (!portal) return false;
    const [a, b] = portal.ends;
    const to = this.nav.sideAt(gx, gz);
    let exit: PortalEnd;
    if (a.side === to) exit = a;
    else if (b.side === to) exit = b;
    else {
      const fx = Math.sin(tank.heading);
      const fz = -Math.cos(tank.heading);
      exit = (a.x - tank.x) * fx + (a.z - tank.z) * fz >= (b.x - tank.x) * fx + (b.z - tank.z) * fz ? a : b;
    }
    route.push(exit.x, exit.z);
    return true;
  }

  /** The rest of a crossing already under way: off the far end the tank is facing. */
  private finishCrossing(tank: Tank, route: Route): boolean {
    const b = this.bridges[tank.bridgeId]!;
    const direction = travelDirection(b, tank.heading);
    const lane = -direction * NAV.laneOffset;
    route.bridgeId = tank.bridgeId;
    route.direction = direction;
    route.crossingStart = 0;
    route.push(deckX(b, direction * (b.halfLength - DECK_INSET), lane), deckZ(b, direction * (b.halfLength - DECK_INSET), lane));
    const departure = direction * (b.halfLength + Math.min(LINE_UP_DISTANCE, b.rampLength));
    const approachLane = -direction * NAV.approachLaneOffset;
    route.push(deckX(b, departure, approachLane), deckZ(b, departure, approachLane));
    return true;
  }

  /**
   * The first crossing on the cheapest way from the tank to (gx, gz), found
   * by Dijkstra over the tank, the goal and both ends of every bridge and
   * ford. Each enemy adds its own small preference to each crossing, so a
   * pack spreads out.
   */
  private chooseCrossing(tank: Tank, from: number, to: number, gx: number, gz: number): Crossing | null {
    const portals = this.nav.portals;
    const n = 2 + 2 * portals.length;
    const cost = this.nodeCost;
    const prev = this.nodeFrom;
    const done = this.nodeDone;
    cost.fill(Infinity);
    prev.fill(-1);
    done.fill(0);
    cost[0] = 0;
    const endOf = (node: number): PortalEnd => portals[(node - 2) >> 1]!.ends[(node - 2) & 1]!;
    const sideOf = (node: number): number => (node === 0 ? from : node === 1 ? to : endOf(node).side);
    const xOf = (node: number): number => (node === 0 ? tank.x : node === 1 ? gx : endOf(node).x);
    const zOf = (node: number): number => (node === 0 ? tank.z : node === 1 ? gz : endOf(node).z);
    const relax = (u: number, v: number, w: number): void => {
      if (cost[u]! + w < cost[v]!) {
        cost[v] = cost[u]! + w;
        prev[v] = u;
      }
    };
    for (;;) {
      let u = -1;
      for (let v = 0; v < n; v++) if (done[v] === 0 && cost[v]! < Infinity && (u < 0 || cost[v]! < cost[u]!)) u = v;
      if (u < 0 || u === 1) break;
      done[u] = 1;
      const side = sideOf(u);
      for (let v = 1; v < n; v++) {
        if (v === u || sideOf(v) !== side) continue;
        relax(u, v, Math.hypot(xOf(v) - xOf(u), zOf(v) - zOf(u)) * DETOUR_FACTOR);
      }
      if (u >= 2) {
        const portal = portals[(u - 2) >> 1]!;
        const wade = portal.fordId >= 0;
        const length = wade ? portal.length * FORD_COST_FACTOR : portal.length;
        relax(u, u ^ 1, length + preference(tank.id, wade ? this.bridges.length + portal.fordId : portal.bridgeId));
      }
    }
    if (cost[1] === Infinity) return null;
    let node = 1;
    while (prev[node]! > 0) node = prev[node]!;
    if (node < 2) return null;
    return { portal: portals[(node - 2) >> 1]!, end: endOf(node) };
  }
}

/** The other end of `portal` from `end`. */
function farEnd(portal: Portal, end: PortalEnd): PortalEnd {
  return portal.ends[0] === end ? portal.ends[1] : portal.ends[0];
}

/** Direction of travel along a deck for a tank heading `heading`: the sign of the change in `along`. */
function travelDirection(b: Bridge, heading: number): number {
  const ax = toWorldX(0, 1, b.yaw);
  const az = toWorldZ(0, 1, b.yaw);
  return Math.sin(heading) * ax - Math.cos(heading) * az >= 0 ? 1 : -1;
}

function deckX(b: Bridge, along: number, lateral: number): number {
  return b.x + toWorldX(lateral, along, b.yaw);
}

function deckZ(b: Bridge, along: number, lateral: number): number {
  return b.z + toWorldZ(lateral, along, b.yaw);
}

/** A tank's own extra cost for a crossing, fixed per tank and crossing (metres). */
function preference(tankId: number, bridgeId: number): number {
  let h = Math.imul(tankId + 1, 0x9e3779b1) ^ Math.imul(bridgeId + 1, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return ((h >>> 0) / 4294967296) * NAV.bridgePreference;
}
