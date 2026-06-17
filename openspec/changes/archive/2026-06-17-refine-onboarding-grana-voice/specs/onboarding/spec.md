# onboarding Specification (Delta)

## MODIFIED Requirements

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
