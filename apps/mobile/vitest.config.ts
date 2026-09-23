import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Nativo no tenía tests, y eso no era neutral: los dos defectos que la revisión
 * del 18-09 encontró —un rechazo que mostraba «algo salió mal» y un saldo que
 * quedaba viejo después de registrar un pago— viven los dos en el pegamento de
 * esta app, que es justo lo que ningún test del monorepo podía mirar.
 *
 * Entorno `node` y sólo `lib/`: acá se prueban los módulos puros (mutators,
 * invalidación, formateo). Renderizar pantallas de React Native pide un runtime
 * que este arnés deliberadamente no trae.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Ver el comentario del stub: `react-native` se publica en Flow y no
      // parsea fuera de Metro, y `expo-secure-store` lo arrastra.
      'expo-secure-store': path.resolve(__dirname, 'test/stubs/expo-secure-store.ts'),
      '@grana/i18n-messages': path.resolve(__dirname, '../../packages/i18n-messages/src/index.ts'),
      '@grana/money-logic': path.resolve(__dirname, '../../packages/money-logic/src/index.ts'),
      '@grana/recurrences': path.resolve(__dirname, '../../packages/recurrences/src/index.ts'),
      '@grana/validation': path.resolve(__dirname, '../../packages/validation/src/index.ts'),
    },
  },
})
