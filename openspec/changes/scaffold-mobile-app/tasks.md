## 1. Plomería del monorepo

- [x] 1.1 Agregar script `dev:mobile` al `package.json` raíz: `pnpm --filter mobile dev`
- [x] 1.2 Confirmar que el glob `apps/*` en `pnpm-workspace.yaml` ya cubre `apps/mobile` (sin cambios si es así)
- [x] 1.3 Revisar `.npmrc` por `public-hoist-pattern` — agregar entrada `*eslint*` si `eslint-config-expo` la requiere (mismo patrón que `eslint-config-next`)

## 2. Scaffold del proyecto Expo

- [x] 2.1 Ejecutar `pnpm create expo-app apps/mobile --template blank-typescript` (o equivalente) para generar el proyecto base
- [x] 2.2 Agregar dependencia `expo-router` y configurar el entry point en `package.json` (`main: expo-router/entry`)
- [x] 2.3 Setear `scheme` en `app.json` (por ejemplo `grana`) y configurar el plugin de `expo-router`

## 3. Configuración de TypeScript

- [x] 3.1 Reemplazar el `tsconfig.json` generado por uno que extienda `../../tsconfig.base.json` (strict) y `expo/tsconfig.base`
- [x] 3.2 Agregar override de `paths` para `@grana/*` apuntando a `../../packages/*/src/index.ts` (espeja `tsconfig.base.json`)
- [x] 3.3 Ejecutar `pnpm --filter mobile typecheck` y confirmar cero errores

## 4. Configuración de Metro

- [x] 4.1 Crear `metro.config.js` en `apps/mobile` usando `getDefaultConfig` de `expo/metro-config`
- [x] 4.2 Setear `watchFolders` para incluir la raíz del monorepo (para que Metro observe `packages/*`)
- [x] 4.3 Setear `resolver.nodeModulesPaths` para incluir el `node_modules` raíz
- [x] 4.4 Verificar que Metro arranca sin errores de symlinks ni de resolución (`pnpm dev:mobile`)

## 5. Configuración de ESLint

- [x] 5.1 Agregar `eslint.config.mjs` (o `.eslintrc.js`) extendiendo `eslint-config-expo`
- [x] 5.2 Ejecutar `pnpm --filter mobile lint` y confirmar cero errores

## 6. Pantalla de placeholder

- [x] 6.1 Crear `apps/mobile/app/index.tsx` con una pantalla raíz que muestre `<Text>Grana mobile</Text>`
- [x] 6.2 Crear `apps/mobile/app/_layout.tsx` como el layout raíz de Expo Router (Stack)
- [x] 6.3 Abrir la app en el simulador de iOS (o Expo Go) y confirmar que la pantalla de placeholder renderiza sin errores de consola

## 7. Validación del seam

- [x] 7.1 Agregar un import de solo tipos desde `@grana/supabase` en cualquier archivo (por ejemplo `import type { Database } from '@grana/supabase'`) y confirmar que `tsc --noEmit` sigue pasando
- [x] 7.2 Confirmar que Metro resuelve el módulo sin `Unable to resolve module`
- [x] 7.3 Eliminar o conservar el import según corresponda — el objetivo es probar que la resolución de Metro + TS funciona antes de iniciar el trabajo de auth
