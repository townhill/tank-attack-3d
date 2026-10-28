import { describe, expect, it } from 'vitest';
import { AI, DIFFICULTY, TANK_SPECS } from '../src/config/settings';
import type { DifficultySpec, EnemyKind } from '../src/config/settings';
import type { AIContext } from '../src/ai/EnemyAI';
import { EnemyController } from '../src/ai/EnemyAI';
import type { SteeringOutput } from '../src/ai/Navigation';
import { faceTowards, reverseAwayFrom, steerTowards } from '../src/ai/Navigation';
import type { AIState, TransitionInput } from '../src/ai/StateMachine';
import { decideNextState, isCombatState } from '../src/ai/StateMachine';
import { Tank } from '../src/entities/Tank';
import { Random } from '../src/utils/random';
import type { Obstacle } from '../src/world/Obstacle';
import { Terrain } from '../src/world/Terrain';
import { World } from '../src/world/World';

const DT = 1 / 60;

/* ------------------------------------------------------------------------------------------ *
 * Shared builders
 * ------------------------------------------------------------------------------------------ */

function makeObstacle(kind: Obstacle['kind'], x: number, z: number, shape: Obstacle['shape'], height = 20): Obstacle {
  return {
    id: 0,
    kind,
    x,
    z,
    yaw: 0,
    shape,
    baseY: 0,
    height,
    boundRadius: shape.type === 'circle' ? shape.radius : Math.hypot(shape.halfX, shape.halfZ),
    seed: 0,
  };
}

const rock = (x: number, z: number, radius: number): Obstacle => makeObstacle('rock', x, z, { type: 'circle', radius }, 6);
const wall = (x: number, z: number): Obstacle => makeObstacle('wall', x, z, { type: 'box', halfX: 20, halfZ: 2 });

/** Flat world with the given obstacles (ids are assigned here so the grid can dedupe them). */
function makeFlatWorld(obstacles: Obstacle[] = []): World {
  const numbered = obstacles.map((o, id) => ({ ...o, id }));
  return new World(1, new Terrain(300, 5), numbered, 250);
}

function placeTank(world: World, kind: 'player' | EnemyKind, id: number, x: number, z: number, heading: number): Tank {
  const tank = new Tank(id, TANK_SPECS[kind], kind === 'player' ? 'player' : 'enemy');
  tank.placeAt(x, z, heading, world.terrain);
  return tank;
}

/* ------------------------------------------------------------------------------------------ *
 * decideNextState
 * ------------------------------------------------------------------------------------------ */

const BASE_INPUT: TransitionInput = {
  state: 'patrol',
  stateTime: 0,
  kind: 'standard',
  engaged: false,
  timeSinceSeen: 100,
  playerDistance: 500,
  playerAlive: true,
  alerted: false,
  wasHit: false,
  healthFraction: 1,
  hasRetreated: false,
  arrived: false,
  roll: 0.9,
};

const decide = (overrides: Partial<TransitionInput>): AIState => decideNextState({ ...BASE_INPUT, ...overrides });

// preferredRange * 1.6 is the distance beyond which an engaged enemy pursues instead of attacking.
const standardPursueDistance = AI.preferredRange.standard * 1.6;
const heavyPursueDistance = AI.preferredRange.heavy * 1.6;

describe('decideNextState: global rules', () => {
  it('a destroyed enemy stays destroyed', () => {
    expect(decide({ state: 'destroyed', engaged: true })).toBe('destroyed');
  });

  it.each<AIState>(['idle', 'patrol', 'investigate', 'pursue', 'attack', 'flank', 'evade', 'retreat'])(
    'an enemy at zero health is destroyed from %s',
    (state) => {
      expect(decide({ state, healthFraction: 0 })).toBe('destroyed');
      expect(decide({ state, healthFraction: -0.3 })).toBe('destroyed');
    },
  );

  it.each<AIState>(['investigate', 'pursue', 'attack', 'flank', 'evade', 'retreat', 'patrol'])(
    'goes back to patrol from %s when the player is dead',
    (state) => {
      expect(decide({ state, playerAlive: false, engaged: true, stateTime: 99 })).toBe('patrol');
    },
  );

  it('an idle enemy stays idle when the player is dead', () => {
    expect(decide({ state: 'idle', playerAlive: false, stateTime: 99 })).toBe('idle');
  });
});

describe('decideNextState: idle and patrol', () => {
  it('idle: engaged standard far away pursues, near attacks', () => {
    expect(decide({ state: 'idle', engaged: true, playerDistance: standardPursueDistance + 1 })).toBe('pursue');
    expect(decide({ state: 'idle', engaged: true, playerDistance: standardPursueDistance })).toBe('attack');
    expect(decide({ state: 'idle', engaged: true, playerDistance: 100 })).toBe('attack');
  });

  it('idle: heavies switch to pursue at their own shorter threshold', () => {
    expect(decide({ state: 'idle', kind: 'heavy', engaged: true, playerDistance: heavyPursueDistance + 1 })).toBe('pursue');
    expect(decide({ state: 'idle', kind: 'heavy', engaged: true, playerDistance: heavyPursueDistance - 1 })).toBe('attack');
  });

  it('idle: an engaged scout always flanks, near or far', () => {
    expect(decide({ state: 'idle', kind: 'scout', engaged: true, playerDistance: 20 })).toBe('flank');
    expect(decide({ state: 'idle', kind: 'scout', engaged: true, playerDistance: 600 })).toBe('flank');
  });

  it('idle: an alert investigates, engagement takes priority over an alert', () => {
    expect(decide({ state: 'idle', alerted: true })).toBe('investigate');
    expect(decide({ state: 'idle', alerted: true, engaged: true, playerDistance: 100 })).toBe('attack');
  });

  it('idle: begins patrolling after two seconds of nothing', () => {
    expect(decide({ state: 'idle', stateTime: 2 })).toBe('idle');
    expect(decide({ state: 'idle', stateTime: 2.1 })).toBe('patrol');
  });

  it('patrol: engaged enemies attack or pursue, scouts flank', () => {
    expect(decide({ state: 'patrol', engaged: true, playerDistance: 100 })).toBe('attack');
    expect(decide({ state: 'patrol', engaged: true, playerDistance: 400 })).toBe('pursue');
    expect(decide({ state: 'patrol', kind: 'scout', engaged: true, playerDistance: 400 })).toBe('flank');
  });

  it('patrol: an alerted patrol investigates', () => {
    expect(decide({ state: 'patrol', alerted: true })).toBe('investigate');
  });

  it('patrol: otherwise keeps patrolling', () => {
    expect(decide({ state: 'patrol', stateTime: 500 })).toBe('patrol');
  });
});

