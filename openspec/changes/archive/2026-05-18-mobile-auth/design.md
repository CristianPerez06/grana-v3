## Contexto

`apps/mobile` corre Expo SDK 54, React Native 0.81.5, New Architecture habilitada (`newArchEnabled: true`). El monorepo tiene `packages/ui-tokens` que expone `theme.css` (Tailwind v4, CSS vars). `apps/web` usa Tailwind v4 directamente. Mobile necesita NativeWind v4, que internamente usa Tailwind v3 — los dos son bundles separados, no hay conflicto.

## Decisiones

### 1. Codegen de tokens: script Node con regex

`packages/ui-tokens` agrega un script `scripts/codegen.mjs` que parsea `theme.css` con regex y emite `src/tokens.cjs`. Extrae los valores de `:root` (light) y `.dark` (dark) y los exporta como objeto JS consumible por `tailwind.config.js`.

**Formato de salida:**
```js
module.exports = {
  colors: {
    background: { DEFAULT: '#ffffff', dark: '#0a0a0a' },
    foreground: { DEFAULT: '#171717', dark: '#ededed' },
    // ...
  }
}
```

El script se ejecuta con `node scripts/codegen.mjs` y su output se commitea (`src/tokens.cjs`). No hay build step continuo — se re-ejecuta cada vez que `theme.css` cambia.

`package.json` de `@grana/ui-tokens` agrega:
- `"scripts": { "codegen": "node scripts/codegen.mjs" }`
- `"exports": { "./theme.css": "./src/theme.css", "./tokens": "./src/tokens.cjs" }`

**Alternativa descartada**: postcss parser. Más robusto pero más dependencias. El CSS de `theme.css` es controlado por nosotros y tiene formato predecible — regex alcanza.

### 2. NativeWind v4 setup

Dependencias:
```
nativewind          (runtime)
tailwindcss@^3      (devDependency — v3, no v4)
```

Archivos nuevos/modificados en `apps/mobile`:
- `global.css`: `@tailwind base; @tailwind components; @tailwind utilities;`
- `tailwind.config.js`: extiende tokens de `@grana/ui-tokens/tokens`; content apunta a `./app/**/*.tsx` y `./components/**/*.tsx`
- `babel.config.js` (nuevo): `nativewind/babel` se carga **como preset** (no como plugin); el config final es `presets: ['babel-preset-expo', 'nativewind/babel']`. `nativewind/babel` exporta un preset (devuelve `{ plugins: [...] }`); colocarlo en `plugins` rompe con `.plugins is not a valid Plugin property`.
- `metro.config.js`: wrappear config existente con `withNativeWind(config, { input: './global.css' })` de `nativewind/metro` (atención al casing: `withNativeWind`, no `withNativewind`).
- `app/_layout.tsx`: importa `'../global.css'` una sola vez para que NativeWind procese los estilos.
- `nativewind-env.d.ts` y `global.d.ts`: declaraciones de tipos para registrar `className` en componentes de `react-native` y declarar `process.env.EXPO_PUBLIC_*` sin necesidad de `@types/node`.

**Peer deps que NativeWind no resuelve solo en pnpm + RN**: `react-native-css-interop` es dep transitiva de `nativewind` y vive en el store de pnpm, pero Metro no la encuentra a través del symlink. Hay que instalarla **directa** en `apps/mobile` (`pnpm --filter mobile add react-native-css-interop`) para que pnpm la enlace al `node_modules` local.

**New Architecture**: NativeWind v4.1+ soporta New Architecture. Expo SDK 54 ya la tiene habilitada; no se requiere configuración adicional.

### 3. Variables de entorno

Expo SDK 49+ inline automáticamente variables con prefijo `EXPO_PUBLIC_` en tiempo de build. No se necesita `app.config.js` con `extra`.

`apps/mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

El usuario completa los valores (son los mismos que en `apps/web/.env`). El archivo se agrega a `.gitignore`.

`app.json` se mantiene como `app.json` — no es necesario migrar a `app.config.js` para este caso.

### 4. Supabase client en mobile

`apps/mobile/lib/supabase.ts` crea el cliente una sola vez (singleton) usando `@grana/supabase`'s `createClient` con un adapter de `expo-secure-store`. La primera línea del módulo importa `react-native-url-polyfill/auto` — `@supabase/supabase-js` usa `new URL(...)` internamente y, sin el polyfill, el constructor del cliente lanza durante el carga del bundle, dejando la splash screen pegada sin error visible.

```ts
import 'react-native-url-polyfill/auto'

