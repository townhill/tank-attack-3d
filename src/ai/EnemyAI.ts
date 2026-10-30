/**
 * Per-enemy controller: perception, state-machine driven decisions, movement
 * goals, turret aiming with imperfect accuracy, and fire control.
 * Independent of rendering; writes only to the tank's controls and aim.
 */
import { Vector3 } from 'three';
import type { DifficultySpec, EnemyKind } from '../config/settings';
import { AI, WORLD } from '../config/settings';
import { ballisticDirection, leadTarget } from '../combat/Ballistics';
import { segmentVsTank } from '../combat/WeaponSystem';
import type { Tank } from '../entities/Tank';
import { clamp, headingOf, TAU } from '../utils/math';
import type { Random } from '../utils/random';
import type { PlanarVector } from '../world/distanceField';
import type { World } from '../world/World';
import type { NavPlanner } from './NavPlanner';
import type { SteeringOutput } from './Navigation';
import { faceTowards, reverseAwayFrom, steerTowards } from './Navigation';
import type { Waypoint } from './PathFollower';
import { createWaypoint, PathFollower } from './PathFollower';
import type { AIState } from './StateMachine';
import { decideNextState, isCombatState } from './StateMachine';

export interface AIContext {
  readonly world: World;
  readonly player: Tank;
  readonly tanks: readonly Tank[];
  readonly difficulty: DifficultySpec;
  /** Multiplier on aim error; shrinks as waves progress. */
  readonly aimErrorScale: number;
  readonly rng: Random;
  readonly dt: number;
  /** When true the controller refreshes perception and re-evaluates its state. */
  readonly think: boolean;
  readonly time: number;
  /** Route planning shared by every enemy. */
  readonly navigation: NavPlanner;
}

const sightPoint = new Vector3();
const playerCentre = new Vector3();
const muzzlePos = new Vector3();
const muzzleDir = new Vector3();
const leadPoint = new Vector3();
const aimDir = new Vector3();
const steering: SteeringOutput = { throttle: 0, turn: 0 };

/** Seconds between fire-control line-of-sight checks after a failed check. */
const FIRE_RECHECK = 0.4;
const ZIGZAG_PERIOD = 0.9;
/** Fraction of top speed used while patrolling. */
const PATROL_SPEED = 0.5;
/** Arrival distance when steering straight at a goal (metres). */
const ARRIVAL_DISTANCE = 8;
/** Chance a patrol goal across the river is kept; otherwise one on the tank's own bank is sought. */
const OTHER_BANK_PATROL_CHANCE = 0.25;
const PATROL_GOAL_ATTEMPTS = 4;
/** How far behind a reversing tank to look for a bridge deck it must not back onto (metres). */
const BACK_UP_CHECK = 10;

export class EnemyController {
  state: AIState = 'patrol';
  stateTime = 0;
  /** Accumulates while the player is visible; engagement starts at `reactionDelay`. */
  private spotTimer = 0;
  private reactionDelay: number;
  engaged = false;
  playerVisible = false;
  playerDistance = Infinity;
  timeSinceSeen = Infinity;
  lastKnownX = 0;
  lastKnownZ = 0;
  private goalX: number;
  private goalZ: number;
  private readonly homeX: number;
  private readonly homeZ: number;
  private alerted = false;
  private wasHit = false;
  private hasRetreated = false;
  private flankSide: number;
  private orbitDirection: number;
  private evadeSign = 1;
  private zigzagTimer = 0;
  private stuckTimer = 0;
  private unstickTimer = 0;
  private unstickTurn = 1;
  private aimErrorYaw = 0;
  private aimErrorPitch = 0;
  private fireCheckTimer = 0;
  private readonly scanPhase: number;
  /** Angular offset that spreads enemies around the player. */
  private readonly approachOffset: number;
  private readonly follower = new PathFollower();
  private readonly waypoint: Waypoint = createWaypoint();
  private readonly bankGoal: PlanarVector = { x: 0, z: 0 };
  private patrolGoalChecked = false;

