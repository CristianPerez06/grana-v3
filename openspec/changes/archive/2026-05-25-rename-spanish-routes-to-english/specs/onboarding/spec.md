## MODIFIED Requirements

### Requirement: El wizard de onboarding tiene cuatro pantallas con persistencia por paso

El sistema SHALL exponer el onboarding post-signup como cuatro pantallas separadas (`welcome`, `profile`, `initial-balance`, `done`) bajo un route group dedicado al wizard. Cada pantalla SHALL persistir su cambio inmediatamente al servidor antes de avanzar (server action en web, llamada directa a Supabase en mobile). El sistema SHALL NOT mantener el estado del wizard en memoria del cliente entre pantallas: si el usuario refresca o cierra la app, el progreso queda guardado en la base de datos y el wizard reanuda donde corresponda.

#### Scenario: Usuario refresca la pantalla a mitad del wizard (web)

- **WHEN** un usuario completa `/onboarding/profile` y refresca el navegador sobre `/onboarding/initial-balance`
- **THEN** el sistema mantiene el estado persistido (mode y, si corresponde, cuenta bancaria creada) y permite al usuario completar `/initial-balance`
- **AND** el usuario NO debe re-responder las preguntas de `/profile`

#### Scenario: Usuario cierra el navegador y vuelve días después (web)

- **WHEN** un usuario completa `/welcome` y `/profile`, cierra el navegador, y vuelve a entrar a la app cinco días después
- **THEN** el middleware detecta `onboarding_completed_at IS NULL` y lo redirige a `/onboarding/welcome`
- **AND** desde `/welcome` puede avanzar a `/profile` que ya tiene sus respuestas previas reflejadas en el estado del perfil (no se le piden de nuevo)

#### Scenario: Usuario mata la app a mitad del wizard (mobile)

- **WHEN** un usuario completa `(onboarding)/profile` en mobile, cierra/mata la app, y la abre de nuevo
- **THEN** el splash gate detecta `onboarding_completed_at IS NULL` y lo redirige a `(onboarding)/welcome`
- **AND** las respuestas previas de `/profile` siguen reflejadas en el estado del perfil — no se le piden de nuevo

#### Scenario: Usuario navega hacia atrás en el stack a mitad del wizard (mobile)

- **WHEN** un usuario llega a `(onboarding)/initial-balance` y usa el gesto/botón de back para volver a `(onboarding)/profile`
- **THEN** la pantalla de perfil renderiza con los valores ya persistidos (mode + opcionalmente la cuenta bancaria creada)
- **AND** el usuario puede modificar y re-submitear o avanzar otra vez

### Requirement: La pantalla de welcome muestra una bienvenida sin inputs

El sistema SHALL renderizar la pantalla de welcome con un mensaje de bienvenida personalizado (incluyendo `profiles.full_name`), una descripción corta de lo que sigue ("Vamos a hacer un par de preguntas para que la app se ajuste a vos"), y un único CTA "Empezar" que navega a la pantalla de perfil. La pantalla SHALL NOT pedir ningún input ni persistir nada en la base.

#### Scenario: Pantalla de welcome carga sin acciones laterales (web)

- **WHEN** un usuario autenticado con `onboarding_completed_at IS NULL` navega a `/onboarding/welcome`
- **THEN** la pantalla renderiza el copy de bienvenida con su `full_name`
- **AND** el único elemento accionable es un botón "Empezar"
- **AND** no se modifica ningún registro en `profiles`, `accounts` ni otras tablas

#### Scenario: Pantalla de welcome carga sin acciones laterales (mobile)

- **WHEN** un usuario autenticado con `onboarding_completed_at IS NULL` aterriza en `(onboarding)/welcome` (por el splash gate o por post-signup)
- **THEN** la pantalla renderiza el copy de bienvenida con su `full_name` resuelto desde `profiles.full_name`
- **AND** el único elemento accionable es un botón "Empezar" que dispara `router.push('/(onboarding)/profile')`
- **AND** no se modifica ningún registro en `profiles`, `accounts` ni otras tablas

