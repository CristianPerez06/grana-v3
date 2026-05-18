## 1. Codegen de tokens en `@grana/ui-tokens`

- [x] 1.1 Crear `packages/ui-tokens/scripts/codegen.mjs`: parsear `src/theme.css` con regex, extraer valores de `:root` (light) y `.dark` (dark), emitir `src/tokens.cjs`
- [x] 1.2 Agregar script `"codegen": "node scripts/codegen.mjs"` al `package.json` de `@grana/ui-tokens`
- [x] 1.3 Agregar export `"./tokens": "./src/tokens.cjs"` al campo `exports` de `package.json`
- [x] 1.4 Ejecutar `pnpm --filter @grana/ui-tokens codegen` y confirmar que `src/tokens.cjs` tiene todos los colores del design system
- [x] 1.5 Commitear `src/tokens.cjs` (es un artefacto generado que se trackea en git para que mobile no necesite el build step en CI)

## 2. NativeWind setup en `apps/mobile`

- [x] 2.1 Instalar dependencias: `pnpm --filter mobile add nativewind` y `pnpm --filter mobile add -D tailwindcss@^3`
- [x] 2.2 Crear `apps/mobile/tailwind.config.js`: content apuntando a `./app/**/*.tsx` y `./components/**/*.tsx`; theme.extend.colors consumiendo `require('@grana/ui-tokens/tokens').colors`
- [x] 2.3 Crear `apps/mobile/global.css` con las tres directivas `@tailwind base/components/utilities`
- [x] 2.4 Crear `apps/mobile/babel.config.js` con `babel-preset-expo` como preset y `nativewind/babel` como plugin
- [x] 2.5 Actualizar `apps/mobile/metro.config.js`: wrappear la config existente con `withNativewind({ input: './global.css' })` de `nativewind/metro`
- [x] 2.6 Importar `'../global.css'` (o `'./global.css'`) en `apps/mobile/app/_layout.tsx`
- [x] 2.7 Verificar que `pnpm dev:mobile` arranca sin errores de NativeWind; probar una clase Tailwind simple (`className="bg-primary"`) en la pantalla placeholder

## 3. Variables de entorno y cliente Supabase

- [x] 3.1 Crear `apps/mobile/.env` con `EXPO_PUBLIC_SUPABASE_URL=` y `EXPO_PUBLIC_SUPABASE_ANON_KEY=` (valores vacíos); agregar `apps/mobile/.env` a `.gitignore` raíz si no está ya
- [x] 3.2 Documentar en `apps/mobile/.env.example` las dos variables requeridas (sin valores)
- [x] 3.3 Instalar `expo-secure-store`: `pnpm --filter mobile add expo-secure-store`
- [x] 3.4 Crear `apps/mobile/lib/supabase.ts` con el singleton usando el adapter de SecureStore (ver design.md § 4)
- [x] 3.5 Confirmar que `pnpm --filter mobile typecheck` sigue en cero errores

## 4. Estructura de rutas y guard de sesión

- [x] 4.1 Eliminar `apps/mobile/app/index.tsx` (placeholder)
- [x] 4.2 Crear `apps/mobile/app/(auth)/` y `apps/mobile/app/(app)/` como grupos de rutas
- [x] 4.3 Reemplazar `apps/mobile/app/_layout.tsx`: importar `global.css`, escuchar `onAuthStateChange`, mostrar `ActivityIndicator` mientras carga, redirigir según sesión
- [x] 4.4 Crear `apps/mobile/app/(auth)/_layout.tsx`: Stack simple, sin header customizado por ahora
- [x] 4.5 Crear `apps/mobile/app/(app)/_layout.tsx`: Stack simple, sin tab bar por ahora
- [x] 4.6 Verificar en simulador que arrancar la app sin sesión lleva a login; con sesión activa lleva a dashboard

## 5. Componentes UI

- [x] 5.1 Crear `apps/mobile/components/ui/Button.tsx` (ver design.md § 6)
- [x] 5.2 Crear `apps/mobile/components/ui/TextInput.tsx` (ver design.md § 6)
- [x] 5.3 Crear `apps/mobile/components/ui/FormError.tsx` (ver design.md § 6)
- [x] 5.4 Confirmar que los tres componentes typecheckean sin errores

## 6. Pantallas

- [x] 6.1 Crear `apps/mobile/app/(auth)/login.tsx` con los campos email y contraseña, submit a `supabase.auth.signInWithPassword`, error handling via `<FormError />`
- [x] 6.2 Crear `apps/mobile/app/(app)/dashboard.tsx` con texto placeholder y botón "Cerrar sesión" que llama `supabase.auth.signOut()`

## 7. Validación end-to-end

- [x] 7.1 Flujo feliz: login con credenciales válidas → llega a dashboard
- [x] 7.2 Error: credenciales inválidas → aparece mensaje de error en pantalla
- [x] 7.3 Logout: botón en dashboard → vuelve a login
- [x] 7.4 Persistencia: cerrar y reabrir la app con sesión activa → va directo a dashboard sin pedir login
- [x] 7.5 `pnpm --filter mobile typecheck` en cero errores
- [x] 7.6 `pnpm --filter mobile lint` en cero errores