  constructor(
    readonly tank: Tank,
    readonly kind: EnemyKind,
    private readonly rng: Random,
    difficulty: DifficultySpec,
    /** Half extent of the battlefield's playable square; patrol goals stay inside it. */
    private readonly playableHalfSize: number,
  ) {
    this.homeX = tank.x;
    this.homeZ = tank.z;
    this.goalX = tank.x;
    this.goalZ = tank.z;
    this.reactionDelay = rng.range(difficulty.reactionTime[0], difficulty.reactionTime[1]);
    this.flankSide = rng.chance(0.5) ? 1 : -1;
    this.orbitDirection = rng.chance(0.5) ? 1 : -1;
    this.scanPhase = rng.range(0, TAU);
    this.approachOffset = rng.range(-0.9, 0.9);
    this.pickPatrolWaypoint();
  }

  /** Called by the simulation when this tank takes damage. */
  notifyHit(fromX: number, fromZ: number): void {
    this.wasHit = true;
    this.alerted = true;
    // Being shot reveals roughly where the attacker is and speeds up reaction.
    this.lastKnownX = fromX;
    this.lastKnownZ = fromZ;
    this.spotTimer = Math.max(this.spotTimer, this.reactionDelay * 0.75);
    if (!this.engaged) {
      this.goalX = fromX;
      this.goalZ = fromZ;
    }
  }

  /** Called when the player fires within earshot. */
  notifyGunfire(x: number, z: number): void {
    if (this.engaged) return;
    this.alerted = true;
    this.lastKnownX = x + this.rng.signed() * 30;
    this.lastKnownZ = z + this.rng.signed() * 30;
  }

  update(ctx: AIContext): void {
    const tank = this.tank;
    const controls = tank.controls;
    controls.fire = false;
    if (!tank.alive) {
      this.state = 'destroyed';
      controls.throttle = 0;
      controls.turn = 0;
      return;
    }
    this.stateTime += ctx.dt;
    this.updatePerception(ctx);
    if (ctx.think || this.wasHit) this.think(ctx);
    this.drive(ctx);
    this.aim(ctx);
    this.fireControl(ctx);
  }

  private updatePerception(ctx: AIContext): void {
    const player = ctx.player;
    const tank = this.tank;
    if (ctx.think) {
      this.playerDistance = Math.hypot(player.x - tank.x, player.z - tank.z);
      let visible = false;
      if (player.alive && this.playerDistance <= ctx.difficulty.detectionRange) {
        tank.getSightPoint(sightPoint);
        player.getCentre(playerCentre);
        visible = ctx.world.hasLineOfSight(sightPoint.x, sightPoint.y, sightPoint.z, playerCentre.x, playerCentre.y + 0.6, playerCentre.z);
      }
      // Very close tanks are heard even without line of sight.
      if (!visible && player.alive && this.playerDistance < AI.hearingRange && !this.engaged) {
        this.alerted = true;
        this.lastKnownX = player.x;
        this.lastKnownZ = player.z;
      }
      this.playerVisible = visible;
    }

    if (this.playerVisible) {
      this.spotTimer += ctx.dt;
    } else {
      this.spotTimer = Math.max(0, this.spotTimer - ctx.dt * 0.5);
    }
    const wasEngaged = this.engaged;
    this.engaged = this.playerVisible && this.spotTimer >= this.reactionDelay;
    if (this.engaged) {
      this.timeSinceSeen = 0;
      this.lastKnownX = player.x;
      this.lastKnownZ = player.z;
    } else {
      this.timeSinceSeen += ctx.dt;
      if (wasEngaged) {
        // Re-acquiring a lost target takes a fresh (shorter) reaction.
        this.reactionDelay = ctx.rng.range(ctx.difficulty.reactionTime[0], ctx.difficulty.reactionTime[1]) * 0.6;
      }
    }
  }

  private think(ctx: AIContext): void {
    const tank = this.tank;
    const goalDistance = Math.hypot(this.goalX - tank.x, this.goalZ - tank.z);
    const next = decideNextState({
      state: this.state,
      stateTime: this.stateTime,
      kind: this.kind,
      engaged: this.engaged,
      timeSinceSeen: this.timeSinceSeen,
      playerDistance: this.playerDistance,
      playerAlive: ctx.player.alive,
      alerted: this.alerted,
      wasHit: this.wasHit,
      healthFraction: tank.healthFraction,
      hasRetreated: this.hasRetreated,
      arrived: goalDistance < AI.patrolArrivalDistance,
      roll: ctx.rng.next(),
    });
    this.alerted = false;
    this.wasHit = false;
    if (next !== this.state) this.enterState(next, ctx);
  }

