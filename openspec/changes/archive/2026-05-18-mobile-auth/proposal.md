## Por qué

`apps/mobile` tiene scaffold funcional pero ningún usuario puede ingresar a la app. Este change conecta el cliente Supabase, configura NativeWind con los tokens del design system y construye el flujo mínimo: login → dashboard vacío con logout. Es el primer change real de producto en mobile y establece las bases (estilos, sesión, navegación protegida) sobre las que se construirán todas las pantallas siguientes.

## Qué cambia

- Agregar codegen en `packages/ui-tokens`: script Node que parsea `theme.css` y emite `tokens.cjs` consumible por Tailwind v3
- Configurar NativeWind v4 + Tailwind v3 en `apps/mobile` (babel, metro, global.css, tailwind.config.js) consumiendo `tokens.cjs`
- Agregar `apps/mobile/.env` con `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Expo SDK 49+ los inlinea en build; no es necesario migrar a `app.config.js`)
- Crear `apps/mobile/lib/supabase.ts` usando `expo-secure-store` para persistencia de sesión
- Reestructurar `apps/mobile/app/` en grupos `(auth)/` y `(app)/`; `app/index.tsx` resuelve la sesión inicial y redirige via `<Redirect />`, mientras que `_layout.tsx` raíz reacciona a `SIGNED_IN`/`SIGNED_OUT`
- Tres componentes UI reutilizables: `Button`, `TextInput`, `FormError`
- Pantalla `(auth)/login.tsx`: email + contraseña → `signInWithPassword`
- Pantalla `(app)/dashboard.tsx`: texto placeholder + botón logout

## Capabilities

### Capabilities modificadas

- `auth`: se agregan escenarios `(mobile)` a los requirements de login y logout existentes (que pasan a etiquetarse `(web)`) — el usuario puede ingresar con email y contraseña en la app mobile, su sesión persiste de forma segura entre reinicios via SecureStore, y puede cerrar sesión desde el dashboard. Login es una misma capability de negocio, no una nueva — la divergencia es solo de implementación por plataforma.
- `mobile-app-shell` (de `scaffold-mobile-app`): la pantalla raíz placeholder se reemplaza por un guard de sesión que redirige a `(auth)/login` o `(app)/dashboard` según el estado de la sesión de Supabase.

## Fuera de scope

- Signup, forgot-password, reset-password — dependen de deep links sin resolver
- Dark mode toggle en UI (tokens dark configurados, sin switch de usuario)
- Componentes UI adicionales más allá de los necesarios para login/dashboard
- EAS, OTA updates, push notifications