import * as SecureStore from 'expo-secure-store'
import { createClient } from '@grana/supabase'

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storage: ExpoSecureStoreAdapter, autoRefreshToken: true, detectSessionInUrl: false } },
)
```

### 5. Estructura de rutas y guard de sesión

```
apps/mobile/app/
  _layout.tsx          ← root layout: importa global.css, reacciona a SIGNED_IN/SIGNED_OUT
  index.tsx            ← resuelve la sesión inicial y emite <Redirect /> a (auth)/login o (app)/dashboard
  (auth)/
    _layout.tsx        ← layout sin tab bar (Stack simple)
    login.tsx
  (app)/
    _layout.tsx        ← layout autenticado (Stack simple por ahora)
    dashboard.tsx
```

**Por qué `index.tsx` existe** (no se elimina como decía el plan original): cuando el root `_layout.tsx` se monta por primera vez, `<Slot />` necesita una ruta matcheada para renderizar. Si la redirección inicial se intenta imperativamente con `router.replace()` dentro de `useEffect`, el efecto corre después del primer render y Expo Router muestra su pantalla de unmatched-route (que se confunde con la splash). La solución estable es declararla con `<Redirect />` durante el render de `index.tsx`, que sí ocurre en tiempo de render.

`app/index.tsx`:
- Llama `supabase.auth.getSession()` en `useEffect`.
- Mientras no resuelve, renderiza un `ActivityIndicator` (esto monta una ruta válida y dispara la auto-ocultación de la splash de Expo Router).
- Cuando resuelve, retorna `<Redirect href={session ? '/(app)/dashboard' : '/(auth)/login'} />`.

`app/_layout.tsx`:
- Importa `'../global.css'`.
- Renderiza siempre `<Slot />` (sin condicionales) y suscribe `supabase.auth.onAuthStateChange`.
- Solo reacciona a eventos `SIGNED_IN` (→ `(app)/dashboard`) y `SIGNED_OUT` (→ `(auth)/login`). La resolución inicial es responsabilidad de `index.tsx`.

**Por qué no un Context/Provider global**: para este scope (2 pantallas) los dos puntos directos (`index.tsx` para el bootstrap, `_layout.tsx` para los eventos) alcanzan. Cuando la app crezca, promover a un `AuthProvider` en un change dedicado.

### 6. Componentes UI

Tres componentes en `apps/mobile/components/ui/`:

**`Button.tsx`**
- Props: `title`, `onPress`, `loading?`, `variant?: 'primary' | 'ghost'`
- Primary: fondo `bg-primary`, texto `text-primary-foreground`
- Ghost: sin fondo, texto `text-primary`
- Loading: muestra `ActivityIndicator` en lugar del título, desactiva el botón

**`TextInput.tsx`**
- Props: `label`, `value`, `onChangeText`, `error?`, `secureTextEntry?`, + resto de `TextInputProps`
- Label arriba, input, mensaje de error abajo en `text-destructive`
- Borde `border-input`, foco en `border-primary` (via state local)
- No implementa show/hide toggle para contraseña en este change — secureTextEntry pasado directo

**`FormError.tsx`**
- Props: `message: string | null`
- Renderiza `null` si no hay mensaje
- Texto `text-destructive`, margen superior

### 7. Pantallas

**`(auth)/login.tsx`**
- Estado local: `email`, `password`, `loading`, `error`
- Submit: llama `supabase.auth.signInWithPassword({ email, password })`
- Éxito: el `onAuthStateChange` en root layout detecta `SIGNED_IN` y redirige — no se necesita `router.push` manual
- Error: muestra el mensaje raw de Supabase en `<FormError />`. Cuando aterrice i18n en mobile, este punto migra a `mapSupabaseError(error, t)` (helper ya existente en `apps/web/lib/supabase/errors.ts`, que se promoverá a `@grana/supabase` en ese momento).
- No usa `@grana/validation` en este change — validación mínima inline (campos no vacíos)

**`(app)/dashboard.tsx`**
- Texto "Dashboard" centrado
- Botón "Cerrar sesión" que llama `supabase.auth.signOut()`
- El `onAuthStateChange` en root layout detecta `SIGNED_OUT` y redirige a login

## Riesgos

- **NativeWind + New Architecture en Expo SDK 54**: combinación reciente. Si hay incompatibilidad, el fallback es desactivar New Architecture temporalmente (`newArchEnabled: false`) hasta que NativeWind la soporte completamente.
- **Metro + NativeWind + workspace**: `withNativeWind` modifica el Metro config existente. Hay que asegurarse de que el wrapping no rompa las rutas de resolución del workspace configuradas en el scaffold.
- **`expo-secure-store` key length**: SecureStore limita las keys a 256 caracteres en iOS. Supabase usa keys largas para tokens — verificar en runtime durante testing.
