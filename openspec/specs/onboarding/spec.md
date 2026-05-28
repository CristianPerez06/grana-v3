# onboarding Specification

## Purpose

Define el wizard post-signup que toma a un usuario recién registrado y lo lleva a un estado inicial coherente del producto antes de aterrizar en el dashboard. Cubre tres pantallas (`welcome`, `initial-balance`, `done`) con persistencia por paso (el progreso vive en la base, no en estado de cliente), captura el saldo inicial del usuario sobre su `Billetera`, y termina marcando `profiles.onboarding_completed_at`. El wizard no permite saltar pasos intermedios y se ofrece como espejo funcional en web (Server Components + server actions) y mobile (Expo + llamadas directas a Supabase).

## Requirements

### Requirement: El wizard de onboarding tiene tres pantallas con persistencia por paso

El sistema SHALL exponer el onboarding post-signup como tres pantallas separadas (`welcome`, `initial-balance`, `done`) bajo un route group dedicado al wizard. Cada pantalla SHALL persistir su cambio inmediatamente al servidor antes de avanzar (server action en web, llamada directa a Supabase en mobile). El sistema SHALL NOT mantener el estado del wizard en memoria del cliente entre pantallas: si el usuario refresca o cierra la app, el progreso queda guardado en la base de datos y el wizard reanuda donde corresponda. El gate de reanudación se basa en `onboarding_completed_at IS NULL` (no en el modo, que ya no existe).

#### Scenario: Usuario refresca la pantalla a mitad del wizard (web)

- **WHEN** un usuario está en `/onboarding/initial-balance` y refresca el navegador
- **THEN** el sistema mantiene el estado persistido y permite completar `/initial-balance`

#### Scenario: Usuario cierra el navegador y vuelve días después (web)

- **WHEN** un usuario llega a `/welcome`, cierra el navegador, y vuelve a entrar cinco días después
- **THEN** el middleware detecta `onboarding_completed_at IS NULL` y lo redirige a `/onboarding/welcome`

#### Scenario: Usuario mata la app a mitad del wizard (mobile)

- **WHEN** un usuario está en `(onboarding)/initial-balance` en mobile, mata la app y la reabre
- **THEN** el splash gate detecta `onboarding_completed_at IS NULL` y lo redirige a `(onboarding)/welcome`

### Requirement: La pantalla de welcome muestra una bienvenida sin inputs

El sistema SHALL renderizar la pantalla de welcome con un mensaje de bienvenida personalizado (incluyendo `profiles.full_name`), una descripción corta de lo que sigue, y un único CTA "Empezar" que navega a la pantalla de saldo inicial. La pantalla SHALL NOT pedir ningún input ni persistir nada en la base.

#### Scenario: Pantalla de welcome carga sin acciones laterales (web)

- **WHEN** un usuario autenticado con `onboarding_completed_at IS NULL` navega a `/onboarding/welcome`
- **THEN** la pantalla renderiza el copy de bienvenida con su `full_name`
- **AND** el único elemento accionable es un botón "Empezar" que navega a `/onboarding/initial-balance`
- **AND** no se modifica ningún registro en `profiles`, `accounts` ni otras tablas

#### Scenario: Pantalla de welcome carga sin acciones laterales (mobile)

- **WHEN** un usuario autenticado con `onboarding_completed_at IS NULL` aterriza en `(onboarding)/welcome`
- **THEN** la pantalla renderiza el copy de bienvenida con su `full_name`
- **AND** el único elemento accionable es un botón "Empezar" que dispara `router.push('/(onboarding)/initial-balance')`

### Requirement: La pantalla de saldo actual impacta initial_balance, no crea transacciones

El sistema SHALL renderizar la pantalla de saldo actual con dos inputs (uno ARS, uno USD) bajo la pregunta literal "¿Cuánta plata tenés hoy?" (ver `project-conventions/Bimoneda por defecto`). La UI NO SHALL mencionar la palabra "Billetera" ni el concepto "cuenta". Al avanzar, el sistema SHALL UPDATE el campo `account_currencies.initial_balance` de la `Billetera` para cada par (moneda) con monto > 0. El sistema SHALL NOT insertar filas en `transactions`. Los inputs vacíos o iguales a cero NO SHALL modificar el `initial_balance` existente. El monto en pesos (ARS) del grupo principal es obligatorio (puede ser 0).

#### Scenario: Usuario ingresa solo ARS y avanza (web)

- **WHEN** un usuario ingresa `100000` en el input ARS, deja USD vacío, y hace clic en "Continuar"
- **THEN** el sistema UPDATE `account_currencies.initial_balance=100000` para la `Billetera`, fila ARS
- **AND** la fila USD queda con `initial_balance=0` (sin cambios)
- **AND** NO se inserta ninguna fila en `transactions`
- **AND** redirige a `/onboarding/done`

#### Scenario: El monto cero es una declaración válida del ARS (web)

- **WHEN** un usuario carga `0` en el input ARS y hace clic en "Continuar"
- **THEN** el formulario acepta el valor y avanza a `/done`
- **AND** `account_currencies.initial_balance` queda en `0` para la fila ARS de la `Billetera`

#### Scenario: Usuario ingresa solo ARS y avanza (mobile)

- **WHEN** un usuario ingresa `100000` en el `TextInput` ARS, deja USD vacío, y presiona "Continuar"
- **THEN** el sistema UPDATE `account_currencies.initial_balance=100000` para la `Billetera`, fila ARS
- **AND** ejecuta `router.replace('/(onboarding)/done')`

