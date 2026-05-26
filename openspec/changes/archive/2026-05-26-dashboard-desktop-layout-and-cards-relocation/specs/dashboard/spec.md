## ADDED Requirements

### Requirement: El dashboard usa un layout multi-columna en desktop (web)

En viewports `lg` (≥1024px) y mayores, la pantalla `/dashboard` web SHALL reorganizar sus secciones en un layout multi-columna en lugar de la columna única mobile-first: el Hero ocupa el ancho completo arriba; debajo, "Balance del mes" y "Lo que viene" se muestran lado a lado, con "Balance del mes" creciendo para ocupar el ancho disponible y "Lo que viene" como rail de ancho acotado a la derecha. Ambas columnas SHALL igualar su altura. Por debajo de `lg`, el dashboard SHALL mantener la columna única mobile-first actual. El layout NO SHALL depender del modo (`novato`/`experto`).

#### Scenario: Desktop ancho muestra dos columnas con alturas igualadas

- **WHEN** un usuario carga `/dashboard` en un viewport de 1440px
- **THEN** el Hero ocupa el ancho completo arriba
- **AND** "Balance del mes" y "Lo que viene" se muestran lado a lado debajo del Hero
- **AND** ambas columnas terminan a la misma altura

#### Scenario: Entre md y lg el dashboard sigue en columna única

- **WHEN** un usuario carga `/dashboard` en un viewport de 820px (sidebar visible)
- **THEN** las secciones se apilan en una sola columna (Hero → Lo que viene → Balance del mes)

#### Scenario: Bajo md el dashboard es mobile-first

- **WHEN** un usuario carga `/dashboard` en un viewport de 375px
- **THEN** las secciones se apilan en una sola columna

### Requirement: El header del dashboard saluda al usuario y muestra la fecha de hoy

El header del dashboard SHALL mostrar un saludo `Hola, {name}.` usando el nombre del perfil (key `dashboard.welcome`), con fallback a `dashboard.welcome_anon` ("Hola.") cuando el perfil no tiene nombre. El header SHALL mostrar la fecha del día calculada desde la zona horaria financiera del usuario vía `getTodayAR()`; NO SHALL usar `new Date()` directo del navegador/servidor. El `eye toggle` (definido en su propio requirement) convive en este header. En desktop el saludo es el título grande del header; en la app nativa el saludo se pinta dentro del header navy.

#### Scenario: Saludo con nombre del perfil

- **WHEN** el usuario con nombre "Cristian" carga `/dashboard`
- **THEN** el header muestra "Hola, Cristian."
- **AND** muestra la fecha de hoy en la zona horaria financiera (AR)

#### Scenario: Saludo sin nombre usa fallback

- **WHEN** el usuario no tiene nombre cargado en el perfil
- **THEN** el header muestra "Hola."

#### Scenario: La fecha de hoy se calcula desde la zona financiera

- **WHEN** se renderiza la fecha del header del dashboard
- **THEN** el valor se deriva de `getTodayAR()` y NO de `new Date()` directo

### Requirement: El header del dashboard ofrece un acceso primario para registrar un movimiento (web)

En web, el header del dashboard SHALL incluir un botón primario "Nuevo movimiento" (estilo `positive`/emerald) que navega a la creación de movimiento (`/transactions/new`). El label del botón SHALL leerse del catálogo i18n (no hardcodeado). En la app nativa este acceso NO es parte del header del dashboard; cargar un movimiento se resuelve por el flujo existente (fuera de alcance de este change).

#### Scenario: El botón navega a la creación de movimiento

- **WHEN** un usuario web toca "Nuevo movimiento" en el header del dashboard
- **THEN** navega a `/transactions/new`

#### Scenario: El label del botón es traducible

- **WHEN** un desarrollador inspecciona el botón "Nuevo movimiento"
- **THEN** su label se obtiene del catálogo i18n, sin string hardcodeado

### Requirement: El dashboard nativo pinta el header y la status bar con el navy de marca (mobile)

En la app nativa, el header del dashboard (que contiene el saludo y el `eye toggle`) y la status bar SHALL pintarse con el navy de marca (`--navy` / `#0B1A2B`) leído desde el mirror de tokens, sin hex hardcodeado, y la status bar SHALL usar estilo `light`. El header navy SHALL respetar el safe-area top del dispositivo.

#### Scenario: Header navy con status bar light

- **WHEN** un usuario abre el dashboard en la app nativa
- **THEN** el header del dashboard se pinta con el navy de marca
- **AND** la status bar usa estilo light (íconos/hora en claro)
- **AND** el header respeta el safe-area top

#### Scenario: El color navy no está hardcodeado

- **WHEN** un desarrollador inspecciona el componente del header nativo
- **THEN** el color proviene del mirror de tokens, no de un literal hex