describe('decideNextState: investigate', () => {
  it('spotting the player ends the investigation', () => {
    expect(decide({ state: 'investigate', engaged: true, playerDistance: 100 })).toBe('attack');
    expect(decide({ state: 'investigate', engaged: true, playerDistance: 400 })).toBe('pursue');
  });

  it('returns to patrol on arrival', () => {
    expect(decide({ state: 'investigate', arrived: true })).toBe('patrol');
  });

  it('times out after the investigate time', () => {
    expect(decide({ state: 'investigate', stateTime: AI.investigateTime })).toBe('investigate');
    expect(decide({ state: 'investigate', stateTime: AI.investigateTime + 0.1 })).toBe('patrol');
  });

  it('keeps investigating otherwise', () => {
    expect(decide({ state: 'investigate', stateTime: 3 })).toBe('investigate');
  });
});

describe('decideNextState: pursue', () => {
  it('closes to attack range, then attacks (scouts flank)', () => {
    const inRange = AI.preferredRange.standard * 1.3;
    expect(decide({ state: 'pursue', engaged: true, playerDistance: inRange })).toBe('attack');
    expect(decide({ state: 'pursue', engaged: true, playerDistance: inRange + 1 })).toBe('pursue');
    const scoutRange = AI.preferredRange.scout * 1.3;
    expect(decide({ state: 'pursue', kind: 'scout', engaged: true, playerDistance: scoutRange })).toBe('flank');
  });

  it('keeps pursuing while the target is far away', () => {
    expect(decide({ state: 'pursue', engaged: true, playerDistance: 400 })).toBe('pursue');
  });

  it('gives up and investigates after losing the target for too long', () => {
    expect(decide({ state: 'pursue', timeSinceSeen: AI.loseTargetTime + 0.1 })).toBe('investigate');
    expect(decide({ state: 'pursue', timeSinceSeen: AI.loseTargetTime - 1 })).toBe('pursue');
  });

  it('retreats when badly hurt', () => {
    expect(decide({ state: 'pursue', engaged: true, playerDistance: 400, healthFraction: 0.2 })).toBe('retreat');
  });
});

describe('decideNextState: attack', () => {
  it('stays in attack while engaged at a reasonable range', () => {
    expect(decide({ state: 'attack', engaged: true, playerDistance: 120 })).toBe('attack');
  });

  it('standard and scout tanks retreat at their health thresholds', () => {
    const standard = AI.retreatHealthFraction.standard;
    expect(decide({ state: 'attack', engaged: true, playerDistance: 120, healthFraction: standard })).toBe('retreat');
    expect(decide({ state: 'attack', engaged: true, playerDistance: 120, healthFraction: standard + 0.05 })).toBe('attack');
    const scout = AI.retreatHealthFraction.scout;
    expect(decide({ state: 'attack', kind: 'scout', engaged: true, playerDistance: 60, healthFraction: scout })).toBe('retreat');
    // 0.4 is above the standard threshold (0.3) but below the scout one (0.45).
    expect(decide({ state: 'attack', engaged: true, playerDistance: 120, healthFraction: 0.4 })).toBe('attack');
    expect(decide({ state: 'attack', kind: 'scout', engaged: true, playerDistance: 60, healthFraction: 0.4 })).toBe('retreat');
  });

  it('retreats only once: hasRetreated suppresses a second retreat', () => {
    expect(decide({ state: 'attack', engaged: true, playerDistance: 120, healthFraction: 0.1, hasRetreated: true })).toBe('attack');
  });

  it('heavy tanks never retreat, however damaged', () => {
    expect(decide({ state: 'attack', kind: 'heavy', engaged: true, playerDistance: 100, healthFraction: 0.01 })).toBe('attack');
    expect(decide({ state: 'pursue', kind: 'heavy', engaged: true, playerDistance: 300, healthFraction: 0.01 })).toBe('pursue');
  });

  it('a hit scout always evades', () => {
    expect(decide({ state: 'attack', kind: 'scout', engaged: true, playerDistance: 60, wasHit: true, roll: 0.99 })).toBe('evade');
  });

  it('a hit standard tank evades only when the roll is below 0.4', () => {
    const hit = { state: 'attack', engaged: true, playerDistance: 120, wasHit: true } as const;
    expect(decide({ ...hit, roll: 0 })).toBe('evade');
    expect(decide({ ...hit, roll: 0.39 })).toBe('evade');
    expect(decide({ ...hit, roll: 0.4 })).toBe('attack');
    expect(decide({ ...hit, roll: 0.95 })).toBe('attack');
  });

  it('a hit heavy tank holds its ground', () => {
    expect(decide({ state: 'attack', kind: 'heavy', engaged: true, playerDistance: 100, wasHit: true, roll: 0 })).toBe('attack');
  });

  it('an unhit tank ignores the roll', () => {
    expect(decide({ state: 'attack', engaged: true, playerDistance: 120, roll: 0 })).toBe('attack');
  });

  it('low health outranks evasion', () => {
    expect(decide({ state: 'attack', engaged: true, playerDistance: 120, wasHit: true, healthFraction: 0.1, roll: 0 })).toBe('retreat');
  });

  it('pursues when the player slips out of sight for more than 1.5 seconds', () => {
    expect(decide({ state: 'attack', timeSinceSeen: 1.6, playerDistance: 120 })).toBe('pursue');
    expect(decide({ state: 'attack', timeSinceSeen: 1.5, playerDistance: 120 })).toBe('attack');
    expect(decide({ state: 'attack', timeSinceSeen: 0.8, playerDistance: 120 })).toBe('attack');
  });

  it('pursues when the player drifts beyond twice the preferred range', () => {
    const limit = AI.preferredRange.standard * 2;
    expect(decide({ state: 'attack', engaged: true, playerDistance: limit + 1 })).toBe('pursue');
    expect(decide({ state: 'attack', engaged: true, playerDistance: limit - 1 })).toBe('attack');
  });

  it('scouts reposition by flanking after seven seconds of attacking', () => {
    expect(decide({ state: 'attack', kind: 'scout', engaged: true, playerDistance: 60, stateTime: 7 })).toBe('attack');
    expect(decide({ state: 'attack', kind: 'scout', engaged: true, playerDistance: 60, stateTime: 7.1 })).toBe('flank');
    expect(decide({ state: 'attack', engaged: true, playerDistance: 120, stateTime: 70 })).toBe('attack');
  });
});

