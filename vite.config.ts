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
        'src/rendering/CameraState.ts',
        'src/config/**',
      ],
      exclude: ['src/game/Game.ts', 'src/game/GameLoop.ts'],
      reporter: ['text', 'text-summary'],
    },
  },
});
