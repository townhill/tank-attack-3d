/**
 * Maps simulation events to one-shot sounds: what plays, where, and how loud.
 */
import type { FireEvent, GameEvent, ImpactEvent, PlayerDamagedEvent, TankDestroyedEvent } from '../game/events';
import { clamp } from '../utils/math';
import { fireTimbre } from './audioMath';
import type { Mixer } from './mixer';
import { cannon, explosion, hitConfirm, hullHit, obstacleImpact, tankImpact, terrainImpact, waterImpact } from './sfxCombat';
import { alertRise, fallingTone, gameOverTone, radarPing, warningChirp, waveChime } from './sfxCues';

const FIRE_REF_DISTANCE = 25;
const IMPACT_REF_DISTANCE = 20;
const EXPLOSION_REF_DISTANCE = 30;
/** Explosions carry further than other sounds. */
const EXPLOSION_ROLLOFF = 0.8;
const ENEMY_FIRE_LEVEL = 0.85;
/** Damage at which the player's hit thump reaches full weight. */
const HEAVY_HIT_DAMAGE = 30;

export function playEventSound(mixer: Mixer, event: GameEvent, playerTankId: number, retro: boolean): void {
  switch (event.type) {
    case 'fire':
      playFire(mixer, event, playerTankId, retro);
      return;
    case 'impact':
      playImpact(mixer, event, retro);
      return;
    case 'tankHit':
      // The matching impact event already carries the clang; confirm the player's hits.
      if (event.attackerId === playerTankId && event.tankId !== playerTankId) {
        mixer.playDirect(0.5, (v, t) => {
          hitConfirm(v, t, retro, 1);
        });
      }
      return;
    case 'tankDestroyed':
      playDestroyed(mixer, event, playerTankId, retro);
      return;
    case 'playerDamaged':
      playPlayerDamaged(mixer, event, retro);
      return;
    case 'enemySpawned':
      mixer.playPanned(mixer.panTowards(event.x, event.z) * 0.8, 0.15, (v, t) => {
        radarPing(v, t, retro, 1);
      });
      return;
    case 'waveStart':
      mixer.playDirect(0.9, (v, t) => {
        alertRise(v, t, retro, 1);
      });
      return;
    case 'waveComplete':
      mixer.playDirect(0.9, (v, t) => {
        waveChime(v, t, retro, 1);
      });
      return;
    case 'gameOver':
      mixer.playDirect(
        1.2,
        (v, t) => {
          gameOverTone(v, t, retro, 1);
        },
        true,
      );
      return;
  }
}

function playFire(mixer: Mixer, event: FireEvent, playerTankId: number, retro: boolean): void {
  const timbre = fireTimbre(event.kind);
  if (event.tankId === playerTankId) {
    mixer.playDirect(timbre.gain, (v, t) => {
      cannon(v, t, retro, timbre, 1);
    });
    return;
  }
  mixer.playAt(event.x, event.y, event.z, timbre.gain * ENEMY_FIRE_LEVEL, FIRE_REF_DISTANCE, 1, (v, t) => {
    cannon(v, t, retro, timbre, ENEMY_FIRE_LEVEL);
  });
}

/** The sound of a shell hitting `surface`, or null for one that just ran out of range. */
export function impactRecipeFor(surface: ImpactEvent['surface']): typeof terrainImpact | null {
  switch (surface) {
    case 'terrain':
      return terrainImpact;
    case 'water':
      return waterImpact;
    case 'obstacle':
    case 'bridge':
      return obstacleImpact;
    case 'tank':
      return tankImpact;
    case 'expired':
      return null;
  }
}

function playImpact(mixer: Mixer, event: ImpactEvent, retro: boolean): void {
  const recipe = impactRecipeFor(event.surface);
  if (!recipe) return;
  const loudness = event.faction === 'player' ? 0.8 : 0.7;
  mixer.playAt(event.x, event.y, event.z, loudness, IMPACT_REF_DISTANCE, 1, (v, t) => {
    recipe(v, t, retro, 1);
  });
}

function playDestroyed(mixer: Mixer, event: TankDestroyedEvent, playerTankId: number, retro: boolean): void {
  if (event.tankId === playerTankId) {
    mixer.playDirect(2, (v, t) => {
      explosion(v, t, retro, 2.2, 1.2);
    });
    mixer.playDirect(1.5, (v, t) => {
      explosion(v, t + 0.35, retro, 1.2, 0.7);
    });
    mixer.playDirect(0.8, (v, t) => {
      fallingTone(v, t, retro, 440, 40, 1.6, 0.8);
    });
    return;
  }
  mixer.playAt(event.x, event.y, event.z, 1.5, EXPLOSION_REF_DISTANCE, EXPLOSION_ROLLOFF, (v, t) => {
    explosion(v, t, retro, 1, 1);
  });
  const toneLevel = event.byPlayer ? 1 : 0.4;
  mixer.playDirect(0.3 * toneLevel, (v, t) => {
    fallingTone(v, t + 0.05, retro, 880, 110, 0.7, 0.25 * toneLevel);
  });
}

function playPlayerDamaged(mixer: Mixer, event: PlayerDamagedEvent, retro: boolean): void {
  const pan = mixer.panTowards(event.sourceX, event.sourceZ);
  const level = 0.6 + 0.4 * clamp(event.amount / HEAVY_HIT_DAMAGE, 0, 1);
  mixer.playPanned(pan * 0.5, 1.2, (v, t) => {
    hullHit(v, t, retro, level);
  });
  mixer.playPanned(pan, 0.6, (v, t) => {
    warningChirp(v, t, retro, 1);
  });
}
