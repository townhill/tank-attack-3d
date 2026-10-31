/**
 * Deterministic fixed-timestep battlefield simulation. Owns every tank,
 * projectile and enemy controller, applies the game rules and records events
 * for the presentation layer. Contains no rendering code.
 */
import { EnemyController } from '../ai/EnemyAI';
import { NavPlanner } from '../ai/NavPlanner';
import { computeDamage, hitZone, applyDamage } from '../combat/DamageSystem';
import { createProjectileHit, fireWeapon, stepProjectile } from '../combat/WeaponSystem';
import type { Difficulty, DifficultySpec, EnemyKind, MapSize, TerrainType } from '../config/settings';
import { AI, DAMAGE, DIFFICULTY, PROJECTILE, TANK_SPECS } from '../config/settings';
import { ProjectilePool } from '../entities/Projectile';
import type { Projectile } from '../entities/Projectile';
import { Tank } from '../entities/Tank';
import { headingOf, TAU } from '../utils/math';
import { hashSeed, Random } from '../utils/random';
import type { PushResult } from '../world/Collision';
import { circleVsObstacle, createPushResult } from '../world/Collision';
import type { Obstacle } from '../world/Obstacle';
import type { World } from '../world/World';
import { generateWorld, worldOptionsFor } from '../world/WorldGenerator';
import type { GameEvent } from './events';
import type { GameStats } from './Scoring';
import { createStats, killScore, waveClearBonus } from './Scoring';
import { aimErrorScale, waveEnemyCount, WaveManager } from './WaveManager';

export interface PlayerCommand {
  throttle: number;
  turn: number;
  fire: boolean;
  /** Desired world-space gun direction; need not be normalised. */
  aimX: number;
  aimY: number;
  aimZ: number;
}

export function createPlayerCommand(): PlayerCommand {
  return { throttle: 0, turn: 0, fire: false, aimX: 0, aimY: 0, aimZ: -1 };
}

export interface EnemyEntry {
  readonly tank: Tank;
  readonly kind: EnemyKind;
  readonly controller: EnemyController;
}

export type SimPhase = 'playing' | 'dying' | 'over';

export interface SimulationOptions {
  readonly seed: number;
  readonly difficulty: Difficulty;
  /** Battlefield size to generate; defaults to standard. Ignored when `world` is given. */
  readonly mapSize?: MapSize;
  /** Whether a generated battlefield fords each river; defaults to no. Ignored when `world` is given. */
  readonly fords?: boolean;
  /** Shape of a generated battlefield's ground; defaults to gentle. Ignored when `world` is given. */
  readonly terrain?: TerrainType;
  /** Reuse a pre-generated world (e.g. on restart) instead of generating one. */
  readonly world?: World;
  readonly firstWaveDelay?: number;
}

/** AI perception/decision refresh period in ticks (staggered per tank). */
const AI_THINK_INTERVAL = 6;
/** Seconds a destroyed enemy remains as a blocking, smouldering wreck. */
const WRECK_LIFETIME = 10;
/** Seconds between the player's destruction and the game-over event. */
const DEATH_SEQUENCE_TIME = 2.8;
const SPAWN_ATTEMPTS = 40;
const SPAWN_DISTANCE_SPREAD = 220;
const SPAWN_MAX_SLOPE = 0.3;
const SPAWN_TANK_CLEARANCE = 30;
/** Enemies spawn at least this far from deep water, beyond their own radius (metres). */
const SPAWN_WATER_CLEARANCE = 8;

export class Simulation {
  readonly world: World;
  readonly difficulty: Difficulty;
  readonly difficultySpec: DifficultySpec;
  readonly rng: Random;
  readonly player: Tank;
  /** All tanks including the player and recent wrecks. */
  readonly tanks: Tank[] = [];
  readonly enemies: EnemyEntry[] = [];
  readonly projectiles = new ProjectilePool(PROJECTILE.poolSize);
  readonly waves: WaveManager;
  /** Route planning shared by every enemy. */
  readonly navigation: NavPlanner;
  readonly stats: GameStats = createStats();
  readonly events: GameEvent[] = [];
  time = 0;
  tick = 0;
  phase: SimPhase = 'playing';

