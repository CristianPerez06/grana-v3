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

El sistema SHALL renderizar la pantalla de welcome con un mensaje de bienvenida personalizado que establece la propuesta de valor de Grana, incluyendo `profiles.full_name` de forma opcional. La descripción SHALL ser breve, cercana y usar tono cotidiano que baje la ansiedad del usuario. El CTA "Empezar" SHALL navegar a la pantalla de saldo inicial. La pantalla SHALL NOT pedir ningún input ni persistir nada en la base.

Copy de referencia (canon español):
- Saludo (si `full_name` existe): "Ey, {first_name}! 👋"
- Promesa: "Vamos a ordenar tu plata sin convertir esto en una planilla eterna."
- Subtext: "Empezamos con lo que tenés hoy. Sin juicio, sin drama."

#### Scenario: Pantalla de welcome muestra copy con tono Grana (web)

- **WHEN** un usuario autenticado con `onboarding_completed_at IS NULL` navega a `/onboarding/welcome`
- **THEN** la pantalla renderiza el saludo personalizado con su `full_name` (si existe)
- **AND** muestra la promesa de valor ("ordenar tu plata sin convertir esto en una planilla eterna")
- **AND** el subtext valida la vida real ("Sin juicio, sin drama")
- **AND** el único elemento accionable es un botón "Empezar" que navega a `/onboarding/initial-balance`
- **AND** no se modifica ningún registro en `profiles`, `accounts` ni otras tablas

#### Scenario: Pantalla de welcome muestra copy con tono Grana (mobile)

- **WHEN** un usuario autenticado con `onboarding_completed_at IS NULL` aterriza en `(onboarding)/welcome`
- **THEN** la pantalla renderiza el saludo personalizado con su `full_name` (si existe)
- **AND** muestra la promesa de valor con tono cercano
- **AND** el único elemento accionable es un botón "Empezar" que dispara `router.push('/(onboarding)/initial-balance')`

### Requirement: La pantalla de saldo actual impacta initial_balance, no crea transacciones

El sistema SHALL renderizar la pantalla de saldo actual con dos inputs (uno ARS, uno USD) bajo la pregunta literal "¿Cuánta plata tenés hoy?". El copy explanatorio SHALL establecer que esto es el punto de partida, no un ingreso ni un gasto, y validar que la vida real rara vez cierra perfecto. La UI NO SHALL mencionar la palabra "Billetera" ni el concepto "cuenta". Al avanzar, el sistema SHALL UPDATE el campo `account_currencies.initial_balance` de la `Billetera` para cada par (moneda) con monto > 0. El sistema SHALL NOT insertar filas en `transactions`. Los inputs vacíos o iguales a cero NO SHALL modificar el `initial_balance` existente. El monto en pesos (ARS) del grupo principal es obligatorio (puede ser 0).

Copy de referencia (canon español):
- Encabezado: "Esto no es un ingreso ni un gasto. Es tu punto de partida."
- Subtext: "Si no sabés el número exacto, poné una aproximación. La vida real rara vez cierra perfecto."

#### Scenario: Usuario ingresa solo ARS y avanza — validación de copy Grana (web)

- **WHEN** un usuario ingresa `100000` en el input ARS, ve el copy explicativo sobre punto de partida, y hace clic en "Continuar"
- **THEN** el sistema UPDATE `account_currencies.initial_balance=100000` para la `Billetera`, fila ARS
- **AND** la fila USD queda con `initial_balance=0` (sin cambios)
- **AND** NO se inserta ninguna fila en `transactions`
- **AND** redirige a `/onboarding/done`

### Requirement: La pantalla done marca el onboarding como completado y muestra resumen

El sistema SHALL renderizar la pantalla done con un mensaje de éxito cálido que valida la completitud del onboarding ("Listo. Tu Grana ya tiene punto de partida.") seguido de un guiño que establece la propuesta ("Ahora sí: que los gastos misteriosos den la cara."). La pantalla SHALL mostrar un resumen del disponible actual del usuario, calculado desde `account_currencies.initial_balance` agregado por moneda. Al cargar la pantalla, el sistema SHALL UPDATE `profiles.onboarding_completed_at = now()` para el usuario actual de forma idempotente.

**Web — bifurcación "Tu Grana, tu decisión"**: en lugar de un CTA único, la pantalla SHALL ofrecer al usuario una elección entre dos formas de usar Grana, alineada al modelo mental novato/experto:

