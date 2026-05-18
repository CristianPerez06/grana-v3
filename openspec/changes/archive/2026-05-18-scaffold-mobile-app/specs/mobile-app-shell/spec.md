## ADDED Requirements

### Requirement: La app mobile arranca correctamente

`apps/mobile` SHALL ser un proyecto Expo válido que arranque sin errores en el simulador de iOS o en un dispositivo Android. La pantalla raíz SHALL mostrar un texto de placeholder que confirme que el entorno funciona.

#### Scenario: El dev server arranca desde la raíz del monorepo

- **WHEN** un desarrollador ejecuta `pnpm dev:mobile` desde la raíz del monorepo
- **THEN** el servidor de desarrollo de Expo arranca sin errores de resolución de módulos
- **AND** el QR code o la URL de dev client quedan disponibles en la terminal

#### Scenario: La pantalla raíz renderiza el placeholder

- **WHEN** un desarrollador abre la app en un simulador o dispositivo
- **THEN** la pantalla raíz muestra un texto de placeholder (por ejemplo "Grana mobile")
- **AND** no hay errores en la consola de Metro ni en la del dispositivo

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