  private enterState(next: AIState, ctx: AIContext): void {
    this.state = next;
    this.stateTime = 0;
    const player = ctx.player;
    switch (next) {
      case 'patrol':
        this.pickPatrolWaypoint();
        break;
      case 'investigate':
        this.goalX = this.lastKnownX;
        this.goalZ = this.lastKnownZ;
        break;
      case 'flank':
        this.flankSide = ctx.rng.chance(0.5) ? 1 : -1;
        this.updateFlankGoal(player);
        break;
      case 'evade':
        this.evadeSign = ctx.rng.chance(0.5) ? 1 : -1;
        this.zigzagTimer = ZIGZAG_PERIOD;
        break;
      case 'retreat':
        this.hasRetreated = true;
        break;
      case 'attack':
        if (ctx.rng.chance(0.3)) this.orbitDirection = -this.orbitDirection;
        break;
      default:
        break;
    }
  }

  private pickPatrolWaypoint(): void {
    const limit = this.playableHalfSize - 50;
    const angle = this.rng.range(0, TAU);
    const radius = this.rng.range(40, AI.patrolRadius);
    this.goalX = clamp(this.homeX + Math.cos(angle) * radius, -limit, limit);
    this.goalZ = clamp(this.homeZ + Math.sin(angle) * radius, -limit, limit);
    this.patrolGoalChecked = false;
  }

  /** Re-picks a patrol goal that lies in deep water or out of reach, preferring the tank's own bank. */
  private keepPatrolReachable(ctx: AIContext): void {
    if (this.patrolGoalChecked) return;
    this.patrolGoalChecked = true;
    const tank = this.tank;
    const nav = ctx.navigation.nav;
    const clearance = tank.spec.collisionRadius + 2;
    for (let attempt = 0; attempt < PATROL_GOAL_ATTEMPTS; attempt++) {
      const reachable = ctx.world.water.blockedDistance(this.goalX, this.goalZ) > clearance && nav.regionAt(this.goalX, this.goalZ) === nav.regionAt(tank.x, tank.z);
      const ownBank = nav.sideAt(this.goalX, this.goalZ) === nav.sideAt(tank.x, tank.z);
      if (reachable && (ownBank || this.rng.chance(OTHER_BANK_PATROL_CHANCE))) return;
      this.pickPatrolWaypoint();
      this.patrolGoalChecked = true;
    }
  }

  /**
   * Drives towards (gx, gz) at `speedFraction` of top speed, following a
   * planned route whenever water stands in the way. Returns the distance
   * left to the goal itself.
   */
  private travel(ctx: AIContext, gx: number, gz: number, speedFraction: number, arrival = ARRIVAL_DISTANCE): number {
    const tank = this.tank;
    const wp = this.waypoint;
    if (!this.follower.steer(tank, gx, gz, ctx.navigation, ctx.think, ctx.time, wp)) {
      return steerTowards(tank, gx, gz, speedFraction, ctx.world, ctx.tanks, steering, arrival);
    }
    if (wp.hold) {
      steering.throttle = 0;
      steering.turn = 0;
    } else {
      steerTowards(tank, wp.x, wp.z, speedFraction, ctx.world, ctx.tanks, steering, wp.arrival);
    }
    return Math.hypot(gx - tank.x, gz - tank.z);
  }

  /** A short-range goal kept on the tank's own bank: across a river it stops at the near shore instead. */
  private onOwnBank(ctx: AIContext, gx: number, gz: number): PlanarVector {
    const out = this.bankGoal;
    out.x = gx;
    out.z = gz;
    const tank = this.tank;
    if (tank.bridgeId >= 0) return out;
    const nav = ctx.navigation.nav;
    const side = nav.sideAt(tank.x, tank.z);
    if (side >= 0 && nav.sideAt(gx, gz) !== side) nav.projectToSide(gx, gz, tank.x, tank.z, side, out);
    return out;
  }

