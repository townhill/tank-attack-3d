/**
 * Pure enemy behaviour state machine. All randomness and perception are
 * supplied by the caller, so transitions are deterministic and testable.
 */
import type { EnemyKind } from '../config/settings';
import { AI } from '../config/settings';

export type AIState = 'idle' | 'patrol' | 'investigate' | 'pursue' | 'attack' | 'flank' | 'evade' | 'retreat' | 'destroyed';

export interface TransitionInput {
  readonly state: AIState;
  readonly stateTime: number;
  readonly kind: EnemyKind;
  /** Player is visible and the enemy has finished reacting to them. */
  readonly engaged: boolean;
  readonly timeSinceSeen: number;
  readonly playerDistance: number;
  readonly playerAlive: boolean;
  /** Heard gunfire or took a hit since the last decision. */
  readonly alerted: boolean;
  readonly wasHit: boolean;
  readonly healthFraction: number;
  readonly hasRetreated: boolean;
  /** Reached the current navigation goal. */
  readonly arrived: boolean;
  /** Uniform random roll in [0, 1) used for probabilistic reactions. */
  readonly roll: number;
}

/** Chance that a standard tank swerves after being hit. */
const STANDARD_EVADE_CHANCE = 0.4;
const SCOUT_REPOSITION_TIME = 7;
const FLANK_TIMEOUT = 9;
const ATTACK_LOSE_SIGHT_TIME = 1.5;

function engageState(input: TransitionInput): AIState {
  if (input.kind === 'scout') return 'flank';
  return input.playerDistance > AI.preferredRange[input.kind] * 1.6 ? 'pursue' : 'attack';
}

function shouldRetreat(input: TransitionInput): boolean {
  const threshold = AI.retreatHealthFraction[input.kind];
  return threshold > 0 && !input.hasRetreated && input.healthFraction <= threshold;
}

function shouldEvade(input: TransitionInput): boolean {
  if (!input.wasHit) return false;
  if (input.kind === 'scout') return true;
  if (input.kind === 'standard') return input.roll < STANDARD_EVADE_CHANCE;
  return false;
}

export function decideNextState(input: TransitionInput): AIState {
  if (input.state === 'destroyed' || input.healthFraction <= 0) return 'destroyed';
  if (!input.playerAlive) return input.state === 'idle' ? 'idle' : 'patrol';
  const preferred = AI.preferredRange[input.kind];

  switch (input.state) {
    case 'idle':
      if (input.engaged) return engageState(input);
      if (input.alerted) return 'investigate';
      return input.stateTime > 2 ? 'patrol' : 'idle';

    case 'patrol':
      if (input.engaged) return engageState(input);
      if (input.alerted) return 'investigate';
      return 'patrol';

    case 'investigate':
      if (input.engaged) return engageState(input);
      if (input.arrived || input.stateTime > AI.investigateTime) return 'patrol';
      return 'investigate';

    case 'pursue':
      if (shouldRetreat(input)) return 'retreat';
      if (input.engaged && input.playerDistance <= preferred * 1.3) return input.kind === 'scout' ? 'flank' : 'attack';
      if (!input.engaged && input.timeSinceSeen > AI.loseTargetTime) return 'investigate';
      return 'pursue';

    case 'attack':
      if (shouldRetreat(input)) return 'retreat';
      if (shouldEvade(input)) return 'evade';
      if (!input.engaged && input.timeSinceSeen > ATTACK_LOSE_SIGHT_TIME) return 'pursue';
      if (input.playerDistance > preferred * 2) return 'pursue';
      if (input.kind === 'scout' && input.stateTime > SCOUT_REPOSITION_TIME) return 'flank';
      return 'attack';

    case 'flank':
      if (shouldRetreat(input)) return 'retreat';
      if (input.wasHit) return 'evade';
      if (input.arrived || input.stateTime > FLANK_TIMEOUT) return 'attack';
      if (!input.engaged && input.timeSinceSeen > AI.loseTargetTime) return 'investigate';
      return 'flank';

    case 'evade':
      if (input.stateTime < AI.evadeTime) return 'evade';
      return input.engaged ? 'attack' : 'pursue';

    case 'retreat':
      if (input.stateTime < AI.retreatTime) return 'retreat';
      return input.engaged ? 'attack' : 'pursue';
  }
}

/** States in which the enemy actively tracks the player with its gun. */
export function isCombatState(state: AIState): boolean {
  return state === 'pursue' || state === 'attack' || state === 'flank' || state === 'evade' || state === 'retreat';
}