- **Card A — "Una billetera y listo"** (modo simple): para quien quiere saber *cuánto tiene / en qué se fue* sin detalle por cuenta. Apoyado en que la `Billetera` por defecto ya existe.
- **Card B — "Mis cuentas, al detalle"** (modo control): para quien además quiere saber *dónde está* la plata y conciliar el saldo de cada cuenta real.

Al elegir una card, el sistema SHALL mostrar un **paso de confirmación cálido que reemplaza toda la pantalla** (oculta el header de éxito y el resumen de saldo, dejando solo el mensaje del camino elegido) con un botón "Vamos" que recién entonces rutea. Ambos caminos abren el formulario correspondiente **en un drawer** (presentación consistente con el resto de la app):

- **A → ** "¡Genial! Arranquemos por tu primer movimiento." → navega a `/dashboard?nuevo=1` (abre el drawer de alta de movimiento; ver capability `transactions`). El usuario sin movimientos verá ahí el tour guiado.
- **B → ** "¡Te gusta el detalle! Vamos a crear tu primera cuenta." → navega a `/accounts?nuevaCuenta=1` (abre el drawer de alta de cuenta; ver capability `accounts`).

NO hay escape: el usuario SHALL elegir A o B (decisión de producto — el cierre del onboarding empuja a dar el primer paso). La elección SHALL ser puramente de ruteo: NO SHALL persistir un "modo de usuario" ni reconfigurar la UI del resto de la app (eso queda fuera de alcance).

**Mobile**: El CTA principal SHALL ser "Ir al dashboard" porque el flujo nativo de alta de movimiento no existe aún (`QuickAddFab` está deshabilitado) y la bifurcación depende del drawer web. Cuando el flujo móvil exista, se evaluará portar la bifurcación.

Copy de referencia (canon español):
- Éxito: "Listo. Tu Grana ya tiene punto de partida."
- Guiño: "Ahora sí: que los gastos misteriosos den la cara."
- Encabezado del fork: "Tu Grana, tu decisión" / "¿Cómo querés llevar tu plata?"
- Card A: "Una billetera y listo" · "Llevá todo junto, sin complicarte. Anotás lo que entra y sale, y siempre sabés cuánto tenés. Tu billetera ya está creada." · etiqueta "Lo más simple"
- Card B: "Mis cuentas, al detalle" · "Cargá tus cuentas reales —banco, efectivo, lo que uses— y seguí el saldo de cada una. Para los que quieren tener todo cuadrado." · etiqueta "Más control"
- Confirmación A: "¡Genial! Arranquemos por tu primer movimiento."
- Confirmación B: "¡Te gusta el detalle! Vamos a crear tu primera cuenta."
- Botón de confirmación: "Vamos 🚀" · volver atrás: "Volver"

#### Scenario: Usuario llega a done y ve la bifurcación de modo (web)

- **WHEN** un usuario llega a `/onboarding/done` por primera vez con `onboarding_completed_at IS NULL`
- **THEN** el sistema UPDATE `profiles.onboarding_completed_at = now()`
- **AND** la pantalla muestra el disponible calculado por moneda (ARS y USD)
- **AND** muestra el encabezado "Tu Grana, tu decisión" con las dos cards (A "Una billetera y listo" / B "Mis cuentas, al detalle")
- **AND** NO ofrece ningún escape: el usuario debe elegir A o B

#### Scenario: Usuario elige modo billetera (A) y arranca su primer movimiento (web)

- **WHEN** el usuario toca la card A "Una billetera y listo"
- **THEN** la pantalla reemplaza todo su contenido por la confirmación "¡Genial! Arranquemos por tu primer movimiento." con un botón "Vamos 🚀" (sin navegar todavía; el header de éxito y el saldo quedan ocultos)
- **AND** al tocar "Vamos 🚀" navega a `/dashboard?nuevo=1`, que abre el drawer de alta de movimiento
- **AND** como el usuario no tiene movimientos, el tour guiado del drawer arranca

#### Scenario: Usuario elige modo cuentas (B) y crea su primera cuenta (web)

- **WHEN** el usuario toca la card B "Mis cuentas, al detalle"
- **THEN** la pantalla reemplaza todo su contenido por la confirmación "¡Te gusta el detalle! Vamos a crear tu primera cuenta." con un botón "Vamos 🚀" (sin navegar todavía)
- **AND** al tocar "Vamos 🚀" navega a `/accounts?nuevaCuenta=1`, que abre el drawer de alta de cuenta
- **AND** puede volver a las cards con "Volver" sin haber navegado

