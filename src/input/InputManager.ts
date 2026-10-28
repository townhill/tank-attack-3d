/**
 * Keyboard, mouse (with pointer lock) and gamepad input. Collects raw state
 * and edge-triggered presses; the game decides what each input means.
 */

/** Keys whose default browser behaviour is suppressed while in gameplay. */
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyV', 'KeyM', 'KeyR', 'KeyC', 'KeyF', 'KeyH', 'KeyP',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backquote',
  'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'Backspace',
]);

export interface GamepadState {
  connected: boolean;
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  fire: boolean;
  zoom: boolean;
  cameraPressed: boolean;
  mapPressed: boolean;
  pausePressed: boolean;
  radarPressed: boolean;
}

const GAMEPAD_DEADZONE = 0.18;
const WHEEL_LINE_PIXELS = 16;

function applyDeadzone(v: number): number {
  const a = Math.abs(v);
  if (a < GAMEPAD_DEADZONE) return 0;
  return Math.sign(v) * ((a - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE));
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

export class InputManager {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private wheelDelta = 0;
  leftButton = false;
  /** True for the frame in which the left button went down (catches very quick clicks). */
  leftPressed = false;
  rightButton = false;
  /** When true, gameplay keys have their browser defaults suppressed. */
  captureKeys = false;
  pointerLocked = false;
  onPointerLockChange: ((locked: boolean) => void) | null = null;
  /** Fired for every non-repeat keydown (used for menu/global shortcuts). */
  onKeyPressed: ((code: string, event: KeyboardEvent) => void) | null = null;
  private readonly prevPadButtons: boolean[] = [];
  private readonly padState: GamepadState = {
    connected: false, moveX: 0, moveY: 0, aimX: 0, aimY: 0, fire: false, zoom: false,
    cameraPressed: false, mapPressed: false, pausePressed: false, radarPressed: false,
  };
  private readonly listeners: (() => void)[] = [];
  private lockWarningShown = false;

  constructor(private readonly element: HTMLElement) {
    this.listen(window, 'keydown', (e) => { this.handleKeyDown(e as KeyboardEvent); });
    this.listen(window, 'keyup', (e) => { this.handleKeyUp(e as KeyboardEvent); });
    this.listen(window, 'blur', () => { this.releaseAll(); });
    this.listen(element, 'mousedown', (e) => { this.handleMouseDown(e as MouseEvent); });
    this.listen(window, 'mouseup', (e) => { this.handleMouseUp(e as MouseEvent); });
    this.listen(document, 'mousemove', (e) => { this.handleMouseMove(e as MouseEvent); });
    this.listen(element, 'wheel', (e) => { this.handleWheel(e as WheelEvent); }, { passive: false });
    this.listen(element, 'contextmenu', (e) => { e.preventDefault(); });
    this.listen(document, 'pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.element;
      if (!this.pointerLocked) this.releaseAll();
      this.onPointerLockChange?.(this.pointerLocked);
    });
  }

  private listen(target: EventTarget, type: string, fn: (e: Event) => void, options?: AddEventListenerOptions): void {
    target.addEventListener(type, fn, options);
    this.listeners.push(() => {
      target.removeEventListener(type, fn, options);
    });
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (isEditableTarget(e.target)) return;
    if (this.captureKeys && GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) {
      this.pressed.add(e.code);
      this.onKeyPressed?.(e.code, e);
    }
    this.down.add(e.code);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.down.delete(e.code);
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      this.leftButton = true;
      this.leftPressed = true;
    }
    if (e.button === 2) this.rightButton = true;
  }

  private handleMouseUp(e: MouseEvent): void {
    if (e.button === 0) this.leftButton = false;
    if (e.button === 2) this.rightButton = false;
  }

  private handleMouseMove(e: MouseEvent): void {
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    this.wheelDelta += e.deltaMode === 1 ? e.deltaY * WHEEL_LINE_PIXELS : e.deltaY;
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True only on the frame the key went down. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Returns and clears accumulated mouse movement in CSS pixels. */
  consumeMouse(out: { x: number; y: number }): { x: number; y: number } {
    out.x = this.mouseDX;
    out.y = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return out;
  }

  consumeWheel(): number {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }

  /** Clears edge-triggered state; call once at the end of each frame. */
  endFrame(): void {
    this.pressed.clear();
    this.leftPressed = false;
  }

  releaseAll(): void {
    this.down.clear();
    this.leftButton = false;
    this.rightButton = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  /** Requests pointer lock; resolves false when the browser refuses. */
  async requestPointerLock(): Promise<boolean> {
    if (document.pointerLockElement === this.element) return true;
    try {
      await this.element.requestPointerLock();
      return true;
    } catch (error) {
      if (!this.lockWarningShown) {
        this.lockWarningShown = true;
        console.warn('Pointer lock unavailable; mouse aiming continues without it.', error);
      }
      return false;
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Polls the first connected standard gamepad with edge detection on buttons. */
  pollGamepad(): GamepadState {
    const s = this.padState;
    s.cameraPressed = s.mapPressed = s.pausePressed = s.radarPressed = false;
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const pad = pads.find((p): p is Gamepad => p !== null && p.connected);
    if (!pad) {
      s.connected = false;
      s.moveX = s.moveY = s.aimX = s.aimY = 0;
      s.fire = s.zoom = false;
      return s;
    }
    s.connected = true;
    s.moveX = applyDeadzone(pad.axes[0] ?? 0);
    s.moveY = applyDeadzone(pad.axes[1] ?? 0);
    s.aimX = applyDeadzone(pad.axes[2] ?? 0);
    s.aimY = applyDeadzone(pad.axes[3] ?? 0);
    const button = (i: number): boolean => pad.buttons[i]?.pressed ?? false;
    const edge = (i: number): boolean => {
      const now = button(i);
      const was = this.prevPadButtons[i] ?? false;
      this.prevPadButtons[i] = now;
      return now && !was;
    };
    s.fire = button(7) || button(0);
    s.zoom = button(6);
    s.cameraPressed = edge(3);
    s.mapPressed = edge(8);
    s.pausePressed = edge(9);
    s.radarPressed = edge(2);
    return s;
  }

  dispose(): void {
    for (const off of this.listeners) off();
    this.listeners.length = 0;
  }
}
