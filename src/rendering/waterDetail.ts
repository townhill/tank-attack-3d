/**
 * How much of the water shader each quality level draws. The ripples cost
 * three sines and two screen-space derivatives per water pixel, the grazing
 * sheen a power and the lake reflection a second render of the scene, so
 * lower levels compile them out entirely and keep only the depth tint and
 * the glow along the shallows.
 */
import type { QualityLevel } from '../config/userSettings';

export interface WaterDetail {
  /** Ripple lines drifting with each river's flow. */
  readonly ripples: boolean;
  /** Brightening of the surface seen at grazing angles. */
  readonly sheen: boolean;
  /** Mirror reflection on the nearest lake in view. */
  readonly reflections: boolean;
}

export const WATER_DETAIL: Readonly<Record<QualityLevel, WaterDetail>> = {
  low: { ripples: false, sheen: false, reflections: false },
  medium: { ripples: true, sheen: false, reflections: false },
  high: { ripples: true, sheen: true, reflections: true },
};

/** Names of the preprocessor switches the water shader tests with #ifdef. */
export const RIPPLES_DEFINE = 'VT_WATER_RIPPLES';
export const SHEEN_DEFINE = 'VT_WATER_SHEEN';
export const REFLECT_DEFINE = 'VT_WATER_REFLECT';

/**
 * True when lakes are mirrored: `quality` draws reflections, the graphics
 * mode gives them a `strength` above zero and automatic quality reduction
 * has not turned them off (`allowed`).
 */
export function reflectsLakes(quality: QualityLevel, strength: number, allowed: boolean): boolean {
  return WATER_DETAIL[quality].reflections && strength > 0 && allowed;
}

/**
 * Preprocessor defines that switch the water shader's optional features on
 * for `quality`; `reflect` adds the lake reflection where the level draws it.
 */
export function waterShaderDefines(quality: QualityLevel, reflect = false): Record<string, string> {
  const detail = WATER_DETAIL[quality];
  const defines: Record<string, string> = {};
  if (detail.ripples) defines[RIPPLES_DEFINE] = '';
  if (detail.sheen) defines[SHEEN_DEFINE] = '';
  if (reflect && detail.reflections) defines[REFLECT_DEFINE] = '';
  return defines;
}