describe('decideNextState: flank, evade and retreat', () => {
  it('flank: keeps flanking until it arrives or times out, then attacks', () => {
    const flank = { state: 'flank', kind: 'scout', engaged: true, playerDistance: 90 } as const;
    expect(decide({ ...flank, stateTime: 3 })).toBe('flank');
    expect(decide({ ...flank, arrived: true })).toBe('attack');
    expect(decide({ ...flank, stateTime: 9.1 })).toBe('attack');
  });

  it('flank: evades when hit and retreats when hurt', () => {
    const flank = { state: 'flank', kind: 'scout', engaged: true, playerDistance: 90 } as const;
    expect(decide({ ...flank, wasHit: true })).toBe('evade');
    expect(decide({ ...flank, healthFraction: 0.2 })).toBe('retreat');
    expect(decide({ ...flank, wasHit: true, healthFraction: 0.2 })).toBe('retreat');
  });

  it('flank: loses interest when the player has not been seen for a while', () => {
    expect(decide({ state: 'flank', kind: 'scout', timeSinceSeen: AI.loseTargetTime + 1 })).toBe('investigate');
    expect(decide({ state: 'flank', kind: 'scout', timeSinceSeen: 2 })).toBe('flank');
  });

  it('evade: lasts for evadeTime, then returns to attack if the player is engaged, else pursues', () => {
    expect(decide({ state: 'evade', stateTime: AI.evadeTime - 0.1, engaged: true })).toBe('evade');
    expect(decide({ state: 'evade', stateTime: AI.evadeTime, engaged: true })).toBe('attack');
    expect(decide({ state: 'evade', stateTime: AI.evadeTime, engaged: false })).toBe('pursue');
  });

  it('retreat: lasts for retreatTime, then returns to attack if the player is engaged, else pursues', () => {
    expect(decide({ state: 'retreat', stateTime: AI.retreatTime - 0.1, engaged: true })).toBe('retreat');
    expect(decide({ state: 'retreat', stateTime: AI.retreatTime, engaged: true })).toBe('attack');
    expect(decide({ state: 'retreat', stateTime: AI.retreatTime, engaged: false })).toBe('pursue');
  });

  it('a damaged standard tank retreats exactly once over a whole engagement', () => {
    let state: AIState = 'patrol';
    let hasRetreated = false;
    let stateTime = 0;
    const visited: AIState[] = [state];
    for (let step = 0; step < 4000; step++) {
      const next = decide({
        state,
        stateTime,
        engaged: true,
        playerDistance: 120,
        healthFraction: 0.2,
        hasRetreated,
      });
      stateTime += 0.1;
      if (next !== state) {
        if (next === 'retreat') hasRetreated = true;
        state = next;
        stateTime = 0;
        visited.push(state);
      }
    }
    expect(visited).toEqual(['patrol', 'attack', 'retreat', 'attack']);
  });
});

describe('isCombatState', () => {
  it.each<[AIState, boolean]>([
    ['idle', false],
    ['patrol', false],
    ['investigate', false],
    ['destroyed', false],
    ['pursue', true],
    ['attack', true],
    ['flank', true],
    ['evade', true],
    ['retreat', true],
  ])('%s -> %s', (state, expected) => {
    expect(isCombatState(state)).toBe(expected);
  });
});

/* ------------------------------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------------------------------ */

