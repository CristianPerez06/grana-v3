# mobile-app-shell Specification

## Purpose

Asegura las condiciones de base para que `apps/mobile` (Expo) pueda construir features sobre paquetes compartidos del workspace: arranque limpio de la app, resolución correcta de los paquetes `@grana/*` desde Metro sin un build step adicional, y type-check + lint pasando sin errores. No define features de producto; cada feature mobile se especifica dentro de la capability de su dominio (`auth`, `dashboard`, `onboarding`, etc.) con tags `(mobile)`.

## Requirements
### Requirement: La app mobile arranca correctamente

`apps/mobile` SHALL ser un proyecto Expo válido que arranque sin errores en el simulador de iOS o en un dispositivo Android. La pantalla raíz SHALL resolver el estado de sesión de Supabase y redirigir al usuario al área correspondiente — sin pasar por una pantalla placeholder.

La resolución inicial vive en `app/index.tsx`: se llama a `supabase.auth.getSession()` y se emite `<Redirect />` durante el render. El `app/_layout.tsx` raíz suscribe `supabase.auth.onAuthStateChange` y reacciona a `SIGNED_IN` / `SIGNED_OUT` redirigiendo a `(app)/dashboard` o `(auth)/login` respectivamente. Las rutas autenticadas viven bajo el grupo `(app)/`; las no autenticadas, bajo `(auth)/`.

Una vez aterrizado en `(app)/dashboard`, la pantalla SHALL renderizar el dashboard completo (las cuatro secciones definidas por la capability `dashboard`) y NO un placeholder de texto. La responsabilidad de implementar esa pantalla vive en la capability `dashboard`; el shell solo provee la ruta y el shell de tabs/menú a su alrededor.

#### Scenario: El dev server arranca desde la raíz del monorepo

- **WHEN** un desarrollador ejecuta `pnpm dev:mobile` desde la raíz del monorepo
- **THEN** el servidor de desarrollo de Expo arranca sin errores de resolución de módulos
- **AND** el QR code o la URL de dev client quedan disponibles en la terminal

#### Scenario: Arranque sin sesión activa lleva a login

- **WHEN** un usuario abre la app sin haber iniciado sesión nunca (o tras un `signOut`)
- **THEN** `app/index.tsx` resuelve `getSession()` con `null`
- **AND** la app aterriza en `(auth)/login` sin renderizar ninguna pantalla intermedia más allá del `ActivityIndicator` momentáneo

#### Scenario: Arranque con sesión activa lleva al dashboard renderizado

- **WHEN** un usuario abre la app con una sesión válida persistida en `expo-secure-store`
- **THEN** `app/index.tsx` resuelve `getSession()` con una sesión
- **AND** la app aterriza en `(app)/dashboard` con el dashboard renderizado (Hero, Lo que viene, Balance del mes, Tarjetas)
- **AND** la pantalla NO muestra el placeholder de texto "Dashboard"

### Requirement: El seam con los paquetes del workspace está preparado

`apps/mobile` SHALL tener Metro y TypeScript configurados de modo que cualquier importación futura de `@grana/*` resuelva correctamente, tanto en tiempo de compilación como en tiempo de ejecución, sin cambios adicionales de configuración.

#### Scenario: TypeScript resuelve los path aliases de @grana/*

- **WHEN** un desarrollador agrega `import type { Database } from '@grana/supabase'` en cualquier archivo de `apps/mobile`
- **THEN** `tsc --noEmit` no reporta errores de resolución de módulos para ese import

#### Scenario: Metro encuentra los paquetes del workspace

- **WHEN** el bundle de Metro se genera con al menos un import real de `@grana/*`
- **THEN** Metro resuelve el módulo sin `Unable to resolve module` ni errores de symlink

### Requirement: El proyecto pasa type-check y lint sin errores

`apps/mobile` SHALL pasar `tsc --noEmit` y ESLint sin errores en un checkout limpio. Esto asegura que el scaffold es una base sólida para trabajo futuro.

#### Scenario: Type-check limpio en checkout fresco

- **WHEN** un desarrollador ejecuta `pnpm --filter mobile typecheck` en un checkout limpio
- **THEN** TypeScript no reporta ningún error

#### Scenario: Lint limpio en checkout fresco

- **WHEN** un desarrollador ejecuta `pnpm --filter mobile lint` en un checkout limpio
- **THEN** ESLint no reporta ningún error ni warning que bloquee el build