## MODIFIED Requirements

### Requirement: La pantalla dashboard es la landing universal post-login y post-onboarding

El sistema SHALL renderizar la pantalla principal de la app en la ruta `/dashboard` bajo el grupo `(app)`, tanto en web como en mobile. La pantalla SHALL ser la única landing tras tres flujos: login exitoso, signup confirmado con onboarding ya completado, y completar el onboarding (en ambos modos, novato y experto).

El dashboard SHALL ser idéntico para los dos modos (`users.mode='novato'` y `users.mode='experto'`). El modo NO modifica ninguna sección, dato, layout ni componente del dashboard. El detalle adicional del modo experto vive en el módulo Cuentas, no en el dashboard.

El dashboard SHALL renderizar **tres** secciones en orden vertical (mobile) o reorganizadas en desktop: Hero → Lo que viene → Balance del mes. La sección Tarjetas NO forma parte del dashboard; el resumen de tarjetas vive en `/cards` (web) y se navega desde el `AppMenu` → `/cards` (nativo).

#### Scenario: Usuario novato aterriza en dashboard tras completar el onboarding

- **WHEN** un usuario completa el flujo de onboarding novato
- **THEN** el sistema redirige a `/dashboard`
- **AND** NO redirige a `/cards`

#### Scenario: Usuario experto aterriza en dashboard tras completar el onboarding

- **WHEN** un usuario completa el flujo de onboarding experto
- **THEN** el sistema redirige a `/dashboard`

#### Scenario: Login exitoso aterriza en dashboard

- **WHEN** un usuario con onboarding completado hace login
- **THEN** el sistema redirige a `/dashboard`

#### Scenario: Dashboard se ve igual en novato y experto

- **WHEN** dos usuarios con datos idénticos pero `users.mode` distinto cargan `/dashboard`
- **THEN** la pantalla renderiza las mismas tres secciones (Hero, Lo que viene, Balance del mes), en el mismo orden, con los mismos componentes y los mismos importes

#### Scenario: Arranque con sesión activa aterriza en /dashboard renderizado (mobile)

- **WHEN** un usuario mobile con sesión válida persistida abre la app
- **THEN** la app aterriza en `(app)/dashboard` con las tres secciones renderizadas (Hero, Lo que viene, Balance del mes)
- **AND** NO renderiza el placeholder "Dashboard" de texto plano

### Requirement: El Hero muestra el disponible total bimoneda

El Hero SHALL mostrar dos importes: el saldo disponible total en ARS (primario, tipografía grande) y el saldo disponible total en USD (secundario, tipografía menor) lado a lado o stackeado. Cada importe SHALL surgir de la suma de los saldos derivados de todas las cuentas activas del usuario con `type IN ('cash','bank')` para la moneda correspondiente; las cuentas `type='credit'` NO entran en el cálculo.

El cálculo SHALL respetar el invariante "Off-ledger credit cards": las transacciones `expense` sobre cuentas `type='credit'` NO reducen el disponible; solo la transacción de pago de resumen (un `expense` sobre cash/bank) lo hace.

Si el usuario tiene ARS habilitado pero no tiene cuentas con saldo USD inicializado, el Hero SHALL mostrar `u$s 0,00` (no oculta la línea, porque V3 provisiona ambas monedas por default).

En **desktop** (≥`lg`), además del disponible total, el Hero SHALL mostrar un desglose de hasta 2–3 cuentas `type IN ('cash','bank')` con su saldo y un enlace "Ver todas las cuentas" → `/accounts`. En **mobile** el Hero SHALL mantenerse minimal: solo el disponible total (ARS primario + USD subordinado), sin desglose. En ambos casos se respeta bimoneda (ARS primario, USD subordinado, sin merge entre monedas).

#### Scenario: Usuario con saldos en ambas monedas

- **WHEN** el usuario tiene una cuenta cash con $ 150.000 ARS + u$s 500 USD y una cuenta bank con $ 137.450 ARS + u$s 740,50 USD, sin pagos de resúmenes pendientes ya descontados
- **THEN** el Hero muestra `$ 287.450,00` en línea primaria y `u$s 1.240,50` en línea secundaria

#### Scenario: Consumo en tarjeta no reduce el disponible del Hero

- **WHEN** el usuario tiene $ 100.000 ARS disponibles y registra un consumo de $ 30.000 en su tarjeta Visa
- **THEN** el Hero sigue mostrando `$ 100.000,00`
- **AND** el consumo aparece en `/cards` y eventualmente en la sección "Lo que viene" cuando el resumen cierre

#### Scenario: Pago de resumen reduce el disponible

- **WHEN** el usuario paga el resumen de Visa por $ 145.200 desde una cuenta cash que tenía $ 287.450
- **THEN** el Hero pasa a mostrar `$ 142.250,00`

