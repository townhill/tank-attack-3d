/**
 * The pixel ratio to render at: the display's own ratio as the browser
 * `reported` it, limited to `cap`. A missing or nonsensical report counts as 1.
 */
export function targetPixelRatio(reported: number | undefined, cap: number): number {
  const ratio = reported !== undefined && Number.isFinite(reported) && reported > 0 ? reported : 1;
  return Math.min(ratio, cap);
}