describe('steerTowards', () => {
  const makeOut = (): SteeringOutput => ({ throttle: 0, turn: 0 });

  function steer(
    goalX: number,
    goalZ: number,
    options: { obstacles?: Obstacle[]; speedFraction?: number; at?: [number, number]; heading?: number; others?: (world: World) => Tank[] } = {},
  ): { out: SteeringOutput; distance: number } {
    const world = makeFlatWorld(options.obstacles ?? []);
    const [x, z] = options.at ?? [0, 0];
    const tank = placeTank(world, 'standard', 1, x, z, options.heading ?? 0);
    const others = options.others?.(world) ?? [];
    const out = makeOut();
    const distance = steerTowards(tank, goalX, goalZ, options.speedFraction ?? 1, world, [tank, ...others], out);
    return { out, distance };
  }

  it('drives straight at a goal dead ahead and returns the remaining distance', () => {
    const { out, distance } = steer(0, -100);
    expect(distance).toBeCloseTo(100, 9);
    expect(out.turn).toBeCloseTo(0, 9);
    expect(out.throttle).toBeCloseTo(1, 9);
  });

  it('turns right (positive) for a goal to the right, and left (negative) for one to the left', () => {
    expect(steer(100, 0).out.turn).toBe(1);
    expect(steer(-100, 0).out.turn).toBe(-1);
    expect(steer(30, -100).out.turn).toBeGreaterThan(0);
    expect(steer(-30, -100).out.turn).toBeLessThan(0);
  });

  it('turns proportionally for a small heading error', () => {
    const error = Math.atan2(30, 100);
    expect(steer(30, -100).out.turn).toBeCloseTo(error * 2.2, 6);
  });

  it('turns the right way round for a goal behind', () => {
    expect(steer(10, 100).out.turn).toBe(1); // behind and slightly east: clockwise is shorter
    expect(steer(-10, 100).out.turn).toBe(-1);
  });

  it('crawls when badly misaligned and eases off proportionally when partly misaligned', () => {
    expect(steer(100, 0).out.throttle).toBeCloseTo(0.1, 9);
    expect(steer(10, 100).out.throttle).toBeCloseTo(0.1, 9);
    const diagonal = steer(100, -100).out.throttle;
    expect(diagonal).toBeLessThan(1);
    expect(diagonal).toBeGreaterThan(0.4);
    expect(diagonal).toBeCloseTo(1 - Math.PI / 4 / 1.6, 6);
  });

  it('scales the throttle by the requested speed fraction', () => {
    expect(steer(0, -100, { speedFraction: 0.5 }).out.throttle).toBeCloseTo(0.5, 9);
    expect(steer(0, -100, { speedFraction: 0 }).out.throttle).toBe(0);
  });

  it('slows down as it nears the goal', () => {
    const near = steer(0, -10);
    expect(near.distance).toBeCloseTo(10, 9);
    expect(near.out.throttle).toBeCloseTo(10 / 24, 6);
    expect(steer(0, -2).out.throttle).toBeCloseTo(0.25, 6);
    expect(steer(0, -30).out.throttle).toBeCloseTo(1, 9);
  });

  it('stops when it is at the goal', () => {
    const { out, distance } = steer(0.2, 0);
    expect(distance).toBeCloseTo(0.2, 9);
    expect(out.throttle).toBe(0);
    expect(out.turn).toBe(0);
  });

  it('respects the heading of the tank when working out left and right', () => {
    // Facing east, a goal to the north is on the left.
    expect(steer(0, -100, { heading: Math.PI / 2 }).out.turn).toBe(-1);
    expect(steer(0, 100, { heading: Math.PI / 2 }).out.turn).toBe(1);
  });

  it('swerves left to avoid an obstacle dead ahead (and never steers into it)', () => {
    const { out } = steer(0, -100, { obstacles: [rock(0, -20, 4)] });
    expect(out.turn).toBeLessThan(-0.3);
  });

  it('steers away from an obstacle on the right and away from one on the left', () => {
    expect(steer(0, -100, { obstacles: [rock(3, -20, 4)] }).out.turn).toBeLessThan(-0.3);
    expect(steer(0, -100, { obstacles: [rock(-3, -20, 4)] }).out.turn).toBeGreaterThan(0.3);
  });

  it('ignores obstacles that are behind, far ahead, or well off to the side', () => {
    expect(steer(0, -100, { obstacles: [rock(0, 30, 4)] }).out.turn).toBeCloseTo(0, 9);
    expect(steer(0, -100, { obstacles: [rock(0, -60, 4)] }).out.turn).toBeCloseTo(0, 9);
    expect(steer(0, -100, { obstacles: [rock(30, -20, 4)] }).out.turn).toBeCloseTo(0, 9);
  });

  it('avoids a wide wall ahead as well as a rock', () => {
    expect(Math.abs(steer(0, -100, { obstacles: [wall(5, -20)] }).out.turn)).toBeGreaterThan(0.3);
  });

  it('is pushed away from a neighbouring tank', () => {
    const rightNeighbour = steer(0, -100, { others: (world) => [placeTank(world, 'standard', 2, 5, 0, 0)] });
    expect(rightNeighbour.out.turn).toBeLessThan(0);
    const leftNeighbour = steer(0, -100, { others: (world) => [placeTank(world, 'standard', 2, -5, 0, 0)] });
    expect(leftNeighbour.out.turn).toBeGreaterThan(0);
  });

  it('ignores tanks that are far away', () => {
    const far = steer(0, -100, { others: (world) => [placeTank(world, 'standard', 2, 80, 0, 0)] });
    expect(far.out.turn).toBeCloseTo(0, 9);
  });

  it('turns back inside the playable square near the boundary', () => {
    // Playable half size is 250 with a 40 m soft zone: x = 230 is inside the zone.
    expect(steer(230, -100, { at: [230, 0] }).out.turn).toBeLessThan(0);
    expect(steer(-230, -100, { at: [-230, 0] }).out.turn).toBeGreaterThan(0);
    expect(steer(100, 230, { at: [0, 230], heading: Math.PI / 2 }).out.turn).toBeLessThan(0);
    expect(steer(100, -230, { at: [0, -230], heading: Math.PI / 2 }).out.turn).toBeGreaterThan(0);
  });

  it('swerves when the ground just ahead is too steep to climb', () => {
    const terrain = new Terrain(300, 5);
    for (let j = 0; j < terrain.resolution; j++) {
      for (let i = 0; i < terrain.resolution; i++) terrain.heights[terrain.index(i, j)] = 0.6 * terrain.vertexZ(j);
    }
    const world = new World(1, terrain, [], 250);
    const tank = new Tank(1, TANK_SPECS.standard, 'enemy');
    tank.placeAt(0, 0, 0, terrain);
    const out = makeOut();
    steerTowards(tank, 0, -100, 1, world, [tank], out);
    expect(Math.abs(out.turn)).toBeGreaterThan(0.3);
  });
});

