import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@grana/validation': path.resolve(__dirname, '../../packages/validation/src/index.ts'),
      '@grana/money-logic': path.resolve(__dirname, '../../packages/money-logic/src/index.ts'),
    },
  },
})
