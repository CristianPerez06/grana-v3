import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/__tests__/**/*.test.ts'],
    // Las suites de migración arrancan un Postgres real compilado a WASM en un
    // `beforeAll`, y eso son segundos de arranque, no milisegundos. Con cuatro
    // suites de esas compitiendo por CPU el arranque más lento ya rozaba el
    // límite por defecto de 10s del hook — un fallo que no dice "Postgres tardó"
    // sino que señala un test que no tiene nada malo, y que entrena a la gente a
    // volver a correr CI en vez de leerlo.
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@grana/dashboard': path.resolve(__dirname, '../../packages/dashboard/src/index.ts'),
      '@grana/savings': path.resolve(__dirname, '../../packages/savings/src/index.ts'),
      '@grana/i18n-messages': path.resolve(__dirname, '../../packages/i18n-messages/src/index.ts'),
      '@grana/validation': path.resolve(__dirname, '../../packages/validation/src/index.ts'),
      '@grana/money-logic': path.resolve(__dirname, '../../packages/money-logic/src/index.ts'),
      '@grana/ui-contracts': path.resolve(__dirname, '../../packages/ui-contracts/src/index.ts'),
    },
  },
})