describe('faceTowards and reverseAwayFrom', () => {
  const world = makeFlatWorld();
  const tank = placeTank(world, 'standard', 1, 0, 0, 0);

  it('faceTowards holds position and rotates towards the target', () => {
    const out: SteeringOutput = { throttle: 1, turn: 0 };
    faceTowards(tank, 100, 0, out);
    expect(out.throttle).toBe(0);
    expect(out.turn).toBe(1);
    faceTowards(tank, -100, 0, out);
    expect(out.turn).toBe(-1);
  });

  it('faceTowards stops turning once aligned (dead band) and scales small errors', () => {
    const out: SteeringOutput = { throttle: 1, turn: 1 };
    faceTowards(tank, 0, -100, out);
    expect(out.turn).toBe(0);
    faceTowards(tank, Math.tan(0.03) * 100, -100, out);
    expect(out.turn).toBe(0);
    faceTowards(tank, Math.tan(0.1) * 100, -100, out);
    expect(out.turn).toBeCloseTo(0.2, 6);
  });

  it('reverseAwayFrom backs off while keeping the nose pointed at the threat', () => {
    const out: SteeringOutput = { throttle: 0, turn: 0 };
    reverseAwayFrom(tank, 100, 0, out);
    expect(out.throttle).toBe(-0.75);
    expect(out.turn).toBe(1);
  });
});

/* ------------------------------------------------------------------------------------------ *
 * EnemyController
 * ------------------------------------------------------------------------------------------ */

/** A Random that always yields the same value, to force a specific AI roll. */
class FixedRandom extends Random {
  constructor(private readonly fixed: number) {
    super(0);
  }

  override next(): number {
    return this.fixed;
  }
}

/** Deterministic difficulty: reaction takes exactly one second and detection reaches far. */
const TEST_DIFFICULTY: DifficultySpec = { ...DIFFICULTY.normal, reactionTime: [1, 1], detectionRange: 600 };

interface Harness {
  world: World;
  player: Tank;
  enemy: Tank;
  controller: EnemyController;
  difficulty: DifficultySpec;
  rng: Random;
  extraTanks: Tank[];
  time: number;
}

interface HarnessOptions {
  kind?: EnemyKind;
  enemyAt?: [number, number];
  enemyHeading?: number;
  playerAt?: [number, number];
  obstacles?: Obstacle[];
  difficulty?: DifficultySpec;
  ctxRng?: Random;
}

function makeHarness(options: HarnessOptions = {}): Harness {
  const world = makeFlatWorld(options.obstacles ?? []);
  const kind = options.kind ?? 'standard';
  const [ex, ez] = options.enemyAt ?? [0, 200];
  const [px, pz] = options.playerAt ?? [0, 0];
  const player = placeTank(world, 'player', 0, px, pz, 0);
  const enemy = placeTank(world, kind, 1, ex, ez, options.enemyHeading ?? 0);
  const difficulty = options.difficulty ?? TEST_DIFFICULTY;
  const controller = new EnemyController(enemy, kind, new Random(11), difficulty);
  return { world, player, enemy, controller, difficulty, rng: options.ctxRng ?? new Random(12), extraTanks: [], time: 0 };
}

interface TickOptions {
  think?: boolean;
  world?: World;
  tickTimers?: boolean;
  move?: boolean;
}

/** Advances one simulation tick of the controller plus the parts of the sim it relies on. */
function tick(h: Harness, options: TickOptions = {}): void {
  const ctx: AIContext = {
    world: options.world ?? h.world,
    player: h.player,
    tanks: [h.player, h.enemy, ...h.extraTanks],
    difficulty: h.difficulty,
    aimErrorScale: 1,
    rng: h.rng,
    dt: DT,
    think: options.think ?? true,
    time: h.time,
  };
  h.controller.update(ctx);
  if (options.move) {
    h.enemy.integrateMotion(DT, h.world.terrain, h.difficulty.enemySpeedMultiplier);
    h.enemy.settleOnTerrain(h.world.terrain, DT);
  }
  h.enemy.updateTurret(DT);
  if (options.tickTimers ?? true) h.enemy.updateTimers(DT);
  h.time += DT;
}

function run(h: Harness, seconds: number, options: TickOptions = {}): void {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i++) tick(h, options);
}

/** Runs until `predicate` is true (or the time limit passes); returns whether it fired. */
function runUntil(h: Harness, seconds: number, predicate: () => boolean, options: TickOptions = {}): boolean {
  const ticks = Math.round(seconds / DT);
  for (let i = 0; i < ticks; i++) {
    tick(h, options);
    if (predicate()) return true;
  }
  return false;
}

/** Lets the controller finish reacting to the (visible) player so that it is engaged. */
function engage(h: Harness): void {
  expect(runUntil(h, 3, () => h.controller.engaged)).toBe(true);
}

