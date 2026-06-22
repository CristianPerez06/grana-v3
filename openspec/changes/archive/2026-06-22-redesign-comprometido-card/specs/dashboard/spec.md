## MODIFIED Requirements

### Requirement: La card "Comprometido" muestra los resúmenes de tarjeta y los gastos fijos del mes próximo (lente COMPROMISO)

El dashboard (web y mobile) SHALL renderizar una card **"Comprometido"** (lente COMPROMISO) que responde **"¿qué tengo que pagar y todavía no pagué?"**, con el subtítulo "Plata que ya está comprometida". En web se ubica **a la derecha de "Balance del mes"** en una fila de dos columnas; en mobile las cards se apilan (Comprometido debajo de "Balance del mes"). Esta card SHALL ser **estática "desde hoy"**: NO SHALL responder al navegador de mes. En mobile los datos llegan vía el hook `useCommittedOutlook` (TanStack) sobre `getCommittedOutlook`, con su propio loading/error in-card.

La card SHALL presentar, **por moneda y sin combinar ARS con USD** (bimoneda por defecto; el USD SHALL mostrarse de forma **consistente** en el total y en cada sección, con ceros cuando no hay actividad USD):

- Un **total a pagar** como titular = `tarjetaAPagar + recurrenciasPendientesDeConfirmar`. El total NO SHALL incluir proyecciones del mes próximo ni los ingresos recurrentes.
- Una **sección "Resúmenes de tarjeta"**: su monto = "A pagar" (resúmenes cerrados/vencidos impagos) **+ "En curso"** (el resumen abierto que está acumulando) del módulo Tarjetas — todo lo que ya debés de la tarjeta. Es la suma de consumos `pending` menos los reintegros recibidos imputados, sobre los resúmenes **ya empezados** (`start_date <= hoy`). EXCLUYE los resúmenes **futuros** (`start_date > hoy`: cuotas 2..N, períodos proyectados) — esa era la inflación. La sección SHALL listar los **3-4 consumos de mayor monto** (fecha, descripción, monto) y un enlace "ver más" cuando hay más.
- Una **sección "Recurrencias · pendientes de confirmar"** = suma de las instancias de recurrencia tipo `expense` con `status='pending'` (ya generadas, esperando confirmación del usuario). SHALL listar las **3-4 de mayor monto**. La card NO SHALL proyectar una línea de "fijos del próximo mes": una recurrencia, al llegar su momento, se vuelve "pendiente de confirmar" (y si se confirma con tarjeta de crédito, su deuda ya queda contemplada en la sección Tarjeta), por lo que una proyección futura no es una obligación presente.
- **Aviso de vencido**: cuando parte del monto "tarjeta a pagar" corresponde a resúmenes **vencidos** (`due_date < hoy`), la card SHALL mostrar un aviso compacto "incluye $X vencido"; si no hay deuda vencida, NO SHALL mostrarlo.
- **Estado con ingreso recurrente** (cuando la proyección de reglas tipo `income` del mes próximo es > 0 en la moneda): la card SHALL mostrar, **como contexto**, el ingreso recurrente "Ya entra" y una **banda de cierre neto** con `neto = ingresosRecurrentes − totalAPagar`, sin sumar el ingreso al total a pagar. Las recurrencias tipo `transfer` NO SHALL contabilizarse.
- **Etiqueta de cada movimiento listado**: descripción del movimiento; si está vacía, SHALL caer a la **subcategoría** y luego a la **categoría** (nunca un guión/blanco si hay categoría).
- **Prioridad del detalle de movimientos**: para no recargar la card, el listado de movimientos SHALL mostrarse para UNA sección priorizando **Recurrencias**: si hay recurrencias pendientes, se listan ésas; si no hay, se listan los consumos de tarjeta de mayor monto. Los subtotales de ambas secciones se muestran siempre.

Todos los importes SHALL participar del eye-mask. La proyección del ingreso recurrente del mes próximo ("Ya entra") SHALL reusar `projectUpcomingOccurrences` de `@grana/money-logic`; las pendientes de confirmar SHALL reusar `getPendingRecurrenceInstances`; el monto "a pagar" de tarjeta SHALL reusar la lógica de pendientes por resumen del módulo Tarjetas (`apps/web/lib/cards/month-summary.ts`) sin duplicar la matemática. La card SHALL tolerar datos parciales: si la query falla, SHALL mostrar un error compacto sin romper el resto del dashboard. Su estado de carga SHALL renderizarse como skeleton shape-matched (chrome/título visibles).

