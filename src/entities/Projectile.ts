import type { Faction } from '../config/settings';

export class Projectile {
  active = false;
  /** Increments every time the slot is reused, so views can detect new shells. */
  generation = 0;
  ownerId = -1;
  faction: Faction = 'player';
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  prevX = 0;
  prevY = 0;
  prevZ = 0;
  age = 0;
  damage = 0;

  constructor(readonly slot: number) {}
}

/** Fixed-size pool so firing never allocates during gameplay. */
export class ProjectilePool {
  readonly items: Projectile[];

  constructor(size: number) {
    this.items = Array.from({ length: size }, (_, i) => new Projectile(i));
  }

  acquire(): Projectile | null {
    for (const p of this.items) {
      if (!p.active) {
        p.active = true;
        p.generation++;
        p.age = 0;
        return p;
      }
    }
    return null;
  }

  release(p: Projectile): void {
    p.active = false;
  }

  activeCount(): number {
    let n = 0;
    for (const p of this.items) if (p.active) n++;
    return n;
  }

  clear(): void {
    for (const p of this.items) p.active = false;
  }
}
