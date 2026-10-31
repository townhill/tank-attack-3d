/**
 * A compact fingerprint of a generated battlefield, so a test can pin down a
 * seed's exact world in one number and catch any change to it.
 */
import type { World } from '../src/world/World';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function foldBytes(hash: number, bytes: Uint8Array): number {
  let h = hash;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, FNV_PRIME);
  }
  return h;
}

function foldText(hash: number, text: string): number {
  let h = hash;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return h;
}

function bytesOf(values: Float32Array): Uint8Array {
  return new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
}

/** FNV-1a over the heights, water level, obstacles, rivers, lakes, bridges and fords of `world`. */
export function worldFingerprint(world: World): number {
  let h = FNV_OFFSET;
  h = foldBytes(h, bytesOf(world.terrain.heights));
  h = foldBytes(h, bytesOf(world.water.level));
  h = foldText(h, JSON.stringify(world.obstacles));
  h = foldText(h, JSON.stringify(world.rivers));
  h = foldText(h, JSON.stringify(world.lakes));
  h = foldText(h, JSON.stringify(world.bridges));
  h = foldText(h, JSON.stringify(world.fords));
  return h >>> 0;
}
