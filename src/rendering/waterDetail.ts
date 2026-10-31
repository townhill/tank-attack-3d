/**
 * How much of the water shader each quality level draws. The ripples cost
 * three sines and two screen-space derivatives per water pixel and the
 * grazing sheen a power, so lower levels compile them out entirely and keep
 * only the depth tint and the glow along the shallows.
 */
import type { QualityLevel } from '../config/userSettings';

export interface WaterDetail {
  /** Ripple lines drifting with each river's flow. */
  readonly ripples: boolean;
  /** Brightening of the surface seen at grazing angles. */
  readonly sheen: boolean;
}

export const WATER_DETAIL: Readonly<Record<QualityLevel, WaterDetail>> = {
  low: { ripples: false, sheen: false },
  medium: { ripples: true, sheen: false },
  high: { ripples: true, sheen: true },
};

/** Names of the preprocessor switches the water shader tests with #ifdef. */
export const RIPPLES_DEFINE = 'VT_WATER_RIPPLES';
export const SHEEN_DEFINE = 'VT_WATER_SHEEN';

/** Preprocessor defines that switch the water shader's optional features on for `quality`. */
export function waterShaderDefines(quality: QualityLevel): Record<string, string> {
  const detail = WATER_DETAIL[quality];
  const defines: Record<string, string> = {};
  if (detail.ripples) defines[RIPPLES_DEFINE] = '';
  if (detail.sheen) defines[SHEEN_DEFINE] = '';
  return defines;
}