### Requirement: La pantalla de perfil pregunta por modo y banco condicionalmente

El sistema SHALL renderizar la pantalla de perfil con un formulario que contiene:

1. Una pregunta principal renderizada como dos cards seleccionables — "Vista simple" y "Vista detallada" — cada una con un resumen de las preguntas que la app responde en ese modo. La elección SHALL ser obligatoria para avanzar (no hay default visible que se aplique al continuar; el comportamiento de "Saltar" se especifica en su propio requirement).
2. Una pregunta secundaria "¿Tenés cuenta en algún banco?" con radios sí/no — visible SOLO si el usuario eligió "Vista detallada". Si responde sí, el formulario SHALL expandirse para mostrar un selector de institución (modal con search en mobile, `<select>` en web) y un input de nombre de cuenta. Ambos campos SHALL ser obligatorios para avanzar si la respuesta es sí.

El sistema NO SHALL preguntar sobre tarjeta de crédito en la pantalla de perfil. La tarjeta se crea recién cuando el usuario, después del onboarding, navega al módulo `cards` y completa el wizard de creación de tarjetas existente.

#### Scenario: Usuario elige Vista simple y avanza (web)

- **WHEN** un usuario marca la card "Vista simple" y hace clic en "Continuar"
- **THEN** el sistema persiste `profiles.mode='novato'`
- **AND** NO crea ninguna fila en `accounts`
- **AND** redirige a `/onboarding/initial-balance`

#### Scenario: Usuario elige Vista detallada con banco (web)

- **WHEN** un usuario marca la card "Vista detallada", responde sí a banco, elige "Galicia" del selector, ingresa "Caja de ahorro" como nombre, y hace clic en "Continuar"
- **THEN** el sistema persiste `profiles.mode='experto'`
- **AND** crea una fila en `accounts` con `type='bank'`, `institution_id` apuntando a la fila de Galicia en `institutions`, `name='Caja de ahorro'`, `is_active=true`, `user_id=auth.uid()`
- **AND** crea las filas correspondientes en `account_currencies` para esa cuenta (ARS y USD, ambas con `initial_balance=0`)
- **AND** redirige a `/onboarding/initial-balance`

#### Scenario: Usuario elige Vista simple — la pregunta de banco no aparece (web)

- **WHEN** un usuario marca la card "Vista simple"
- **THEN** el formulario NO muestra la pregunta "¿Tenés cuenta en algún banco?"

#### Scenario: El formulario nunca muestra una pregunta sobre tarjeta (web)

- **WHEN** un usuario carga `/onboarding/profile` con cualquier modo seleccionado
- **THEN** el formulario NO contiene un campo, radio o card sobre tarjeta de crédito

#### Scenario: Usuario elige Vista detallada, marca sí a banco pero no completa el nombre (web)

- **WHEN** un usuario marca "Vista detallada", marca sí a banco, elige una institución pero deja el nombre vacío y hace clic en "Continuar"
- **THEN** el formulario muestra un error de validación bajo el campo nombre
- **AND** el sistema NO persiste ningún cambio en `profiles` ni crea cuenta
- **AND** la URL no avanza

#### Scenario: Usuario elige Vista simple y avanza (mobile)

- **WHEN** un usuario tocca la card "Vista simple" en `(onboarding)/profile` y presiona "Continuar"
- **THEN** el sistema persiste `profiles.mode='novato'` vía `supabase.from('profiles').update(...)`
- **AND** NO crea ninguna fila en `accounts`
- **AND** ejecuta `router.replace('/(onboarding)/initial-balance')`

#### Scenario: Usuario elige Vista detallada con banco (mobile)

