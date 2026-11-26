/** The modifier state of a key press. */
export interface KeyModifiers {
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

/**
 * True for a key press that belongs to the browser or the operating system,
 * such as Ctrl+R or Cmd+F, rather than to the game. Shift is not counted: no
 * browser shortcut is Shift plus a key alone.
 */
export function isBrowserShortcut(e: KeyModifiers): boolean {
  return e.ctrlKey || e.metaKey || e.altKey;
}