### Requirement: La pantalla done marca el onboarding como completado y muestra resumen

El sistema SHALL renderizar la pantalla done con un mensaje de éxito y un resumen del disponible actual del usuario, calculado desde `account_currencies.initial_balance` agregado por moneda. Al cargar la pantalla, el sistema SHALL UPDATE `profiles.onboarding_completed_at = now()` para el usuario actual de forma idempotente (si ya estaba seteado, no se vuelve a escribir). El CTA "Ir al dashboard" SHALL navegar al dashboard de la app.

#### Scenario: Usuario llega a done y completa el onboarding (web)

- **WHEN** un usuario llega a `/onboarding/done` por primera vez con `onboarding_completed_at IS NULL`
- **THEN** el sistema UPDATE `profiles.onboarding_completed_at = now()`
- **AND** la pantalla muestra el disponible calculado por moneda (ARS y USD)
- **AND** el usuario puede hacer clic en "Ir al dashboard" para navegar a `/dashboard`

#### Scenario: Usuario revisita done después de completar (web)

- **WHEN** un usuario con `onboarding_completed_at` ya seteado navega a `/onboarding/done`
- **THEN** la pantalla renderiza normalmente sin re-ejecutar el UPDATE (idempotente)
- **AND** el CTA sigue siendo "Ir al dashboard"

#### Scenario: Usuario llega a done y completa el onboarding (mobile)

- **WHEN** un usuario aterriza en `(onboarding)/done` con `onboarding_completed_at IS NULL`
- **THEN** la pantalla ejecuta SELECT de `onboarding_completed_at`, ve NULL, y hace UPDATE con `new Date().toISOString()`
- **AND** la pantalla muestra el disponible agregado calculado con `Intl.NumberFormat('es-AR', ...)` por moneda
- **AND** el CTA "Ir al dashboard" hace `router.replace('/(app)/dashboard')`

#### Scenario: Usuario revisita done después de completar (mobile)

- **WHEN** un usuario con `onboarding_completed_at` ya seteado aterriza en `(onboarding)/done`
- **THEN** el SELECT inicial encuentra el valor no-NULL y la pantalla NO ejecuta el UPDATE
- **AND** la pantalla renderiza con el disponible y CTA igual que la primera vez

### Requirement: El wizard NO permite saltar pasos intermedios

El sistema NO SHALL exponer ningún botón "Saltar este paso" ni mecanismo equivalente en la pantalla de saldo actual. El usuario SHALL completar cada paso para poder avanzar al siguiente. Cerrar la app y volver más tarde reanuda el wizard donde quedó (per el requirement de persistencia por paso), pero NO existe una vía para terminarlo sin haber pasado por todos los formularios.

Razón: arrancar con datos vacíos rompe el dashboard (no hay disponible que mostrar, no hay cuenta nombrada, etc.). Forzar el paso por cada pantalla garantiza un estado inicial coherente.

#### Scenario: La pantalla /initial-balance no muestra ningún botón de saltar (web)

- **WHEN** un usuario navega a `/onboarding/initial-balance`
- **THEN** el formulario NO contiene un botón con texto "Saltar este paso", "Saltar", "Omitir" ni equivalente
- **AND** el único CTA disponible es "Continuar"

#### Scenario: El monto en pesos del primary account es obligatorio en /initial-balance (web)

- **WHEN** un usuario en `/initial-balance` deja el input de ARS del grupo principal vacío y hace clic en "Continuar"
- **THEN** el formulario muestra un mensaje de error que indica que el monto en pesos es obligatorio
- **AND** la navegación NO avanza a `/done`

#### Scenario: El monto cero es una declaración válida del primary ARS (web)

- **WHEN** un usuario en `/initial-balance` carga `0` en el input de ARS del grupo principal (declarando explícitamente que no tiene plata en pesos) y hace clic en "Continuar"
- **THEN** el formulario acepta el valor y avanza a `/done`
- **AND** `account_currencies.initial_balance` queda en `0` para la fila ARS del primary account (sin cambios respecto al default del trigger)

#### Scenario: La pantalla de saldo actual no muestra ningún botón de saltar (mobile)

- **WHEN** un usuario abre `(onboarding)/initial-balance` en mobile
- **THEN** el formulario NO contiene un `Button` o `Pressable` con texto "Saltar este paso", "Saltar", "Omitir" ni equivalente
- **AND** el único CTA disponible es "Continuar"

#### Scenario: El monto en pesos del primary account es obligatorio en initial-balance (mobile)

- **WHEN** un usuario en `(onboarding)/initial-balance` deja el `TextInput` de ARS del grupo principal vacío y presiona "Continuar"
- **THEN** el formulario muestra un mensaje de error indicando que el monto en pesos es obligatorio
- **AND** la navegación NO avanza a `(onboarding)/done`

#### Scenario: El monto cero es una declaración válida del primary ARS (mobile)

- **WHEN** un usuario en `(onboarding)/initial-balance` carga `0` en el `TextInput` ARS del grupo principal y presiona "Continuar"
- **THEN** el formulario acepta el valor y avanza a `(onboarding)/done`
- **AND** `account_currencies.initial_balance` queda en `0` para la fila ARS del primary account (sin cambios respecto al default del trigger)