- **WHEN** un usuario tocca la card "Vista detallada", presiona "Sí" en banco, abre el `InstitutionPickerModal`, busca y selecciona "Galicia", ingresa "Caja de ahorro" como nombre, y presiona "Continuar"
- **THEN** el sistema persiste `profiles.mode='experto'`
- **AND** crea una fila en `accounts` con `type='bank'`, `institution_id` apuntando a la fila de Galicia, `name='Caja de ahorro'`, `is_active=true`, `user_id=auth.uid()`
- **AND** crea las filas correspondientes en `account_currencies` para esa cuenta (ARS y USD, ambas con `initial_balance=0`)
- **AND** ejecuta `router.replace('/(onboarding)/initial-balance')`

#### Scenario: El formulario nunca muestra una pregunta sobre tarjeta (mobile)

- **WHEN** un usuario carga `(onboarding)/profile` en mobile con cualquier modo seleccionado
- **THEN** el formulario NO contiene un campo, switch, picker o card sobre tarjeta de crédito

#### Scenario: Usuario elige Vista detallada pero no completa el nombre del banco (mobile)

- **WHEN** un usuario marca "Vista detallada", presiona "Sí" en banco, selecciona una institución pero deja el nombre vacío y presiona "Continuar"
- **THEN** el formulario muestra un error de validación bajo el campo nombre traducido por `translateValidationMessage`
- **AND** el sistema NO persiste cambios ni crea cuenta
- **AND** la pantalla no avanza

### Requirement: La pantalla de saldo actual impacta initial_balance, no crea transacciones

El sistema SHALL renderizar la pantalla de saldo actual con inputs para que el usuario ingrese la plata que tiene hoy, separada por moneda (ARS y USD siempre, ver `project-conventions/Bimoneda por defecto`):

- **Usuarios con `mode='novato'`** o **`mode='experto'` sin cuenta bancaria**: el formulario SHALL mostrar dos inputs (uno ARS, uno USD) bajo la pregunta literal "¿Cuánta plata tenés hoy?". La UI NO SHALL mencionar la palabra "Billetera" ni el concepto "cuenta".
- **Usuarios con `mode='experto'` y cuenta bancaria creada en perfil**: el formulario SHALL mostrar dos grupos de inputs:
  - Grupo "En {nombre de la cuenta bancaria}": dos inputs (ARS, USD).
  - Grupo "En efectivo (opcional)": dos inputs (ARS, USD), claramente marcados como opcionales.

Al avanzar, el sistema SHALL UPDATE el campo `account_currencies.initial_balance` de la cuenta correspondiente para cada par (cuenta, moneda) ingresado por el usuario con monto > 0. El sistema SHALL NOT insertar filas en `transactions`. Los inputs vacíos o iguales a cero NO SHALL modificar el `initial_balance` existente (queda en cero o el valor previo).

#### Scenario: Novato ingresa solo ARS y avanza (web)

- **WHEN** un usuario novato ingresa `100000` en el input ARS, deja USD vacío, y hace clic en "Continuar"
- **THEN** el sistema UPDATE `account_currencies.initial_balance=100000` para la cuenta `Billetera` del usuario, fila ARS
- **AND** la fila USD de Billetera queda con `initial_balance=0` (sin cambios)
- **AND** NO se inserta ninguna fila en `transactions`
- **AND** redirige a `/onboarding/done`

#### Scenario: Experto ingresa saldo en cuenta bancaria y efectivo (web)

- **WHEN** un usuario experto con cuenta bancaria "Caja de ahorro" ingresa `500000 ARS` y `1200 USD` en el grupo "En Caja de ahorro", y `20000 ARS` en el grupo "En efectivo" dejando USD vacío
- **THEN** `account_currencies.initial_balance` queda en `500000` para la fila (Caja de ahorro, ARS), `1200` para (Caja de ahorro, USD), `20000` para (Billetera, ARS), `0` para (Billetera, USD)
- **AND** redirige a `/onboarding/done`

