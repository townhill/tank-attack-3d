import { describe, expect, it } from 'vitest';
import { targetPixelRatio } from '../src/rendering/pixelRatio';

describe('targetPixelRatio', () => {
  it('uses the display ratio when it is under the cap', () => {
    expect(targetPixelRatio(1.25, 2)).toBe(1.25);
  });

  it('caps a dense display at the quality preset limit', () => {
    expect(targetPixelRatio(3, 1.5)).toBe(1.5);
  });

  it.each([undefined, 0, Number.NaN, -1])('falls back to 1 when the browser reports %j', (reported) => {
    expect(targetPixelRatio(reported, 2)).toBe(1);
  });
});