#### Scenario: El total a pagar suma tarjeta a pagar + recurrencias pendientes de confirmar

- **WHEN** el usuario tiene "tarjeta a pagar" por ARS $419.840 y recurrencias pendientes de confirmar por ARS $142.500
- **THEN** la card muestra el total a pagar `$562.340`
- **AND** muestra la sección "Tarjeta · a pagar" con subtotal `$419.840` y la sección "Recurrencias" con "Pendientes de confirmar" `$142.500`

#### Scenario: El monto de tarjeta = "A pagar" + "En curso" y excluye los resúmenes futuros

- **WHEN** el usuario tiene resúmenes cerrados/vencidos impagos por ARS $300.000, un resumen en curso acumulando ARS $119.840 y cuotas en resúmenes que aún no empezaron (`start_date > hoy`)
- **THEN** la sección "Resúmenes de tarjeta" muestra `$419.840` (= "A pagar" + "En curso" del módulo Tarjetas)
- **AND** NO incluye los resúmenes futuros (cuotas 2..N / períodos proyectados)

#### Scenario: La card no proyecta los fijos del próximo mes

- **WHEN** el usuario tiene reglas de recurrencia activas que recién ocurrirán el mes próximo (aún sin instancia generada)
- **THEN** la card NO muestra una línea de "fijos del próximo mes"
- **AND** sólo cuenta las recurrencias con instancia `pending` (pendientes de confirmar)

#### Scenario: Con ingreso recurrente aparece "Ya entra" y el cierre neto como contexto

- **WHEN** además del total a pagar de ARS $562.340, el usuario tiene un ingreso recurrente (sueldo) proyectado al mes próximo por ARS $1.450.000
- **THEN** la card muestra el contexto "Ya entra" con `+$1.450.000` y una banda de cierre neto indicando que arranca con `+$887.660` a favor (= 1.450.000 − 562.340)
- **AND** el total a pagar sigue siendo `$562.340` (el ingreso NO se sumó)

#### Scenario: El aviso de vencido aparece sólo cuando hay deuda vencida

- **WHEN** del monto "tarjeta a pagar" hay ARS $12.000 en resúmenes con `due_date` anterior a hoy
- **THEN** la card muestra el aviso "incluye $12.000 vencido"
- **WHEN** no hay resúmenes vencidos
- **THEN** la card NO muestra el aviso de vencido

#### Scenario: Cada sección lista sus movimientos de mayor monto

- **WHEN** la sección "Tarjeta · a pagar" cubre 11 consumos
- **THEN** la card lista los 3-4 de mayor monto (fecha, descripción, monto) y un enlace "ver más"

#### Scenario: USD consistente en total y secciones

- **WHEN** el usuario tiene actividad en ARS y consumos pendientes en USD
- **THEN** el total a pagar y cada sección muestran su línea USD (con ceros donde no hay actividad USD), sin convertir ni sumar entre monedas

#### Scenario: La card "Comprometido" se renderiza en mobile con el mismo modelo

- **WHEN** un usuario abre el dashboard nativo con deuda de tarjeta y/o recurrencias
- **THEN** la pantalla nativa muestra la card "Comprometido" debajo de "Balance del mes" con el total a pagar + las secciones Tarjeta y Recurrencias
- **AND** los datos provienen del hook `useCommittedOutlook` sobre `getCommittedOutlook`
- **AND** la card NO responde al navegador de mes

#### Scenario: La card es estática y no responde al navegador de mes

- **WHEN** el usuario navega el selector de mes a un mes anterior
- **THEN** "Balance del mes" y "¿En qué gasté este mes?" cambian al mes navegado
- **AND** la card "Comprometido" NO cambia

#### Scenario: Sin deuda ni recurrencias muestra un estado vacío neutral

- **WHEN** el usuario no tiene tarjeta a pagar, ni recurrencias pendientes, ni fijos del mes próximo
- **THEN** la card muestra un estado vacío neutral y NO desaparece del layout

#### Scenario: Los importes participan del eye-mask

- **WHEN** el usuario activa el eye toggle
- **THEN** el total a pagar, los subtotales de cada sección, los montos de los movimientos listados y el contexto de ingreso/neto quedan enmascarados
