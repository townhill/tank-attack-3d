import { describe, expect, it } from 'vitest';
import { AIM_LIMITS, AimState, CAMERA_LIMITS, CAMERA_MODES, CameraState } from '../src/rendering/CameraState';

describe('CameraState', () => {
  it('starts in the requested mode with no transition in progress', () => {
    const state = new CameraState('first');
    expect(state.mode).toBe('first');
    expect(state.isTransitioning).toBe(false);
    expect(state.transitionBlend).toBe(1);
  });

  it('cycles first -> third -> overhead -> first', () => {
    const state = new CameraState('first');
    const seen = [state.cycle(), state.cycle(), state.cycle()];
    expect(seen).toEqual(['third', 'overhead', 'first']);
    expect(CAMERA_MODES).toEqual(['first', 'third', 'overhead']);
  });

  it('records the previous mode and starts a transition on change', () => {
    const state = new CameraState('third');
    expect(state.setMode('overhead')).toBe(true);
    expect(state.previousMode).toBe('third');
    expect(state.isTransitioning).toBe(true);
    expect(state.transitionBlend).toBe(0);
  });

  it('ignores switching to the mode already active', () => {
    const state = new CameraState('third');
    expect(state.setMode('third')).toBe(false);
    expect(state.isTransitioning).toBe(false);
  });

  it('completes the transition after the configured time with an eased blend', () => {
    const state = new CameraState('first');
    state.setMode('third');
    state.update(CAMERA_LIMITS.transitionTime / 2);
    expect(state.transitionBlend).toBeCloseTo(0.5, 5);
    state.update(CAMERA_LIMITS.transitionTime);
    expect(state.isTransitioning).toBe(false);
    expect(state.transitionBlend).toBe(1);
  });

  it('wheel zoom changes chase distance only in third person and clamps it', () => {
    const state = new CameraState('third');
    state.adjustZoom(100000);
    expect(state.thirdDistance).toBe(CAMERA_LIMITS.thirdMax);
    state.adjustZoom(-100000);
    expect(state.thirdDistance).toBe(CAMERA_LIMITS.thirdMin);
    state.setMode('first');
    const before = state.thirdDistance;
    state.adjustZoom(500);
    expect(state.thirdDistance).toBe(before);
  });

  it('wheel zoom changes altitude in overhead mode and clamps it', () => {
    const state = new CameraState('overhead');
    state.adjustZoom(-100000);
    expect(state.overheadHeight).toBe(CAMERA_LIMITS.overheadMin);
    state.adjustZoom(100000);
    expect(state.overheadHeight).toBe(CAMERA_LIMITS.overheadMax);
  });

  it('narrows the field of view while zoom is held and restores it on release', () => {
    const state = new CameraState('first');
    state.zoomHeld = true;
    for (let i = 0; i < 120; i++) state.update(1 / 60);
    expect(state.fieldOfView(70)).toBeCloseTo(70 * CAMERA_LIMITS.zoomFovFactor, 3);
    state.zoomHeld = false;
    for (let i = 0; i < 120; i++) state.update(1 / 60);
    expect(state.fieldOfView(70)).toBe(70);
  });

  it('never applies sight zoom in overhead mode and widens the view instead', () => {
    const state = new CameraState('overhead');
    state.zoomHeld = true;
    state.update(1);
    expect(state.zoomBlend).toBe(0);
    expect(state.fieldOfView(70)).toBe(70 + CAMERA_LIMITS.overheadFovBonus);
  });
});

describe('AimState', () => {
  it('turns right for positive mouse x and wraps yaw', () => {
    const aim = new AimState();
    aim.reset(Math.PI - 0.01);
    aim.applyLook(100, 0, 1, false);
    expect(aim.yaw).toBeLessThan(0);
    expect(aim.yaw).toBeGreaterThan(-Math.PI);
  });

  it('pitches up when the mouse moves up and honours invert-Y', () => {
    const aim = new AimState();
    aim.applyLook(0, -10, 1, false);
    expect(aim.pitch).toBeGreaterThan(0);
    const inverted = new AimState();
    inverted.applyLook(0, -10, 1, true);
    expect(inverted.pitch).toBeLessThan(0);
  });

  it('clamps pitch to the configured limits', () => {
    const aim = new AimState();
    aim.applyLook(0, -1e6, 1, false);
    expect(aim.pitch).toBe(AIM_LIMITS.pitchMax);
    aim.applyLook(0, 1e6, 1, false);
    expect(aim.pitch).toBe(AIM_LIMITS.pitchMin);
  });

  it('moves the overhead cursor east and south in screen directions and updates yaw', () => {
    const aim = new AimState();
    aim.reset(0);
    aim.applyGroundCursor(0, 200, 1);
    expect(aim.groundOffsetZ).toBeCloseTo(120, 6);
    expect(aim.yaw).toBeCloseTo(Math.PI, 6);
    aim.applyGroundCursor(500, 0, 1);
    expect(aim.groundOffsetX).toBeGreaterThan(0);
  });

  it('limits how far the overhead cursor can move from the tank', () => {
    const aim = new AimState();
    aim.applyGroundCursor(1e6, 1e6, 1);
    expect(Math.hypot(aim.groundOffsetX, aim.groundOffsetZ)).toBeCloseTo(AIM_LIMITS.overheadCursorMax, 6);
  });

  it('converts between aim yaw and the ground cursor when switching views', () => {
    const aim = new AimState();
    aim.reset(Math.PI / 2);
    expect(aim.groundOffsetX).toBeCloseTo(AIM_LIMITS.overheadCursorDistance, 6);
    expect(aim.groundOffsetZ).toBeCloseTo(0, 6);
    aim.groundOffsetX = 0;
    aim.groundOffsetZ = 50;
    aim.pitch = 0.3;
    aim.syncAimFromGround();
    expect(aim.yaw).toBeCloseTo(Math.PI, 6);
    expect(aim.pitch).toBe(0);
  });
});