  private nextTankId = 1;
  private deathTimer = 0;
  private readonly hit = createProjectileHit();
  private readonly push = createPushResult();
  private readonly nearby: Obstacle[] = [];

  constructor(options: SimulationOptions) {
    this.world = options.world ?? generateWorld(options.seed, worldOptionsFor(options.mapSize ?? 'standard', options.fords ?? false, options.terrain ?? 'gentle'));
    this.difficulty = options.difficulty;
    this.difficultySpec = DIFFICULTY[options.difficulty];
    this.rng = new Random(options.seed ^ hashSeed(options.difficulty));
    this.waves = new WaveManager(this.difficultySpec, this.rng, options.firstWaveDelay ?? 3);
    this.navigation = new NavPlanner(this.world);
    this.player = new Tank(0, TANK_SPECS.player, 'player');
    this.player.placeAt(0, 0, 0, this.world);
    this.tanks.push(this.player);
  }

  clearEvents(): void {
    this.events.length = 0;
  }

  aliveEnemyCount(): number {
    let n = 0;
    for (const e of this.enemies) if (e.tank.alive) n++;
    return n;
  }

  findTank(id: number): Tank | undefined {
    return this.tanks.find((t) => t.id === id);
  }

  findEnemy(id: number): EnemyEntry | undefined {
    return this.enemies.find((e) => e.tank.id === id);
  }