  private updateFlankGoal(player: Tank): void {
    const angle = player.heading + this.flankSide * 1.75;
    this.goalX = player.x + Math.sin(angle) * AI.flankDistance;
    this.goalZ = player.z - Math.cos(angle) * AI.flankDistance;
  }

  private drive(ctx: AIContext): void {
    const tank = this.tank;
    const player = ctx.player;
    const preferred = AI.preferredRange[this.kind];

    switch (this.state) {
      case 'idle':
      case 'destroyed':
        steering.throttle = 0;
        steering.turn = 0;
        break;
      case 'patrol': {
        if (ctx.think) this.keepPatrolReachable(ctx);
        const d = this.travel(ctx, this.goalX, this.goalZ, PATROL_SPEED);
        if (d < AI.patrolArrivalDistance) this.pickPatrolWaypoint();
        break;
      }
      case 'investigate':
        this.travel(ctx, this.goalX, this.goalZ, 0.8);
        break;
      case 'pursue': {
        // Approach from an individual angle so the pack spreads out.
        const bearing = headingOf(tank.x - this.lastKnownX, tank.z - this.lastKnownZ) + this.approachOffset;
        this.goalX = this.lastKnownX + Math.sin(bearing) * preferred * 0.9;
        this.goalZ = this.lastKnownZ - Math.cos(bearing) * preferred * 0.9;
        this.travel(ctx, this.goalX, this.goalZ, 1);
        break;
      }
      case 'attack':
        this.driveAttack(ctx, preferred);
        break;
      case 'flank': {
        if (ctx.think) this.updateFlankGoal(player);
        const goal = this.onOwnBank(ctx, this.goalX, this.goalZ);
        this.travel(ctx, goal.x, goal.z, 1);
        break;
      }
      case 'evade': {
        this.zigzagTimer -= ctx.dt;
        if (this.zigzagTimer <= 0) {
          this.evadeSign = -this.evadeSign;
          this.zigzagTimer = ZIGZAG_PERIOD;
        }
        const away = headingOf(tank.x - player.x, tank.z - player.z) + this.evadeSign * 1.3;
        const goal = this.onOwnBank(ctx, tank.x + Math.sin(away) * 40, tank.z - Math.cos(away) * 40);
        this.travel(ctx, goal.x, goal.z, 1);
        break;
      }
      case 'retreat': {
        const away = headingOf(tank.x - player.x, tank.z - player.z);
        const goal = this.onOwnBank(ctx, tank.x + Math.sin(away) * 60, tank.z - Math.cos(away) * 60);
        this.travel(ctx, goal.x, goal.z, 1);
        break;
      }
    }
    this.applyUnstick(ctx.dt);
  }

  private driveAttack(ctx: AIContext, preferred: number): void {
    const tank = this.tank;
    const player = ctx.player;
    const dist = Math.hypot(player.x - tank.x, player.z - tank.z);
    if (dist < preferred * 0.45) {
      // Never back onto a bridge, which would bypass its right of way; face the threat instead.
      const back = BACK_UP_CHECK;
      if (tank.bridgeId < 0 && ctx.world.trackBridge(-1, tank.x - Math.sin(tank.heading) * back, tank.z + Math.cos(tank.heading) * back) >= 0) {
        faceTowards(tank, player.x, player.z, steering);
      } else {
        reverseAwayFrom(tank, player.x, player.z, steering);
      }
      return;
    }
    if (this.kind === 'heavy') {
      // Heavies grind forward and keep their thick frontal armour towards the threat.
      if (dist > preferred * 1.1) {
        const goal = this.onOwnBank(ctx, player.x, player.z);
        this.travel(ctx, goal.x, goal.z, 0.65);
      } else {
        faceTowards(tank, player.x, player.z, steering);
      }
      return;
    }
    const orbitSpeed = this.kind === 'scout' ? 0.9 : 0.5;
    const bearing = headingOf(tank.x - player.x, tank.z - player.z) + this.orbitDirection * 0.35;
    const goal = this.onOwnBank(ctx, player.x + Math.sin(bearing) * preferred, player.z - Math.cos(bearing) * preferred);
    this.travel(ctx, goal.x, goal.z, orbitSpeed, 4);
  }

