## NOTA

Estos deltas reflejan la decisión **D2-a** (ver `design.md`): se **elimina** el paso `/onboarding/profile`; el wizard pasa a tres pantallas (`welcome → initial-balance → done`).

## MODIFIED Requirements

### Requirement: El wizard de onboarding tiene tres pantallas con persistencia por paso

(MODIFICA "El wizard de onboarding tiene cuatro pantallas con persistencia por paso": se elimina la pantalla `profile`. También se ajusta el `Purpose` del master spec, que menciona "captura el modo del usuario (`novato`/`experto`) y opcionalmente una cuenta bancaria inicial".)

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

(MODIFICA el mismo requirement: el CTA "Empezar" ahora navega a `initial-balance` —ya no a `profile`—. El copy puede incorporar la idea de que la app arranca con una `Billetera` y que el usuario puede sumar cuentas cuando quiera.)

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

(MODIFICA el mismo requirement: se elimina la rama de dos grupos para "experto con banco". Hay un único flujo para todos sobre la `Billetera`.)

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

## REMOVED Requirements

### Requirement: La pantalla de perfil pregunta por modo y banco condicionalmente

Se elimina. Al no haber modos, no hay pantalla de perfil que capture modo ni banco. La `Billetera` default (ARS + USD) se provisiona al signup; las cuentas adicionales (incluida la bancaria) se crean después del onboarding desde el módulo `accounts`.

### Requirement: La creación de cuenta bancaria en la pantalla de perfil es atómica

Se elimina. Ya no se crea ninguna cuenta bancaria durante el onboarding, por lo que no hay operación atómica de `accounts` + `account_currencies` que cubrir en este flujo.
