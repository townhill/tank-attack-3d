import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { TANK_SPECS } from '../src/config/settings';
import { DEFAULT_SETTINGS } from '../src/config/userSettings';
import { Tank } from '../src/entities/Tank';
import { AimSolver } from '../src/game/Aiming';
import { PlayerController } from '../src/game/PlayerController';
import type { GamepadState, InputManager } from '../src/input/InputManager';
import { AimState, CameraState } from '../src/rendering/CameraState';
import type { Obstacle } from '../src/world/Obstacle';
import { Terrain } from '../src/world/Terrain';
import { World } from '../src/world/World';

function flatWorld(obstacles: Obstacle[] = []): World {
  return new World(1, new Terrain(300, 5), obstacles, 250);
}

function settle(tank: Tank, world: World, steps = 240): void {
  for (let i = 0; i < steps; i++) tank.updateTurret(1 / 60);
  tank.settleOnGround(world.terrain, 0);
}

describe('AimSolver', () => {
  it('finds the terrain point under a downward crosshair ray', () => {
    const world = flatWorld();
    const player = new Tank(0, TANK_SPECS.player, 'player');
    player.placeAt(0, 0, 0, world.terrain);
    const solver = new AimSolver();
    const hit = solver.castRay(new Vector3(0, 10, 0), new Vector3(0, -1, -1).normalize(), world, [player], player);
    expect(hit.y).toBeCloseTo(0, 1);
    expect(hit.z).toBeCloseTo(-10, 1);
    expect(solver.aimTarget).toBeNull();
  });

  it('reports the enemy tank under the crosshair and ignores the player', () => {
    const world = flatWorld();
    const player = new Tank(0, TANK_SPECS.player, 'player');
    player.placeAt(0, 0, 0, world.terrain);
    const enemy = new Tank(1, TANK_SPECS.standard, 'enemy');
    enemy.placeAt(0, -80, 0, world.terrain);
    const solver = new AimSolver();
    solver.castRay(new Vector3(0, 1.5, 5), new Vector3(0, 0, -1), world, [player, enemy], player);
    expect(solver.aimTarget).toBe(enemy);
    expect(solver.aimPoint.z).toBeGreaterThan(-80);
  });

  it('snaps the overhead cursor onto a nearby enemy', () => {
    const world = flatWorld();
    const player = new Tank(0, TANK_SPECS.player, 'player');
    player.placeAt(0, 0, 0, world.terrain);
    const enemy = new Tank(1, TANK_SPECS.scout, 'enemy');
    enemy.placeAt(40, -40, 0, world.terrain);
    const solver = new AimSolver();
    solver.groundCursor(43, -38, world, [player, enemy], player);
    expect(solver.aimTarget).toBe(enemy);
    solver.groundCursor(100, 100, world, [player, enemy], player);
    expect(solver.aimTarget).toBeNull();
    expect(solver.aimPoint.y).toBeCloseTo(1.4, 6);
  });

  it('lays the gun so the predicted impact lands on the aim point', () => {
    const world = flatWorld();
    const player = new Tank(0, TANK_SPECS.player, 'player');
    player.placeAt(0, 0, 0, world.terrain);
    const solver = new AimSolver();
    solver.aimPoint.set(0, 0, -150);
    const dir = solver.gunDirection(player, new Vector3(0, 0, -1), new Vector3());
    expect(dir.length()).toBeCloseTo(1, 6);
    player.aimDirection.copy(dir);
    settle(player, world);
    solver.predictImpact(player, world, [player]);
    expect(solver.gunImpactValid).toBe(true);
    expect(solver.gunImpact.distanceTo(solver.aimPoint)).toBeLessThan(2.5);
  });

  it('predicts a hit on the tank the barrel is pointing at', () => {
    const world = flatWorld();
    const player = new Tank(0, TANK_SPECS.player, 'player');
    player.placeAt(0, 0, 0, world.terrain);
    const enemy = new Tank(1, TANK_SPECS.heavy, 'enemy');
    enemy.placeAt(0, -60, 0, world.terrain);
    const solver = new AimSolver();
    enemy.getCentre(solver.aimPoint);
    player.aimDirection.copy(solver.gunDirection(player, new Vector3(0, 0, -1), new Vector3()));
    settle(player, world);
    solver.predictImpact(player, world, [player, enemy]);
    expect(solver.gunTarget).toBe(enemy);
  });

  it('falls back to the camera direction when the aim point is at the muzzle', () => {
    const world = flatWorld();
    const player = new Tank(0, TANK_SPECS.player, 'player');
    player.placeAt(0, 0, 0, world.terrain);
    const solver = new AimSolver();
    const muzzle = new Vector3();
    player.getMuzzle(muzzle, new Vector3());
    solver.aimPoint.copy(muzzle);
    const fallback = new Vector3(1, 0, 0);
    expect(solver.gunDirection(player, fallback, new Vector3())).toEqual(fallback);
  });
});

