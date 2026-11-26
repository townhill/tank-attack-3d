import { describe, expect, it } from 'vitest';
import { isBrowserShortcut } from '../src/input/shortcuts';

const key = (mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}): { ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean } => ({
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe('isBrowserShortcut', () => {
  it('lets a plain key press through to the game', () => {
    expect(isBrowserShortcut(key())).toBe(false);
  });

  it.each(['ctrlKey', 'metaKey', 'altKey'] as const)('leaves a press with %s held to the browser', (mod) => {
    expect(isBrowserShortcut(key({ [mod]: true }))).toBe(true);
  });

  it('treats Shift alone as a plain key press', () => {
    expect(isBrowserShortcut(key({ shiftKey: true }))).toBe(false);
  });
});
