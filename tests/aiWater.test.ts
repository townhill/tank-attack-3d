import { describe, expect, it } from 'vitest';
import { EnemyController } from '../src/ai/EnemyAI';
import { NAV, SIM_DT, TANK_SPECS } from '../src/config/settings';
import { Tank } from '../src/entities/Tank';
import { createPlayerCommand, Simulation } from '../src/game/Simulation';
import { Random } from '../src/utils/random';
import { makeRiverWorld } from './waterFixtures';

/** A battle on the river world with no enemy waves; the player waits far off in the south-west corner. */
function riverBattle(bridgeZs: readonly number[] = [0]): Simulation {
  const sim = new Simulation({ seed: 3, difficulty: 'easy', world: makeRiverWorld(bridgeZs), firstWaveDelay: Number.POSITIVE_INFINITY });
  sim.player.placeAt(-230, -230, 0, sim.world);
  return sim;
}

function addEnemy(sim: Simulation, id: number, x: number, z: number, heading: number): EnemyController {
  const tank = new Tank(id, TANK_SPECS.standard, 'enemy');
  tank.placeAt(x, z, heading, sim.world);
  const controller = new EnemyController(tank, 'standard', new Random(id), sim.difficultySpec, sim.world.playableHalfSize);
  sim.tanks.push(tank);
  sim.enemies.push({ tank, kind: 'standard', controller });
  return controller;
}

interface Mission {
  readonly controller: EnemyController;
  readonly targetX: number;
  readonly targetZ: number;
  reachedTargetBank: boolean;
}

interface BattleLog {
  /** Most anyone ever was inside water too deep to wade while off a bridge (negative = clear). */
  worstIntrusion: number;
  /** Ticks on which enemies on one deck were driving opposite ways. */
  opposingTicks: number;
  bridgeTicks: number;
  enemyShots: number;
}

/** Runs the battle, repeating each mission's gunfire alert every five seconds. */
function runMissions(sim: Simulation, missions: Mission[], seconds: number): BattleLog {
  const log: BattleLog = { worstIntrusion: -Infinity, opposingTicks: 0, bridgeTicks: 0, enemyShots: 0 };
  const cmd = createPlayerCommand();
  const ticks = Math.round(seconds / SIM_DT);
  for (let i = 0; i < ticks; i++) {
    if (i % 300 === 0) for (const m of missions) m.controller.notifyGunfire(m.targetX, m.targetZ);
    sim.step(SIM_DT, cmd);
    for (const e of sim.events) if (e.type === 'fire' && e.faction === 'enemy') log.enemyShots++;
    sim.clearEvents();
    const directions = new Set<number>();
    for (const m of missions) {
      const t = m.controller.tank;
      if (Math.sign(t.x) === Math.sign(m.targetX) && Math.abs(t.x) > 30) m.reachedTargetBank = true;
      if (t.bridgeId >= 0) {
        log.bridgeTicks++;
        directions.add(Math.sign(Math.sin(t.heading)));
      } else {
        log.worstIntrusion = Math.max(log.worstIntrusion, t.spec.collisionRadius - sim.world.water.blockedDistance(t.x, t.z));
      }
    }
    if (directions.size > 1) log.opposingTicks++;
  }
  return log;
}

describe('Enemies and rivers', () => {
  it('an enemy on the far bank crosses by the bridge to investigate gunfire there', () => {
    const sim = riverBattle();
    const mission: Mission = { controller: addEnemy(sim, 1, 180, 200, Math.PI), targetX: -150, targetZ: 150, reachedTargetBank: false };
    const log = runMissions(sim, [mission], 60);
    expect(log.bridgeTicks).toBeGreaterThan(60);
    expect(mission.reachedTargetBank).toBe(true);
    expect(log.worstIntrusion).toBeLessThan(0.5);
  });

  it('six enemies crossing both ways share one bridge without deadlock or meeting head-on', () => {
    const sim = riverBattle();
    const missions: Mission[] = [];
    for (let k = 0; k < 3; k++) {
      missions.push({ controller: addEnemy(sim, 1 + k, 200, 120 + 50 * k, -Math.PI / 2), targetX: -170, targetZ: 170, reachedTargetBank: false });
      missions.push({ controller: addEnemy(sim, 4 + k, -200, 120 + 50 * k, Math.PI / 2), targetX: 170, targetZ: 170, reachedTargetBank: false });
    }
    const log = runMissions(sim, missions, 150);
    for (const m of missions) expect(m.reachedTargetBank).toBe(true);
    expect(log.opposingTicks).toBe(0);
    expect(log.worstIntrusion).toBeLessThan(0.5);
    expect(sim.navigation.stats.maxPlansInTick).toBeLessThanOrEqual(NAV.plansPerTick);
    expect(sim.navigation.stats.maxExpanded).toBeLessThanOrEqual(NAV.searchBudget);
  });

  it('an enemy engaged across the river holds its own bank and fires over the water', () => {
    const sim = riverBattle();
    sim.player.placeAt(-60, 60, Math.PI / 2, sim.world);
    const controller = addEnemy(sim, 1, 90, 60, -Math.PI / 2);
    const log = runMissions(sim, [], 25);
    expect(controller.tank.x).toBeGreaterThan(10);
    expect(log.bridgeTicks).toBe(0);
    expect(log.enemyShots).toBeGreaterThan(0);
  });

  it('plays out identically every time', () => {
    const positions = (): number[] => {
      const sim = riverBattle([-120, 100]);
      const missions: Mission[] = [];
      for (let k = 0; k < 3; k++) {
        missions.push({ controller: addEnemy(sim, 1 + k, 200, -50 + 60 * k, -Math.PI / 2), targetX: -170, targetZ: 30 * k, reachedTargetBank: false });
      }
      runMissions(sim, missions, 40);
      return sim.tanks.flatMap((t) => [t.x, t.z, t.heading]);
    };
    expect(positions()).toEqual(positions());
  });
});