function fakeInput(keys: string[], left = false, right = false, mouseX = 0, mouseY = 0): InputManager {
  const down = new Set(keys);
  return {
    leftButton: left,
    leftPressed: false,
    rightButton: right,
    isDown: (code: string) => down.has(code),
    consumeMouse: (out: { x: number; y: number }) => {
      out.x = mouseX;
      out.y = mouseY;
      return out;
    },
  } as unknown as InputManager;
}

function pad(overrides: Partial<GamepadState> = {}): GamepadState {
  return {
    connected: false, moveX: 0, moveY: 0, aimX: 0, aimY: 0, fire: false, zoom: false,
    cameraPressed: false, mapPressed: false, pausePressed: false, radarPressed: false, ...overrides,
  };
}

describe('PlayerController', () => {
  it('maps WASD to throttle and turn', () => {
    const c = new PlayerController();
    c.update(1 / 60, fakeInput(['KeyW', 'KeyD']), pad(), new CameraState('third'), new AimState(), DEFAULT_SETTINGS, 70);
    expect(c.command.throttle).toBe(1);
    expect(c.command.turn).toBe(1);
    c.update(1 / 60, fakeInput(['ArrowDown', 'ArrowLeft']), pad(), new CameraState('third'), new AimState(), DEFAULT_SETTINGS, 70);
    expect(c.command.throttle).toBe(-1);
    expect(c.command.turn).toBe(-1);
  });

  it('fires with the left button or space, but not on a suppressed capture click', () => {
    const c = new PlayerController();
    const cam = new CameraState('third');
    c.update(1 / 60, fakeInput([], true), pad(), cam, new AimState(), DEFAULT_SETTINGS, 70);
    expect(c.command.fire).toBe(true);
    c.suppressFire = true;
    c.update(1 / 60, fakeInput([], true), pad(), cam, new AimState(), DEFAULT_SETTINGS, 70);
    expect(c.command.fire).toBe(false);
    c.update(1 / 60, fakeInput(['Space']), pad(), cam, new AimState(), DEFAULT_SETTINGS, 70);
    expect(c.command.fire).toBe(true);
    expect(c.suppressFire).toBe(false);
  });

  it('applies mouse look in first/third person and moves the ground cursor in overhead view', () => {
    const c = new PlayerController();
    const aim = new AimState();
    c.update(1 / 60, fakeInput([], false, false, 50, 0), pad(), new CameraState('first'), aim, DEFAULT_SETTINGS, 70);
    expect(aim.yaw).toBeGreaterThan(0);
    const overheadAim = new AimState();
    overheadAim.reset(0);
    const before = overheadAim.groundOffsetX;
    c.update(1 / 60, fakeInput([], false, false, 50, 0), pad(), new CameraState('overhead'), overheadAim, DEFAULT_SETTINGS, 70);
    expect(overheadAim.groundOffsetX).toBeGreaterThan(before);
  });

  it('uses gamepad sticks and triggers, and the right button holds zoom', () => {
    const c = new PlayerController();
    const cam = new CameraState('third');
    c.update(1 / 60, fakeInput([], false, true), pad({ connected: true, moveY: -0.8, moveX: 0.5, fire: true }), cam, new AimState(), DEFAULT_SETTINGS, 70);
    expect(c.command.throttle).toBeCloseTo(0.8, 6);
    expect(c.command.turn).toBeCloseTo(0.5, 6);
    expect(c.command.fire).toBe(true);
    expect(cam.zoomHeld).toBe(true);
  });

  it('neutral() stops driving and firing', () => {
    const c = new PlayerController();
    c.update(1 / 60, fakeInput(['KeyW'], true), pad(), new CameraState('third'), new AimState(), DEFAULT_SETTINGS, 70);
    c.neutral();
    expect(c.command.throttle).toBe(0);
    expect(c.command.turn).toBe(0);
    expect(c.command.fire).toBe(false);
  });
});