#### Scenario: Desktop muestra el desglose de cuentas; mobile no

- **WHEN** el usuario con dos cuentas cash/bank carga `/dashboard` en un viewport ≥1024px
- **THEN** el Hero muestra el disponible total y un desglose de esas cuentas con su saldo y un enlace "Ver todas las cuentas"
- **AND** en un viewport mobile el Hero muestra solo el disponible total (ARS + USD), sin desglose

### Requirement: El eye toggle enmascara todos los importes del dashboard

El sistema SHALL exponer en el header del dashboard un botón "ojo" que, al activarse, reemplaza visualmente todos los importes numéricos del dashboard por un placeholder genérico (`••••••` o equivalente) sin alterar los datos subyacentes. El estado del eye toggle SHALL ser client-side y SHALL NOT persistir entre sesiones ni navegaciones fuera del dashboard.

El toggle SHALL aplicar al menos a: Hero (importes ARS y USD, y los saldos del desglose de cuentas en desktop), Lo que viene (importes individuales y totales) y Balance del mes (importes de ingresos, gastos y balance).

#### Scenario: Activar el toggle enmascara todos los importes

- **WHEN** el usuario está en `/dashboard` con todos los importes visibles y toca el botón "ojo"
- **THEN** todos los importes numéricos visibles se reemplazan por `••••••`
- **AND** los labels, fechas y categorías permanecen visibles

#### Scenario: Salir del dashboard y volver resetea el toggle

- **WHEN** el usuario activa el toggle, navega a `/accounts` y luego vuelve a `/dashboard`
- **THEN** los importes están visibles nuevamente (estado no persistido)

### Requirement: La pantalla `(app)/dashboard` mobile renderiza las secciones del dashboard con tolerancia a fallas parciales

La pantalla `apps/mobile/app/(app)/dashboard.tsx` SHALL renderizar las **tres** secciones del dashboard en orden vertical (Hero → Lo que viene → Balance del mes) envueltas en `EyeMaskProvider`. La pantalla SHALL cargar las queries correspondientes en paralelo y SHALL tolerar fallas parciales: si una query falla, la sección correspondiente renderiza `SectionFallback` mientras las demás siguen funcionando. La pantalla NO SHALL renderizar una sección Tarjetas ni disparar `getCreditCards` como parte de la carga del dashboard.

La pantalla SHALL respetar el principio "Off-ledger credit cards" idéntico al spec web (las queries ya lo encapsulan) y SHALL usar `getTodayAR()` (o su equivalente mobile) para todo cálculo de "hoy".

#### Scenario: Las tres secciones cargan en paralelo

- **WHEN** la pantalla `dashboard` mobile monta con un usuario logueado y onboarding completado
- **THEN** las queries `getDashboardHero`, `getUpcomingFortnight` y `getMonthBalanceSeries` se disparan en paralelo
- **AND** las tres secciones renderizan independientemente a medida que sus queries resuelven
- **AND** NO se dispara `getCreditCards` para el dashboard

#### Scenario: Falla en una query no rompe la pantalla mobile

- **WHEN** la query `getUpcomingFortnight` falla (timeout, error de DB) en mobile
- **THEN** `UpcomingFortnightSection` renderiza `SectionFallback` con mensaje i18n
- **AND** Hero y Balance del mes renderizan normalmente

#### Scenario: Salir del tab dashboard y volver resetea el eye toggle (mobile)

- **WHEN** el usuario mobile activa el eye toggle, cambia al tab "movimientos" y luego vuelve a "dashboard"
- **THEN** los importes están visibles nuevamente (el provider se desmonta y se vuelve a montar)

## RENAMED Requirements

- FROM: `### Requirement: La pantalla \`(app)/dashboard\` mobile renderiza las cuatro secciones con tolerancia a fallas parciales`
- TO: `### Requirement: La pantalla \`(app)/dashboard\` mobile renderiza las secciones del dashboard con tolerancia a fallas parciales`

## REMOVED Requirements

### Requirement: La sección Tarjetas reutiliza el carrusel del módulo cards

**Reason**: Las tarjetas dejan de mostrarse en el dashboard en todas las plataformas. El resumen de tarjetas pasa a vivir únicamente en `/cards` (web) y se navega desde el `AppMenu` → `/cards` (nativo), evitando duplicar la superficie y aligerando el dashboard a tres secciones.

**Migration**: El componente `CreditCardCarousel` y la query `getCreditCards` siguen existiendo para el módulo `cards` y la pantalla `/cards`; solo se elimina su uso desde el dashboard (web y mobile). No hay cambios de datos: los balances y períodos se siguen derivando igual. Para ver tarjetas, el usuario navega a `/cards` (sidebar web "Tarjetas" / `AppMenu` nativo).
