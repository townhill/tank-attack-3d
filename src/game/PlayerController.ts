/**
 * Maps raw input (keyboard, mouse, gamepad) to the player's tank command and
 * aim state. Knows nothing about rendering or game rules.
 */
import type { UserSettings } from '../config/userSettings';
import type { GamepadState, InputManager } from '../input/InputManager';
import type { AimState, CameraState } from '../rendering/CameraState';
import type { PlayerCommand } from './Simulation';
import { createPlayerCommand } from './Simulation';

/** Gamepad right-stick aim speed in radians per second at full deflection. */
const PAD_AIM_RATE = 2.4;
/** Overhead ground-cursor speed per gamepad deflection (fraction of altitude per second). */
const PAD_CURSOR_RATE = 1.4;
/** Overhead cursor metres per mouse pixel per metre of camera altitude. */
const CURSOR_SCALE = 0.0045;
const REFERENCE_FOV = 70;

export class PlayerController {
  readonly command: PlayerCommand = createPlayerCommand();
  /** Ignore the left button until it is released (e.g. the click that captured the pointer). */
  suppressFire = false;
  private readonly mouse = { x: 0, y: 0 };

  /** Clears driving and firing (used when the map or menus take over input). */
  neutral(): void {
    this.command.throttle = 0;
    this.command.turn = 0;
    this.command.fire = false;
  }

  update(dt: number, input: InputManager, pad: GamepadState, camera: CameraState, aim: AimState, settings: UserSettings, fov: number): void {
    input.consumeMouse(this.mouse);
    if (!input.leftButton) this.suppressFire = false;

    // Aim: mouse look scales with FOV so zoomed aiming stays precise.
    if (camera.mode === 'overhead') {
      const metresPerPixel = camera.overheadHeight * CURSOR_SCALE * settings.mouseSensitivity;
      aim.applyGroundCursor(this.mouse.x, this.mouse.y, metresPerPixel);
      if (pad.connected && (pad.aimX !== 0 || pad.aimY !== 0)) {
        const rate = camera.overheadHeight * PAD_CURSOR_RATE * dt;
        aim.applyGroundCursor(pad.aimX * rate, pad.aimY * rate, 1);
      }
    } else {
      const scale = settings.mouseSensitivity * (fov / REFERENCE_FOV);
      aim.applyLook(this.mouse.x, this.mouse.y, scale, settings.invertY);
      if (pad.connected && (pad.aimX !== 0 || pad.aimY !== 0)) {
        const k = (PAD_AIM_RATE * dt * (fov / REFERENCE_FOV)) / 0.0022;
        aim.applyLook(pad.aimX * k, pad.aimY * k, 1, settings.invertY);
      }
    }

    let throttle = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) throttle += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) throttle -= 1;
    let turn = 0;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) turn += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) turn -= 1;
    if (pad.connected) {
      if (Math.abs(pad.moveY) > Math.abs(throttle)) throttle = -pad.moveY;
      if (Math.abs(pad.moveX) > Math.abs(turn)) turn = pad.moveX;
    }
    this.command.throttle = throttle;
    this.command.turn = turn;
    this.command.fire = ((input.leftButton || input.leftPressed) && !this.suppressFire) || input.isDown('Space') || pad.fire;
    camera.zoomHeld = input.rightButton || pad.zoom;
  }
}
