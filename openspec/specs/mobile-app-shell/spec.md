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

### Requirement: El tab bar diferencia visualmente la acción de menú de las pestañas de navegación

`apps/mobile` SHALL renderizar el cuarto slot del tab bar (la acción de abrir el menú) con un treatment visual distinto a las pestañas de navegación primaria (Dashboard / Movimientos / Tarjetas):

- Las pestañas de navegación primaria SHALL renderizarse como hoy: ícono + label vertical, ocupando ancho equitativo dentro del tab bar.
- El slot de menú SHALL renderizarse como un botón circular sin label, claramente identificable como una acción (no como un destino navegable). El botón SHALL usar el color `--positive` (emerald) como fondo y un ícono blanco en su interior.
- El slot de menú SHALL mantenerse en la misma fila del tab bar (no ser un FAB flotante encima ni un botón en un header).
- El comportamiento funcional NO cambia: presionar el botón abre el `AppMenu` (bottom sheet modal), igual que hoy.

#### Scenario: El cuarto slot se ve como botón, no como pestaña

- **WHEN** un usuario abre la app y observa el tab bar inferior
- **THEN** los primeros tres slots (Dashboard, Movimientos, Tarjetas) muestran ícono + label vertical
- **AND** el cuarto slot muestra un botón circular con fondo emerald y un ícono blanco, sin label

#### Scenario: El botón de menú abre el AppMenu

- **WHEN** un usuario presiona el botón circular del cuarto slot
- **THEN** el `AppMenu` bottom sheet aparece desde la parte inferior de la pantalla

#### Scenario: Las pestañas de navegación mantienen su layout actual

- **WHEN** un usuario presiona "Movimientos" en el tab bar
- **THEN** la app navega a la pantalla de movimientos
- **AND** el ícono y label de "Movimientos" se muestran con el estado activo

### Requirement: El tab bar usa la paleta de marca leyendo desde tokens

El tab bar SHALL aplicar la paleta de tokens definida en `@grana/ui-tokens`. En particular:

- **Pestaña activa (ícono + label):** color `--positive` (emerald).
- **Pestaña inactiva (ícono + label):** color `text-soft`.
- **Surface del tab bar:** `bg-card`.
- **Borde superior del tab bar:** `border-border-soft`.
- **Esquinas superiores del tab bar:** levemente redondeadas (`rounded-t-xl`, ~12px) para que el tab bar se lea como una sheet flotante sobre el contenido.

Ningún color del tab bar SHALL estar hardcodeado como hex literal. Los colores SHALL venir de un módulo compartido (`apps/mobile/lib/colors.ts` o equivalente) que sirve como mirror JS de los tokens CSS hasta que exista un codegen automático.

Una pestaña activa SHALL mostrar un indicador visual adicional (pill o barra superior corta) en color `--positive` sobre o debajo del ícono, para reforzar la identificación del estado activo.

#### Scenario: La pestaña activa se identifica con emerald

- **WHEN** un usuario está en la pantalla de Dashboard
- **THEN** el ícono y label de "Dashboard" en el tab bar se muestran en color `--positive`
- **AND** un indicador (pill o barra corta) en color `--positive` aparece sobre o debajo del ícono activo
- **AND** las otras pestañas se muestran en color `text-soft`

#### Scenario: El tab bar no contiene literales de color hex

- **WHEN** un desarrollador inspecciona `apps/mobile/components/layout/TabBar.tsx`
- **THEN** no encuentra ningún valor `#RRGGBB` literal para colores de la paleta
- **AND** los colores se importan desde un módulo central (`apps/mobile/lib/colors.ts` o equivalente)

#### Scenario: El tab bar tiene esquinas superiores redondeadas

- **WHEN** un usuario observa el tab bar
- **THEN** las esquinas superiores del tab bar están redondeadas (~12px)
- **AND** las esquinas inferiores se mantienen rectas (el tab bar respeta el safe area inferior del dispositivo)

### Requirement: El AppMenu sheet aplica la paleta de marca

El componente `AppMenu` (bottom sheet modal abierto por el botón de menú) SHALL leer sus colores desde tokens (no literales hex). Al presionar un item del menú, el item SHALL mostrar un feedback visual breve con un tinte `--positive` translúcido como fondo activo, salvo el item destructivo "Salir" que SHALL mostrar un tinte `--error` translúcido.

El `Modal` que aloja al `AppMenu` SHALL configurarse con `statusBarTranslucent` y `navigationBarTranslucent` para que el overlay dim cubra la pantalla completa en Android (incluyendo status bar y nav bar del sistema).

#### Scenario: Press de un item muestra feedback emerald

- **WHEN** un usuario presiona el item "Mis tarjetas" en el `AppMenu`
- **THEN** el item muestra un fondo emerald translúcido durante el press

#### Scenario: Press del item Salir muestra feedback error

- **WHEN** un usuario presiona el item "Salir" en el `AppMenu`
- **THEN** el item muestra un fondo terracotta/error translúcido durante el press

#### Scenario: El overlay del menú cubre la pantalla completa en Android

- **WHEN** un usuario abre el `AppMenu` en un dispositivo Android
- **THEN** el dim del overlay se extiende detrás del status bar y la nav bar del sistema
- **AND** no queda ninguna franja del fondo de la app visible por encima ni por debajo del dim