#### Scenario: Usuario llega a done y ve CTA a dashboard (mobile)

- **WHEN** un usuario aterriza en `(onboarding)/done` con `onboarding_completed_at IS NULL`
- **THEN** la pantalla ejecuta SELECT de `onboarding_completed_at`, ve NULL, y hace UPDATE con `new Date().toISOString()`
- **AND** la pantalla muestra el disponible agregado calculado con `Intl.NumberFormat('es-AR', ...)` por moneda
- **AND** el CTA principal dice "Ir al dashboard" y hace `router.replace('/(app)/dashboard')`
- **AND** NO hay CTA a movimiento porque el flujo nativo no existe aún

#### Scenario: Usuario revisita done después de completar — bifurcación web (web)

- **WHEN** un usuario con `onboarding_completed_at` ya seteado navega a `/onboarding/done`
- **THEN** la pantalla renderiza normalmente sin re-ejecutar el UPDATE (idempotente)
- **AND** la bifurcación A/B y el escape "Mejor lo veo después" siguen disponibles igual que la primera vez

#### Scenario: Usuario revisita done después de completar — CTA mobile (mobile)

- **WHEN** un usuario con `onboarding_completed_at` ya seteado aterriza en `(onboarding)/done`
- **THEN** el SELECT inicial encuentra el valor no-NULL y la pantalla NO ejecuta el UPDATE
- **AND** la pantalla renderiza con el disponible y CTA igual que la primera vez ("Ir al dashboard")

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

### Requirement: Bimoneda por defecto — todo usuario arranca con ARS y USD habilitados

El sistema SHALL habilitar ambas monedas (ARS y USD) para todo usuario nuevo en el momento del alta, sin pedirle al usuario que opte por la segunda moneda. La decisión de NO ver USD SHALL ser un opt-out posterior desde el módulo `settings` (próxima change), no un opt-in en el onboarding.

Esto se traduce concretamente a:

- El trigger `on_auth_user_created_default_account` SHALL crear la cuenta `Billetera` con filas en `account_currencies` para ARS y USD, ambas con `initial_balance=0` (comportamiento ya existente, que se preserva).
- Toda cuenta creada en el wizard de onboarding (cuenta bancaria) SHALL incluir filas en `account_currencies` para ARS y USD por defecto.
- La pantalla `/onboarding/saldo-actual` SHALL pedir saldos en ARS y USD para todas las cuentas relevantes, sin preguntar previamente "¿manejás dólares?".
- La UI de la app SHALL mostrar columnas y totales por separado para ARS y USD por defecto, en línea con el principio cross-cutting "Bimoneda" (ARS y USD son ledgers separados, nunca se convierten).
- Cuando la próxima change del módulo `settings` agregue un toggle "ocultar USD" en preferencias del usuario, ese toggle SHALL afectar solo la presentación visual (esconder columnas USD, no mostrar el segundo input en formularios) y NO SHALL alterar las filas de `account_currencies` ni el ledger interno.

Este principio es complementario, no reemplazo, del principio "Bimoneda" listado en la tabla de cross-cutting principles del `AGENTS.md` (que prohíbe convertir automáticamente entre ARS y USD). "Bimoneda por defecto" agrega: ARS+USD están habilitados por defecto para todos.

#### Scenario: Usuario nuevo tiene cuenta Billetera con ambas monedas tras signup

- **WHEN** un usuario completa el signup
- **THEN** existe en `accounts` una fila `Billetera` (tipo cash, propiedad del usuario)
- **AND** existen exactamente dos filas en `account_currencies` para esa cuenta: una con `currency_code='ARS', initial_balance=0` y otra con `currency_code='USD', initial_balance=0`

#### Scenario: Cuenta bancaria creada en onboarding tiene ambas monedas

- **WHEN** un usuario en `/onboarding/perfil` crea una cuenta bancaria
- **THEN** existen filas en `account_currencies` para ARS y USD asociadas a esa cuenta, ambas con `initial_balance=0`

#### Scenario: Saldo actual del onboarding pregunta ambas monedas sin precondición

- **WHEN** un usuario en `/onboarding/saldo-actual` ve el formulario
- **THEN** hay un input de monto para ARS y otro para USD (por cada cuenta visible en esa pantalla, según el modo)
- **AND** no hay pregunta previa tipo "¿manejás dólares?" que controle la visibilidad de los inputs USD

