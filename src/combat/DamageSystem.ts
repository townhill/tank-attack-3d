/** Damage calculation: armour, hit zones and difficulty scaling. */
import { DAMAGE } from '../config/settings';
import { angleDiff, headingOf } from '../utils/math';

export type HitZone = 'front' | 'side' | 'rear';

/**
 * Classifies a hit by the direction the shell came from relative to the
 * target hull's heading. `shellDx/Dz` is the shell's travel direction.
 */
export function hitZone(targetHeading: number, shellDx: number, shellDz: number): HitZone {
  if (Math.abs(shellDx) < 1e-9 && Math.abs(shellDz) < 1e-9) return 'side';
  const incoming = headingOf(-shellDx, -shellDz);
  const relative = Math.abs(angleDiff(targetHeading, incoming));
  if (relative <= DAMAGE.frontArc) return 'front';
  if (relative >= Math.PI - DAMAGE.rearArc) return 'rear';
  return 'side';
}

export function zoneMultiplier(zone: HitZone): number {
  switch (zone) {
    case 'front':
      return DAMAGE.frontMultiplier;
    case 'rear':
      return DAMAGE.rearMultiplier;
    case 'side':
      return DAMAGE.sideMultiplier;
  }
}

export interface DamageInput {
  readonly baseDamage: number;
  readonly armor: number;
  readonly zone: HitZone;
  /** Extra scaling, e.g. difficulty or friendly fire. */
  readonly multiplier: number;
}

export function computeDamage(input: DamageInput): number {
  const armor = Math.min(Math.max(input.armor, 0), 0.95);
  const value = input.baseDamage * (1 - armor) * zoneMultiplier(input.zone) * input.multiplier;
  return Math.max(0, value);
}

export interface Damageable {
  health: number;
  alive: boolean;
}

/** Applies damage and reports whether this hit destroyed the target. */
export function applyDamage(target: Damageable, amount: number): boolean {
  if (!target.alive || amount <= 0) return false;
  target.health = Math.max(0, target.health - amount);
  if (target.health <= 0) {
    target.alive = false;
    return true;
  }
  return false;
}