  /** Detects a stalled tank and backs it out with a turn. */
  private applyUnstick(dt: number): void {
    const controls = this.tank.controls;
    if (this.unstickTimer > 0) {
      this.unstickTimer -= dt;
      controls.throttle = -0.7;
      controls.turn = this.unstickTurn;
      return;
    }
    controls.throttle = steering.throttle;
    controls.turn = steering.turn;
    if (Math.abs(steering.throttle) > 0.3 && Math.abs(this.tank.speed) < AI.stuckSpeed) {
      this.stuckTimer += dt;
      if (this.stuckTimer > AI.stuckTime) {
        this.stuckTimer = 0;
        this.unstickTimer = AI.unstickTime;
        this.unstickTurn = this.rng.chance(0.5) ? 1 : -1;
        this.follower.invalidate();
      }
    } else {
      this.stuckTimer = 0;
    }
  }

  private aim(ctx: AIContext): void {
    const tank = this.tank;
    const player = ctx.player;
    const tracking = isCombatState(this.state) && (this.engaged || this.timeSinceSeen < 3);
    if (!tracking) {
      // Scan the horizon around the hull's heading.
      const scan = tank.heading + Math.sin(ctx.time * 0.45 + this.scanPhase) * 0.8;
      tank.aimDirection.set(Math.sin(scan), 0, -Math.cos(scan));
      return;
    }
    tank.getMuzzle(muzzlePos, muzzleDir);
    player.getCentre(playerCentre);
    if (!this.engaged) {
      playerCentre.set(this.lastKnownX, playerCentre.y, this.lastKnownZ);
    }
    const speed = tank.spec.weapon.muzzleSpeed;
    leadTarget(muzzlePos, playerCentre, this.engaged ? player.vx : 0, this.engaged ? player.vz : 0, speed, ctx.difficulty.leadFactor, leadPoint);
    ballisticDirection(muzzlePos, leadPoint, speed, WORLD.gravity, aimDir);
    // Apply this shot's aim error as small yaw/pitch offsets.
    const yaw = Math.atan2(aimDir.x, -aimDir.z) + this.aimErrorYaw;
    const pitch = Math.asin(clamp(aimDir.y, -1, 1)) + this.aimErrorPitch;
    const cp = Math.cos(pitch);
    tank.aimDirection.set(Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  }

  private resampleAimError(ctx: AIContext): void {
    let sigma = ctx.difficulty.aimError * ctx.aimErrorScale;
    if (this.kind === 'heavy' && this.playerDistance < 120) sigma *= 0.6;
    // Moving targets and moving shooters are both harder to hit.
    const shooterMoving = Math.min(1, Math.abs(this.tank.speed) / this.tank.spec.maxSpeed);
    sigma *= 1 + 0.5 * shooterMoving;
    this.aimErrorYaw = ctx.rng.gaussian() * sigma;
    this.aimErrorPitch = ctx.rng.gaussian() * sigma * 0.5;
  }

  private fireControl(ctx: AIContext): void {
    const tank = this.tank;
    if (this.fireCheckTimer > 0) this.fireCheckTimer -= ctx.dt;
    if (!this.engaged || tank.reload > 0 || this.fireCheckTimer > 0) return;
    if (this.playerDistance > tank.spec.weapon.maxRange) return;

    tank.getMuzzle(muzzlePos, muzzleDir);
    if (muzzleDir.dot(tank.aimDirection) < Math.cos(AI.fireAlignment)) return;

    const player = ctx.player;
    player.getCentre(playerCentre);
    const blocked =
      !ctx.world.hasLineOfSight(muzzlePos.x, muzzlePos.y, muzzlePos.z, playerCentre.x, playerCentre.y, playerCentre.z) ||
      this.friendlyInLine(ctx);
    if (blocked) {
      this.fireCheckTimer = FIRE_RECHECK;
      return;
    }
    tank.controls.fire = true;
    this.resampleAimError(ctx);
  }

  private friendlyInLine(ctx: AIContext): boolean {
    for (const other of ctx.tanks) {
      if (other === this.tank || other.faction !== this.tank.faction) continue;
      if (segmentVsTank(muzzlePos.x, muzzlePos.y, muzzlePos.z, playerCentre.x, playerCentre.y, playerCentre.z, other) !== Infinity) return true;
    }
    return false;
  }
}