  step(dt: number, command: PlayerCommand): void {
    if (this.phase === 'over') return;
    this.time += dt;
    this.tick++;
    for (const t of this.tanks) t.saveSnapshot();

    this.applyPlayerCommand(command);
    this.updateAI(dt);
    const enemySpeed = this.difficultySpec.enemySpeedMultiplier;
    for (const t of this.tanks) t.integrateMotion(dt, this.world, (t.faction === 'enemy' ? enemySpeed : 1) * this.wadingFactor(t));
    this.resolveCollisions();
    for (const t of this.tanks) {
      t.settleOnGround(this.world, dt);
      t.updateTurret(dt);
      t.updateTimers(dt);
    }
    this.handleFiring();
    this.updateProjectiles(dt);
    this.updateWaves(dt);
    this.removeExpiredWrecks();

    if (this.player.alive) this.stats.survivalTime += dt;
    if (this.phase === 'dying') {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.phase = 'over';
        this.events.push({ type: 'gameOver' });
      }
    }
  }

  private applyPlayerCommand(cmd: PlayerCommand): void {
    const p = this.player;
    if (!p.alive) {
      p.controls.throttle = 0;
      p.controls.turn = 0;
      p.controls.fire = false;
      return;
    }
    p.controls.throttle = cmd.throttle;
    p.controls.turn = cmd.turn;
    p.controls.fire = cmd.fire;
    const len = Math.hypot(cmd.aimX, cmd.aimY, cmd.aimZ);
    if (len > 1e-6) p.aimDirection.set(cmd.aimX / len, cmd.aimY / len, cmd.aimZ / len);
  }

  private updateAI(dt: number): void {
    const scale = aimErrorScale(Math.max(1, this.waves.wave));
    this.navigation.beginTick(this.tanks);
    for (const entry of this.enemies) {
      entry.controller.update({
        world: this.world,
        player: this.player,
        tanks: this.tanks,
        difficulty: this.difficultySpec,
        aimErrorScale: scale,
        rng: this.rng,
        dt,
        think: (this.tick + entry.tank.id) % AI_THINK_INTERVAL === 0,
        time: this.time,
        navigation: this.navigation,
      });
    }
  }

  private resolveCollisions(): void {
    const world = this.world;
    const push = this.push;
    for (const t of this.tanks) {
      const r = t.spec.collisionRadius;
      world.obstaclesNear(t.x, t.z, r + 2, this.nearby);
      for (const ob of this.nearby) {
        if (!circleVsObstacle(t.x, t.z, r, ob, push)) continue;
        t.x += push.nx * push.depth;
        t.z += push.nz * push.depth;
        this.dampVelocityInto(t, push.nx, push.nz);
      }
      this.clampToPlayable(t);
    }

    // Tank-versus-tank: heavier tanks shove lighter ones.
    for (let i = 0; i < this.tanks.length; i++) {
      const a = this.tanks[i]!;
      for (let j = i + 1; j < this.tanks.length; j++) {
        const b = this.tanks[j]!;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const minDist = a.spec.collisionRadius + b.spec.collisionRadius;
        const distSq = dx * dx + dz * dz;
        if (distSq >= minDist * minDist) continue;
        const dist = Math.sqrt(distSq) || 1e-3;
        const nx = distSq > 1e-9 ? dx / dist : 1;
        const nz = distSq > 1e-9 ? dz / dist : 0;
        const overlap = minDist - dist;
        const massA = a.alive ? a.spec.mass : a.spec.mass * 4;
        const massB = b.alive ? b.spec.mass : b.spec.mass * 4;
        const shareA = massB / (massA + massB);
        const shareB = massA / (massA + massB);
        a.x -= nx * overlap * shareA;
        a.z -= nz * overlap * shareA;
        b.x += nx * overlap * shareB;
        b.z += nz * overlap * shareB;
        this.dampVelocityInto(a, -nx, -nz);
        this.dampVelocityInto(b, nx, nz);
      }
    }

    // Water last, so no shove can leave a tank in a river or over a bridge's edge.
    for (const t of this.tanks) this.keepOutOfWater(t);
  }

  private clampToPlayable(t: Tank): void {
    const limit = this.world.playableHalfSize - t.spec.collisionRadius;
    if (Math.abs(t.x) > limit) {
      this.dampVelocityInto(t, -Math.sign(t.x), 0);
      t.x = Math.sign(t.x) * limit;
    }
    if (Math.abs(t.z) > limit) {
      this.dampVelocityInto(t, 0, -Math.sign(t.z));
      t.z = Math.sign(t.z) * limit;
    }
  }

  /**
   * Holds a tank between the kerbs of a bridge it is crossing; otherwise keeps
   * it out of water too deep to wade and outside every bridge's parapets.
   */
  private keepOutOfWater(t: Tank): void {
    const world = this.world;
    const push = this.push;
    const r = t.spec.collisionRadius;
    t.bridgeId = world.trackBridge(t.bridgeId, t.x, t.z);
    if (t.bridgeId >= 0) {
      if (world.kerbPush(t.bridgeId, t.x, t.z, r, push)) this.shove(t, push);
      return;
    }
    if (world.water.pushOut(t.x, t.z, r, push)) this.shove(t, push);
    if (world.parapetPush(t.x, t.z, r, push)) this.shove(t, push);
  }

  /** Moves a tank out along a push and stops it driving back into whatever pushed it. */
  private shove(t: Tank, push: PushResult): void {
    t.x += push.nx * push.depth;
    t.z += push.nz * push.depth;
    this.dampVelocityInto(t, push.nx, push.nz);
    this.clampToPlayable(t);
  }

  /** Top-speed multiplier from wading; a tank on a bridge is clear of the water below. */
  private wadingFactor(t: Tank): number {
    return t.bridgeId >= 0 ? 1 : this.world.water.wadingFactor(t.x, t.z);
  }

  /** Removes the part of a tank's motion heading into a surface with normal (nx, nz). */
  private dampVelocityInto(t: Tank, nx: number, nz: number): void {
    const fx = Math.sin(t.heading);
    const fz = -Math.cos(t.heading);
    const into = (fx * nx + fz * nz) * t.speed;
    if (into < 0) t.speed *= 1 - Math.min(1, Math.abs(fx * nx + fz * nz)) * 0.85;
  }

  private handleFiring(): void {
    const diff = this.difficultySpec;
    for (const t of this.tanks) {
      if (!t.alive || !t.controls.fire) continue;
      const isPlayer = t === this.player;
      const reloadMultiplier = isPlayer ? 1 : diff.enemyReloadMultiplier;
      const damage = t.spec.weapon.damage * (isPlayer ? 1 : diff.damageToPlayerMultiplier);
      const shell = fireWeapon(t, this.projectiles, reloadMultiplier, damage);
      if (!shell) continue;
      this.emitFire(t, shell);
      if (isPlayer) {
        this.stats.shotsFired++;
        for (const e of this.enemies) {
          if (!e.tank.alive) continue;
          if (Math.hypot(e.tank.x - t.x, e.tank.z - t.z) < AI.gunfireAlertRange) e.controller.notifyGunfire(t.x, t.z);
        }
      }
    }
  }

  private emitFire(t: Tank, shell: Projectile): void {
    const speed = Math.hypot(shell.vx, shell.vy, shell.vz) || 1;
    this.events.push({
      type: 'fire',
      tankId: t.id,
      kind: t.spec.kind,
      faction: t.faction,
      x: shell.x,
      y: shell.y,
      z: shell.z,
      dx: shell.vx / speed,
      dy: shell.vy / speed,
      dz: shell.vz / speed,
    });
  }

  private updateProjectiles(dt: number): void {
    const hit = this.hit;
    for (const p of this.projectiles.items) {
      if (!p.active) continue;
      if (!stepProjectile(p, dt, this.world, this.tanks, hit)) continue;
      this.projectiles.release(p);
      if (hit.surface === 'expired') continue;
      this.events.push({ type: 'impact', surface: hit.surface, faction: p.faction, x: hit.x, y: hit.y, z: hit.z });
      if (hit.tank) this.onTankHit(p, hit.tank);
    }
  }

  private onTankHit(p: Projectile, target: Tank): void {
    if (!target.alive) return;
    const friendly = p.faction === target.faction;
    const multiplier = friendly ? DAMAGE.friendlyFireMultiplier : 1;
    const zone = hitZone(target.heading, p.vx, p.vz);
    const damage = computeDamage({ baseDamage: p.damage, armor: target.spec.armor, zone, multiplier });
    if (damage <= 0) return;
    const attacker = this.findTank(p.ownerId);
    if (p.faction === 'player') this.stats.hits++;
    target.damageFlash = 1;
    const killed = applyDamage(target, damage);
    this.events.push({
      type: 'tankHit',
      tankId: target.id,
      attackerId: p.ownerId,
      kind: target.spec.kind,
      faction: target.faction,
      damage,
      zone,
      x: p.x,
      y: p.y,
      z: p.z,
    });

    // Fall back to back-tracking the shell when the shooter has already been removed.
    const sourceX = attacker ? attacker.x : p.x - p.vx;
    const sourceZ = attacker ? attacker.z : p.z - p.vz;
    if (target === this.player) {
      this.stats.damageTaken += damage;
      this.events.push({ type: 'playerDamaged', amount: damage, sourceX, sourceZ, healthFraction: target.healthFraction });
    } else {
      this.findEnemy(target.id)?.controller.notifyHit(sourceX, sourceZ);
    }
    if (killed) this.onDestroyed(target, p.faction === 'player');
  }

  private onDestroyed(target: Tank, byPlayer: boolean): void {
    target.destroyedAt = this.time;
    target.controls.throttle = 0;
    target.controls.turn = 0;
    target.controls.fire = false;
    let score = 0;
    if (target === this.player) {
      this.phase = 'dying';
      this.deathTimer = DEATH_SEQUENCE_TIME;
    } else if (target.spec.kind !== 'player') {
      const kind = target.spec.kind;
      if (byPlayer) {
        score = killScore(kind, Math.max(1, this.waves.wave), this.difficulty);
        this.stats.score += score;
        this.stats.kills++;
        this.stats.killsByKind[kind]++;
      }
    }
    this.events.push({
      type: 'tankDestroyed',
      tankId: target.id,
      kind: target.spec.kind,
      faction: target.faction,
      byPlayer,
      score,
      x: target.x,
      y: target.y,
      z: target.z,
    });
  }

  private updateWaves(dt: number): void {
    if (this.phase !== 'playing') return;
    const update = this.waves.update(dt, this.aliveEnemyCount());
    if (update.startedWave !== null) {
      this.stats.wave = update.startedWave;
      this.events.push({ type: 'waveStart', wave: update.startedWave, enemies: waveEnemyCount(update.startedWave) });
    }
    if (update.spawn !== null && !this.spawnEnemy(update.spawn)) this.waves.requeue(update.spawn);
    if (update.clearedWave !== null) {
      const bonus = waveClearBonus(update.clearedWave, this.difficulty);
      this.stats.score += bonus;
      this.stats.wavesCleared++;
      const p = this.player;
      const repair = Math.min(p.spec.maxHealth - p.health, this.difficultySpec.waveRepair);
      p.health += repair;
      this.events.push({ type: 'waveComplete', wave: update.clearedWave, bonus, repair });
    }
  }

  /** Spawns an enemy at a valid point away from the player. Returns false when none was found. */
  spawnEnemy(kind: EnemyKind): boolean {
    const spec = TANK_SPECS[kind];
    const world = this.world;
    const minDist = this.difficultySpec.minSpawnDistance;
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
      const angle = this.rng.range(0, TAU);
      // Later attempts widen the search so cornered players still get opponents.
      const dist = minDist * (attempt < SPAWN_ATTEMPTS / 2 ? 1 : 0.7) + this.rng.range(0, SPAWN_DISTANCE_SPREAD);
      const x = this.player.x + Math.sin(angle) * dist;
      const z = this.player.z - Math.cos(angle) * dist;
      if (!world.isInsidePlayable(x, z, 30)) continue;
      if (world.terrain.slopeAt(x, z, 3) > SPAWN_MAX_SLOPE) continue;
      if (!this.isReachableDryGround(x, z, spec.collisionRadius)) continue;
      if (this.isBlocked(x, z, spec.collisionRadius + 5)) continue;
      const tank = new Tank(this.nextTankId++, spec, 'enemy');
      const towardsPlayer = headingOf(this.player.x - x, this.player.z - z);
      tank.placeAt(x, z, towardsPlayer + this.rng.range(-1.2, 1.2), world);
      const controller = new EnemyController(tank, kind, this.rng, this.difficultySpec, world.playableHalfSize);
      this.tanks.push(tank);
      this.enemies.push({ tank, kind, controller });
      this.events.push({ type: 'enemySpawned', tankId: tank.id, kind, x, z });
      return true;
    }
    return false;
  }

  /** Dry ground clear of deep water, on the same bank network as the player. */
  private isReachableDryGround(x: number, z: number, radius: number): boolean {
    const world = this.world;
    if (world.water.depthAt(x, z) > 0 || world.water.blockedDistance(x, z) < radius + SPAWN_WATER_CLEARANCE) return false;
    return world.nav.regionAt(x, z) === world.nav.regionAt(this.player.x, this.player.z);
  }

  private isBlocked(x: number, z: number, radius: number): boolean {
    this.world.obstaclesNear(x, z, radius + 2, this.nearby);
    for (const ob of this.nearby) if (circleVsObstacle(x, z, radius, ob, this.push)) return true;
    for (const t of this.tanks) if (Math.hypot(t.x - x, t.z - z) < SPAWN_TANK_CLEARANCE) return true;
    return false;
  }

  private removeExpiredWrecks(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const tank = this.enemies[i]!.tank;
      if (tank.alive || this.time - tank.destroyedAt < WRECK_LIFETIME) continue;
      this.enemies.splice(i, 1);
      const idx = this.tanks.indexOf(tank);
      if (idx >= 0) this.tanks.splice(idx, 1);
    }
  }
}