describe('EnemyController: perception and reaction', () => {
  it('starts on patrol, unengaged and with no fire command', () => {
    const h = makeHarness();
    expect(h.controller.state).toBe('patrol');
    expect(h.controller.engaged).toBe(false);
    expect(h.enemy.controls.fire).toBe(false);
  });

  it('sees the player but does not engage before its reaction delay', () => {
    const h = makeHarness();
    let fired = false;
    for (let i = 0; i < 58; i++) {
      tick(h);
      fired ||= h.enemy.controls.fire;
      expect(h.controller.engaged).toBe(false);
    }
    expect(h.controller.playerVisible).toBe(true);
    expect(fired).toBe(false);
    expect(h.controller.state).toBe('patrol');
  });

  it('engages a visible player once the reaction delay has passed', () => {
    const h = makeHarness();
    run(h, 1.1);
    expect(h.controller.engaged).toBe(true);
    expect(h.controller.timeSinceSeen).toBe(0);
    expect(h.controller.playerDistance).toBeCloseTo(200, 6);
    expect(h.controller.lastKnownX).toBe(h.player.x);
    expect(h.controller.lastKnownZ).toBe(h.player.z);
  });

  it('never engages a player beyond its detection range', () => {
    const h = makeHarness({ difficulty: { ...TEST_DIFFICULTY, detectionRange: 100 } });
    run(h, 5);
    expect(h.controller.playerVisible).toBe(false);
    expect(h.controller.engaged).toBe(false);
    expect(h.controller.state).toBe('patrol');
    expect(h.enemy.controls.fire).toBe(false);
  });

  it('does not see through a wall', () => {
    const h = makeHarness({ obstacles: [wall(0, 100)] });
    run(h, 4);
    expect(h.controller.playerVisible).toBe(false);
    expect(h.controller.engaged).toBe(false);
  });

  it('does not see through a hill', () => {
    const h = makeHarness();
    const hill = h.world.terrain;
    for (let j = 0; j < hill.resolution; j++) {
      for (let i = 0; i < hill.resolution; i++) {
        hill.heights[hill.index(i, j)] = Math.max(0, 25 - 0.5 * Math.abs(hill.vertexZ(j) - 100));
      }
    }
    run(h, 4);
    expect(h.controller.playerVisible).toBe(false);
  });

  it('hears a very close player behind cover and goes to investigate', () => {
    const h = makeHarness({ enemyAt: [0, 60], obstacles: [wall(0, 30)] });
    run(h, 0.2);
    expect(h.controller.playerVisible).toBe(false);
    expect(h.controller.engaged).toBe(false);
    expect(h.controller.state).toBe('investigate');
    expect(h.controller.lastKnownX).toBe(0);
    expect(h.controller.lastKnownZ).toBe(0);
  });

  it('chooses attack when engaged at close range, pursue when far, and flank for scouts', () => {
    const near = makeHarness({ enemyAt: [0, 120] });
    engage(near);
    expect(near.controller.state).toBe('attack');

    const far = makeHarness({ enemyAt: [0, 300] });
    engage(far);
    expect(far.controller.state).toBe('pursue');

    const scout = makeHarness({ kind: 'scout', enemyAt: [0, 300] });
    engage(scout);
    expect(scout.controller.state).toBe('flank');

    const heavy = makeHarness({ kind: 'heavy', enemyAt: [0, 200] });
    engage(heavy);
    expect(heavy.controller.state).toBe('pursue'); // 200 m is beyond 1.6 x the heavy's 110 m preferred range
  });

  it('loses a target that hides behind cover: attack, then pursue, then investigate', () => {
    const h = makeHarness({ enemyAt: [0, 120] });
    engage(h);
    expect(h.controller.state).toBe('attack');
    const covered = makeFlatWorld([wall(0, 60)]);

    // The enemy now thinks against a world with a wall in the way.
    run(h, 3, { world: covered });
    expect(h.controller.engaged).toBe(false);
    expect(h.controller.state).toBe('pursue');
    run(h, 5, { world: covered });
    expect(h.controller.state).toBe('investigate');
  });

  it('a dead player is ignored: the enemy goes back to patrolling and stops firing', () => {
    const h = makeHarness({ enemyAt: [0, 120] });
    engage(h);
    expect(h.controller.state).toBe('attack');
    h.player.alive = false;
    run(h, 0.5);
    expect(h.controller.engaged).toBe(false);
    expect(h.controller.state).toBe('patrol');
    expect(h.enemy.controls.fire).toBe(false);
  });

  it('a destroyed enemy goes inert', () => {
    const h = makeHarness();
    run(h, 0.5);
    h.enemy.alive = false;
    h.enemy.controls.throttle = 1;
    h.enemy.controls.turn = 1;
    h.enemy.controls.fire = true;
    tick(h);
    expect(h.controller.state).toBe('destroyed');
    expect(h.enemy.controls.throttle).toBe(0);
    expect(h.enemy.controls.turn).toBe(0);
    expect(h.enemy.controls.fire).toBe(false);
  });
});

