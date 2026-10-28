import './styles.css';
import { Game } from './game/Game';

function showFatal(root: HTMLElement, message: string): void {
  const box = document.createElement('div');
  box.className = 'fatal';
  box.setAttribute('role', 'alert');
  box.textContent = message;
  root.appendChild(box);
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root element');

if (!webglAvailable()) {
  showFatal(root, 'VECTOR TANKS needs WebGL 2. Please use an up-to-date Chrome, Firefox, Edge or Safari with hardware acceleration enabled.');
} else {
  try {
    const game = new Game(root);
    game.start();
    if (import.meta.env.DEV) {
      // Exposed for automated smoke testing during development only.
      (window as unknown as { __vt: Game }).__vt = game;
    }
  } catch (error) {
    console.error('Failed to start VECTOR TANKS', error);
    showFatal(root, 'VECTOR TANKS failed to start. See the browser console for details.');
  }
}
