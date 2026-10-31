import { describe, expect, it } from 'vitest';
import { QUALITY_LEVELS } from '../src/config/userSettings';
import { reflectsLakes, WATER_DETAIL, waterShaderDefines } from '../src/rendering/waterDetail';

describe('WATER_DETAIL', () => {
  it('draws a flat tinted surface at low quality, adds ripples at medium and the grazing sheen and lake reflections at high', () => {
    expect(WATER_DETAIL.low).toEqual({ ripples: false, sheen: false, reflections: false });
    expect(WATER_DETAIL.medium).toEqual({ ripples: true, sheen: false, reflections: false });
    expect(WATER_DETAIL.high).toEqual({ ripples: true, sheen: true, reflections: true });
  });

  it('only ever adds features as quality rises', () => {
    for (let k = 1; k < QUALITY_LEVELS.length; k++) {
      const lower = WATER_DETAIL[QUALITY_LEVELS[k - 1]!];
      const higher = WATER_DETAIL[QUALITY_LEVELS[k]!];
      if (lower.ripples) expect(higher.ripples).toBe(true);
      if (lower.sheen) expect(higher.sheen).toBe(true);
      if (lower.reflections) expect(higher.reflections).toBe(true);
    }
  });
});

describe('waterShaderDefines', () => {
  it('compiles in only the features the quality level draws', () => {
    expect(waterShaderDefines('low')).toEqual({});
    expect(waterShaderDefines('medium')).toEqual({ VT_WATER_RIPPLES: '' });
    expect(waterShaderDefines('high')).toEqual({ VT_WATER_RIPPLES: '', VT_WATER_SHEEN: '' });
  });

  it('compiles in the lake reflection only when asked for and the quality level draws it', () => {
    expect(waterShaderDefines('high', true)).toEqual({ VT_WATER_RIPPLES: '', VT_WATER_SHEEN: '', VT_WATER_REFLECT: '' });
    expect(waterShaderDefines('high', false)).toEqual({ VT_WATER_RIPPLES: '', VT_WATER_SHEEN: '' });
    expect(waterShaderDefines('medium', true)).toEqual({ VT_WATER_RIPPLES: '' });
  });

  it('hands out a fresh object each time, so a material can keep it without sharing', () => {
    expect(waterShaderDefines('high')).not.toBe(waterShaderDefines('high'));
  });
});

describe('reflectsLakes', () => {
  it('mirrors lakes only at high quality, in a mode that gives reflections strength, until auto-quality turns them off', () => {
    expect(reflectsLakes('high', 0.5, true)).toBe(true);
    expect(reflectsLakes('medium', 0.5, true)).toBe(false);
    expect(reflectsLakes('low', 0.5, true)).toBe(false);
    expect(reflectsLakes('high', 0, true)).toBe(false);
    expect(reflectsLakes('high', 0.5, false)).toBe(false);
  });
});