describe('EnemyController: alerts', () => {
  const faraway = (): Harness => makeHarness({ difficulty: { ...TEST_DIFFICULTY, detectionRange: 50 } });

  it('being hit makes an unaware enemy investigate where the shot came from', () => {
    const h = faraway();
    run(h, 0.2);
    expect(h.controller.state).toBe('patrol');
    h.controller.notifyHit(50, 80);
    tick(h, { think: false }); // a hit forces a decision even between think ticks
    expect(h.controller.state).toBe('investigate');
    expect(h.controller.lastKnownX).toBe(50);
    expect(h.controller.lastKnownZ).toBe(80);
  });

  it('nearby gunfire sends an unaware enemy to investigate near the shot', () => {
    const h = faraway();
    run(h, 0.2);
    h.controller.notifyGunfire(100, 100);
    expect(Math.abs(h.controller.lastKnownX - 100)).toBeLessThanOrEqual(30);
    expect(Math.abs(h.controller.lastKnownZ - 100)).toBeLessThanOrEqual(30);
    tick(h);
    expect(h.controller.state).toBe('investigate');
  });

  it('gunfire is ignored by an enemy that is already engaged', () => {
    const h = makeHarness({ enemyAt: [0, 120] });
    engage(h);
    h.controller.notifyGunfire(500, 500);
    expect(h.controller.lastKnownX).toBe(h.player.x);
    expect(h.controller.lastKnownZ).toBe(h.player.z);
  });

  it('being hit speeds up the reaction to a visible player', () => {
    const slow = makeHarness();
    const quick = makeHarness();
    run(slow, 5 * DT);
    run(quick, 5 * DT);
    quick.controller.notifyHit(0, 0);
    run(quick, 20 * DT);
    expect(quick.controller.engaged).toBe(true);
    run(slow, 20 * DT);
    expect(slow.controller.engaged).toBe(false);
  });
});

describe('EnemyController: reactions to damage', () => {
  function engagedAttacker(kind: EnemyKind, roll: number): Harness {
    const distance = kind === 'scout' ? 70 : kind === 'heavy' ? 90 : 120;
    const h = makeHarness({ kind, enemyAt: [0, distance], ctxRng: new FixedRandom(roll) });
    engage(h);
    return h;
  }

  it('a hit standard tank evades on a low roll and stands its ground on a high one', () => {
    const lucky = engagedAttacker('standard', 0.1);
    expect(lucky.controller.state).toBe('attack');
    lucky.controller.notifyHit(0, 0);
    tick(lucky);
    expect(lucky.controller.state).toBe('evade');

    const steady = engagedAttacker('standard', 0.9);
    steady.controller.notifyHit(0, 0);
    tick(steady);
    expect(steady.controller.state).toBe('attack');
  });

  it('a hit scout evades whatever the roll, but a hit heavy never does', () => {
    const scout = engagedAttacker('scout', 0.99);
    expect(scout.controller.state).toBe('flank');
    // Scouts start in flank; wait until attack so the evade rule for attack applies, or evade straight from flank.
    scout.controller.notifyHit(0, 0);
    tick(scout);
    expect(scout.controller.state).toBe('evade');

    const heavy = engagedAttacker('heavy', 0);
    expect(heavy.controller.state).toBe('attack');
    heavy.controller.notifyHit(0, 0);
    tick(heavy);
    expect(heavy.controller.state).toBe('attack');
  });

  it('evasion lasts evadeTime and then returns to the attack', () => {
    const h = engagedAttacker('standard', 0.1);
    h.controller.notifyHit(0, 0);
    tick(h);
    expect(h.controller.state).toBe('evade');
    run(h, AI.evadeTime - 0.3);
    expect(h.controller.state).toBe('evade');
    run(h, 0.6);
    expect(h.controller.state).toBe('attack');
  });

  it('a badly damaged standard tank retreats once, then fights on', () => {
    const h = makeHarness({ enemyAt: [0, 120] });
    h.enemy.health = h.enemy.spec.maxHealth * 0.2;
    const visited: AIState[] = [];
    for (let i = 0; i < 60 * 12; i++) {
      tick(h);
      if (visited[visited.length - 1] !== h.controller.state) visited.push(h.controller.state);
    }
    expect(visited).toEqual(['patrol', 'attack', 'retreat', 'attack']);
  });

  it('a badly damaged heavy never retreats', () => {
    const h = makeHarness({ kind: 'heavy', enemyAt: [0, 100] });
    h.enemy.health = h.enemy.spec.maxHealth * 0.05;
    const visited = new Set<AIState>();
    for (let i = 0; i < 60 * 12; i++) {
      tick(h);
      visited.add(h.controller.state);
    }
    expect(visited.has('retreat')).toBe(false);
    expect(visited.has('attack')).toBe(true);
  });
});

