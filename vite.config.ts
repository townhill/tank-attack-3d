import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: [
        'src/ai/**',
        'src/combat/**',
        'src/entities/**',
        'src/game/**',
        'src/world/**',
        'src/utils/**',
        'src/ui/MapProjection.ts',
        'src/ui/tacticalData.ts',
        'src/audio/audioMath.ts',
        'src/rendering/CameraState.ts',
        'src/rendering/bridgeDetail.ts',
        'src/rendering/waterDetail.ts',
        'src/config/**',
      ],
      // DOM/WebGL orchestration is verified by browser smoke tests instead of unit tests.
      exclude: ['src/game/Game.ts', 'src/game/HudPresenter.ts'],
      reporter: ['text', 'text-summary'],
    },
  },
});
