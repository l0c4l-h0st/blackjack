/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    testTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/engine/**/*.ts', 'src/config/**/*.ts'],
      exclude: ['src/engine/**/index.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: {
        'src/engine/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
      },
    },
  },
});