#### Scenario: Novato ingresa solo ARS y avanza (mobile)

- **WHEN** un usuario novato ingresa `100000` en el `TextInput` ARS, deja USD vacío, y presiona "Continuar"
- **THEN** el sistema UPDATE `account_currencies.initial_balance=100000` para la cuenta `Billetera` del usuario, fila ARS
- **AND** la fila USD de Billetera queda con `initial_balance=0` (sin cambios)
- **AND** NO se inserta ninguna fila en `transactions`
- **AND** ejecuta `router.replace('/(onboarding)/done')`

#### Scenario: Experto ingresa saldo en cuenta bancaria y efectivo (mobile)

- **WHEN** un usuario experto con cuenta bancaria "Caja de ahorro" ingresa `500000 ARS` y `1200 USD` en el grupo "En Caja de ahorro", y `20000 ARS` en el grupo "En efectivo" dejando USD vacío
- **THEN** `account_currencies.initial_balance` queda en `500000` para (Caja de ahorro, ARS), `1200` para (Caja de ahorro, USD), `20000` para (Billetera, ARS), `0` para (Billetera, USD)
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

El sistema NO SHALL exponer ningún botón "Saltar este paso" ni mecanismo equivalente en la pantalla de perfil ni en la pantalla de saldo actual. El usuario SHALL completar cada paso para poder avanzar al siguiente. Cerrar la app y volver más tarde reanuda el wizard donde quedó (per el requirement de persistencia por paso), pero NO existe una vía para terminarlo sin haber pasado por todos los formularios.

Razón: arrancar con datos vacíos rompe el dashboard (no hay disponible que mostrar, no hay cuenta nombrada, etc.). Forzar el paso por cada pantalla garantiza un estado inicial coherente.

#### Scenario: La pantalla /profile no muestra ningún botón de saltar (web)

- **WHEN** un usuario navega a `/onboarding/profile`
- **THEN** el formulario NO contiene un botón con texto "Saltar este paso", "Saltar", "Omitir" ni equivalente
- **AND** el único CTA disponible es "Continuar" (deshabilitado mientras la validación falle)

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

#### Scenario: La pantalla de perfil no muestra ningún botón de saltar (mobile)

- **WHEN** un usuario abre `(onboarding)/profile` en mobile
- **THEN** el formulario NO contiene un `Button` o `Pressable` con texto "Saltar este paso", "Saltar", "Omitir" ni equivalente
- **AND** el único CTA disponible es "Continuar"

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

### Requirement: La creación de cuenta bancaria en la pantalla de perfil es atómica

El sistema SHALL ejecutar la creación de la cuenta bancaria (fila en `accounts` + filas en `account_currencies` para ARS y USD) como una unidad atómica desde el punto de vista del usuario. Si cualquier paso del segundo bloque falla, el sistema SHALL revertir la fila previa de `accounts` (compensación manual desde el cliente, dado que Supabase JS no expone transacciones SQL) y mostrar un error al usuario sin avanzar.

#### Scenario: Falla en account_currencies hace rollback de accounts (web)

- **WHEN** el INSERT de `account_currencies` falla por cualquier razón después de un INSERT exitoso en `accounts`
- **THEN** la fila previa en `accounts` se elimina (rollback compensatorio desde el server action)
- **AND** el usuario ve un mensaje de error en `/profile`
- **AND** el formulario queda en estado editable para reintentar

#### Scenario: Falla en account_currencies hace rollback de accounts (mobile)

- **WHEN** el INSERT de `account_currencies` falla por cualquier razón después de un INSERT exitoso en `accounts` durante el submit de `(onboarding)/profile`
- **THEN** la pantalla ejecuta `supabase.from('accounts').delete().eq('id', ...)` para eliminar la fila huérfana
- **AND** el usuario ve un mensaje de error renderizado por `FormError`
- **AND** el formulario queda en estado editable para reintentar