describe('EnemyController: fire control', () => {
  it('fires at a visible player once engaged, never before', () => {
    const h = makeHarness();
    let firstFireTick = -1;
    for (let i = 0; i < 60 * 8 && firstFireTick < 0; i++) {
      tick(h);
      if (h.enemy.controls.fire) firstFireTick = i;
    }
    expect(firstFireTick).toBeGreaterThanOrEqual(0);
    expect(h.controller.engaged).toBe(true);
    // The reaction delay is 1 s = 60 ticks.
    expect(firstFireTick).toBeGreaterThanOrEqual(59);
  });

  it('does not set fire when an obstacle blocks the line of fire', () => {
    const open = makeHarness();
    engage(open);
    let openFired = false;
    for (let i = 0; i < 60 * 4; i++) {
      tick(open, { think: false });
      openFired ||= open.enemy.controls.fire;
    }
    expect(openFired).toBe(true); // control experiment: the same set-up does fire

    const blocked = makeHarness();
    engage(blocked);
    const coverWorld = makeFlatWorld([wall(0, 100)]);
    let blockedFired = false;
    for (let i = 0; i < 60 * 4; i++) {
      // think: false keeps the enemy "engaged" from its last sighting, so only fire control sees the wall.
      tick(blocked, { think: false, world: coverWorld });
      blockedFired ||= blocked.enemy.controls.fire;
    }
    expect(blocked.controller.engaged).toBe(true);
    expect(blockedFired).toBe(false);
  });

  it('does not fire through a friendly tank standing in the line of fire', () => {
    const h = makeHarness();
    h.extraTanks.push(placeTank(h.world, 'standard', 7, 0, 100, 0));
    let fired = false;
    for (let i = 0; i < 60 * 5; i++) {
      tick(h);
      fired ||= h.enemy.controls.fire;
    }
    expect(h.controller.engaged).toBe(true);
    expect(fired).toBe(false);
  });

  it('never fires an unloaded gun', () => {
    const h = makeHarness();
    engage(h);
    h.enemy.reload = 999;
    let fired = false;
    for (let i = 0; i < 60 * 5; i++) {
      tick(h, { tickTimers: false });
      fired ||= h.enemy.controls.fire;
    }
    expect(h.controller.engaged).toBe(true);
    expect(fired).toBe(false);
  });

  it('only fires on ticks when the reload has finished', () => {
    const h = makeHarness();
    engage(h);
    h.enemy.reload = 2;
    let firedWhileLoading = false;
    let firedAfter = false;
    for (let i = 0; i < 60 * 4; i++) {
      tick(h);
      if (h.enemy.controls.fire && h.enemy.reload > 0) firedWhileLoading = true;
      if (h.enemy.controls.fire && h.enemy.reload === 0) firedAfter = true;
    }
    expect(firedWhileLoading).toBe(false);
    expect(firedAfter).toBe(true);
  });

  it('holds fire when the target is beyond the weapon range', () => {
    const range = TANK_SPECS.scout.weapon.maxRange;
    const h = makeHarness({ kind: 'scout', enemyAt: [0, 290], playerAt: [0, -290], difficulty: { ...TEST_DIFFICULTY, detectionRange: 700 } });
    expect(Math.hypot(0, 580)).toBeGreaterThan(range);
    run(h, 4);
    expect(h.controller.engaged).toBe(true);
    expect(h.enemy.controls.fire).toBe(false);
  });

  it('does not fire until the turret has swung round onto a target behind the hull', () => {
    const h = makeHarness({ enemyHeading: Math.PI }); // hull faces away from the player
    engage(h);
    // The turret needs roughly 2 s to traverse back; nothing may be fired before it is lined up.
    let firedEarly = false;
    for (let i = 0; i < 60 * 1.5; i++) {
      tick(h);
      firedEarly ||= h.enemy.controls.fire;
    }
    expect(firedEarly).toBe(false);
    expect(runUntil(h, 8, () => h.enemy.controls.fire)).toBe(true);
  });
});

describe('EnemyController: movement behaviour', () => {
  it('backs away from a player who is too close', () => {
    const h = makeHarness({ enemyAt: [0, 40] });
    engage(h);
    expect(h.controller.state).toBe('attack');
    expect(h.enemy.controls.throttle).toBe(-0.75);
  });

  it('heavies grind forward when the player is beyond their preferred range, and hold when close', () => {
    const far = makeHarness({ kind: 'heavy', enemyAt: [0, 150] });
    engage(far);
    expect(far.controller.state).toBe('attack');
    expect(far.enemy.controls.throttle).toBeCloseTo(0.65, 6);

    const close = makeHarness({ kind: 'heavy', enemyAt: [0, 100] });
    engage(close);
    expect(close.enemy.controls.throttle).toBe(0);
  });

  it('a patrolling enemy drives at half speed towards its waypoint', () => {
    const h = makeHarness({ difficulty: { ...TEST_DIFFICULTY, detectionRange: 10 } });
    run(h, 0.1);
    expect(h.controller.state).toBe('patrol');
    expect(h.enemy.controls.throttle).toBeGreaterThan(0);
    expect(h.enemy.controls.throttle).toBeLessThanOrEqual(0.5);
  });

  it.each<EnemyKind>(['standard', 'heavy', 'scout'])('a moving %s keeps valid controls and stays on the field for 30 s', (kind) => {
    const h = makeHarness({ kind, enemyAt: [0, 220], obstacles: [rock(0, 120, 5), wall(60, 60)] });
    h.enemy.health = h.enemy.spec.maxHealth * 0.5;
    for (let i = 0; i < 60 * 30; i++) {
      tick(h, { think: i % 6 === 0, move: true });
      const c = h.enemy.controls;
      expect(c.throttle).toBeGreaterThanOrEqual(-1);
      expect(c.throttle).toBeLessThanOrEqual(1);
      expect(c.turn).toBeGreaterThanOrEqual(-1);
      expect(c.turn).toBeLessThanOrEqual(1);
      expect(Number.isFinite(h.enemy.x)).toBe(true);
      expect(Number.isFinite(h.enemy.z)).toBe(true);
    }
    expect(Math.abs(h.enemy.x)).toBeLessThan(h.world.playableHalfSize + 20);
    expect(Math.abs(h.enemy.z)).toBeLessThan(h.world.playableHalfSize + 20);
  });

  it('a pursuing standard tank closes the distance to a distant player', () => {
    const h = makeHarness({ enemyAt: [0, 250], playerAt: [0, -50] });
    const start = Math.hypot(h.enemy.x - h.player.x, h.enemy.z - h.player.z);
    for (let i = 0; i < 60 * 25; i++) tick(h, { think: i % 6 === 0, move: true });
    const end = Math.hypot(h.enemy.x - h.player.x, h.enemy.z - h.player.z);
    expect(start).toBeCloseTo(300, 6);
    expect(end).toBeLessThan(220);
  });

  it('a scout flanks round to the side of the player', () => {
    const h = makeHarness({ kind: 'scout', enemyAt: [0, 200] });
    for (let i = 0; i < 60 * 15; i++) tick(h, { think: i % 6 === 0, move: true });
    expect(['flank', 'attack', 'evade']).toContain(h.controller.state);
    expect(Math.hypot(h.enemy.x, h.enemy.z)).toBeLessThan(200);
  });
});
