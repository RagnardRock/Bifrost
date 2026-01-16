import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    include: ['packages/*/src/**/*.{test,spec}.ts', 'packages/*/tests/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['packages/server/src/tests/setup.ts'],
    environmentMatchGlobs: [
      ['packages/client/**', 'happy-dom'],
      ['packages/server/**', 'node'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.config.*',
        '**/tests/setup.ts',
        '**/prisma/**',
      ],
    },
    alias: {
      '@bifrost/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@': path.resolve(__dirname, 'packages/client/src'),
    },
  },
})
