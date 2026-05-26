## Context

El listado de movimientos vive hoy en dos componentes paralelos que ya divergieron:

- `apps/web/lib/transactions/components/global-movement-list.tsx` (`GlobalMovementList`): client component, usado en `/transactions`, consume el union `FinancialMovement` (mapeado por una query/mapper global), muestra íconos por tipo, review flags y recurrencia.
- `apps/web/lib/transactions/components/transaction-list.tsx` (`TransactionList`): server component, usado en `/accounts/[id]`, consume `TransactionWithDetails` y recalcula la presentación en una función local `getRowMeta`. **No** muestra review flags ni recurrencia.

La lógica de "cómo se ve un movimiento" está duplicada (mapper de `FinancialMovement` + `getRowMeta`), con la lógica de perspectiva de cuenta (entrante/saliente, pata del exchange) solo en `getRowMeta`. Además, `@grana/dashboard` ya tiene un `TODO` documentado: `calculateTransactionSums` está duplicado con `apps/web/lib/transactions/balance.ts` y debe moverse a un package compartido. Este change ejecuta esa unificación y, sobre la base limpia, rediseña la fila y agrega el resumen por moneda y el saldo corriente.

Restricciones del dominio que condicionan el diseño: **bimoneda** (ARS y USD nunca se suman; ARS primaria), **off-ledger credit cards** (los consumos no reducen `disponible`), **derived balances** (nunca persistir saldos), **modo novato/experto** (solo UI), `Money` + `decimal.js` para toda aritmética monetaria.

## Goals / Non-Goals

**Goals:**
- Eliminar la duplicación: un solo resolver puro + un solo componente de fila + una sola lista, parametrizados por perspectiva.
- Mover la lógica pura (resolución de perspectiva, sumas del resumen, saldo corriente) a `@grana/money-logic`, testeable y reutilizable.
- Rediseñar la anatomía de la fila (ícono de categoría, jerarquía, color semántico, etiqueta de moneda, marcadores) sin perder nada de lo actual (recurrencia, review flags, detalle de cuotas).
- Agregar el encabezado de período con resumen por moneda + "Comprometido en tarjetas", navegación por mes, y saldo corriente por fila en la vista de cuenta — todo consistente con el dashboard.

**Non-Goals:**
- Filtros (barra/chips/sheet), búsqueda instantánea y filtro de moneda → Change 2.
- Form único crear/editar y colapso de rutas scoped → Change 3.
- Quick-add/FAB, detalle como drawer, empty states de 3 variantes → Change 4.
- Paridad mobile (la maneja el tech lead; el resolver puro queda disponible en `money-logic`).
- Cambios de base de datos: no hay migraciones; todo es presentación + cálculo derivado.

## Decisions

### Decisión 1: un resolver puro `resolveMovementView(movement, perspective)` en `@grana/money-logic`

La lógica que hoy está partida entre el mapper global y `getRowMeta` se concentra en una función pura que recibe el movimiento y una perspectiva (`{ kind: 'global' }` o `{ kind: 'account', accountId }`) y devuelve un view-model neutral de presentación: `{ sign, amount, currencyCode, counterpartyLabel, isCategorized, ... }`. No conoce React, i18n ni Tailwind: devuelve datos, no JSX ni clases.

- **Por qué money-logic y no apps/web**: la resolución de perspectiva es lógica de dominio cross-platform (mobile la necesitará igual). Encaja con la política del repo (lógica pura → `packages/`) y con el `TODO` ya escrito.
- **Alternativa descartada**: dejar la lógica en un helper de `apps/web`. Re-duplicaría en mobile y mantiene la lógica lejos de los tests puros existentes de money-logic.

### Decisión 2: `MovementRow` + `MovementList` client, perspectiva como prop

Un único `<MovementList perspective={...} movements={...} />` reemplaza a `GlobalMovementList` y `TransactionList`. Internamente agrupa por fecha y renderiza `<MovementRow>` por cada movimiento. La perspectiva se pasa como prop: `/transactions/page.tsx` pasa `{ kind: 'global' }`; `/accounts/[id]/page.tsx` pasa `{ kind: 'account', accountId }`.

- **Client component**: hoy `GlobalMovementList` ya es client y `TransactionList` es server; se unifica a **client** porque la interactividad de Changes 2 (filtros/búsqueda instantánea) y 4 (quick-add) lo requiere. La página server sigue fetchando y pasa los datos ya resueltos (el resolver es puro, corre en server o client indistintamente).
- **Labels/íconos/colores**: viven en el componente web (i18n via `next-intl`, emoji+color desde la categoría, clases Tailwind), no en el resolver. El componente nativo de mobile reusará el resolver con su propia capa visual.

### Decisión 3: el resumen reusa la lógica de sumas del dashboard (promovida a money-logic)

`calculateTransactionSums` (hoy duplicada en `apps/web/lib/transactions/balance.ts` y `@grana/dashboard`) se promueve a `@grana/money-logic` como fuente única; `@grana/dashboard` la importa de ahí (cierra el `TODO`). La función de resumen `summarizePeriod` usa la misma regla y queda en money-logic **para el dashboard** (no para el listado, ver Decisión 5), por lo que el "Salió" coincidirá con el balance del mes por construcción.

- **Regla de "Salió"** (idéntica al dashboard): excluye `transfer` (no cambia patrimonio) y excluye consumos de tarjeta (su `account_id` es la tarjeta, off-ledger); `adjustment` positivo suma a "Entró", negativo a "Salió".
- **"Comprometido en tarjetas"**: suma aparte de las **cuotas de tarjeta que devengan en el período** (una compra en N cuotas aporta solo la cuota del mes, no su total), por moneda; nunca se mezcla con "Salió". Refleja cuánto de tarjeta *pesa* ese mes, no lo cargado por fecha de compra. No incluye la deuda acumulada histórica (eso vive en `/cards`). Decidido con el usuario durante la implementación (2026-05-26): cuenta cuotas devengadas, no la operación de compra.
- **Por moneda**: todas las sumas se devuelven por `currency_code`; la UI muestra una línea por moneda presente.

### Decisión 4: saldo corriente (running balance) derivado, solo en perspectiva de cuenta sin filtros

Función pura en money-logic que, dada la secuencia de movimientos de una cuenta **en orden cronológico ascendente** (`date ASC, created_at ASC, id ASC` — el orden de cálculo del dominio) y por moneda, produce el saldo acumulado tras cada movimiento partiendo de `initial_balance`. La lista lo muestra alineado a cada fila.

- **Solo sin filtros**: un acumulado sobre un subconjunto filtrado mentiría; cuando hay filtros activos la columna se oculta. En perspectiva global no se calcula (mezcla cuentas/monedas).
- **Orden**: la lista se muestra en orden descendente (lectura), pero el running balance se calcula en ascendente y luego se asocia a cada fila — los dos órdenes deterministas del dominio conviven sin mezclarse.
- **No se persiste** (regla "derived balances").

### Decisión 5: el resumen del período vive en el dashboard, no en el listado

Tras verlo implementado, se decidió (2026-05-26) que `/transactions` **NO** muestra el resumen del período: duplicaba el panorama mensual que ya da el dashboard. El listado queda como la lista pura (filtros + movimientos + fila rediseñada). La lógica pura del resumen (`summarizePeriod`, por moneda, regla del dashboard, comprometido = cuotas devengadas) **permanece en `@grana/money-logic`** lista para que el dashboard la consuma en un change futuro. El "hoy" para las etiquetas Hoy/Ayer se computa con `getTodayAR()` (timezone financiera), no con `new Date()`. La navegación por mes (control de período = filtro) queda para el Change 2.

## Risks / Trade-offs

- **[Reescritura amplia de componentes de lista]** → Es la causa raíz del bug por omisión; se mitiga manteniendo el comportamiento existente como red de seguridad (review flags, recurrencia, paginación, transferencias entrantes, detalle de cuotas) y cubriéndolo con los scenarios de la spec antes de borrar los componentes viejos.
- **[Doble "rojo" consumo de tarjeta + pago de resumen]** → El consumo va en rojo (es gasto) y el pago de resumen también (sale del disponible); el resumen separa "Comprometido" de "Salió" para que el usuario no sume mentalmente dos veces lo mismo. El color comunica "es un gasto"; el marcador "pendiente" y la línea "Comprometido" comunican el estado off-ledger.
- **[Running balance costoso o desalineado con la paginación]** → Calcular el acumulado exige traer los movimientos de la cuenta en orden ascendente por moneda; se acota al alcance de la vista de cuenta sin filtros y se evalúa el costo de traer el historial necesario. Si la paginación complica el acumulado correcto, se prioriza la corrección (ocultar antes que mostrar un número dudoso).
- **[Consistencia con el dashboard a futuro]** → Al compartir `calculateTransactionSums`, cualquier cambio de regla impacta ambas pantallas; es deseable (single source of truth) pero exige tests sobre la función promovida.

## Migration Plan

1. Promover `calculateTransactionSums` a `@grana/money-logic`; reapuntar `@grana/dashboard` y `apps/web/lib/transactions/balance.ts` a la versión compartida (cerrar el `TODO`).
2. Crear `resolveMovementView` y el cálculo de running balance (puros, con tests) en money-logic.
3. Construir `MovementRow`, `MovementList` y `PeriodSummary` en `apps/web`.
4. Reapuntar `/transactions/page.tsx` y `/accounts/[id]/page.tsx` al nuevo `MovementList` con su perspectiva; agregar las claves i18n.
5. Eliminar `global-movement-list.tsx` y `transaction-list.tsx` una vez que la paridad de comportamiento esté verificada.

Rollback: como no hay cambios de base de datos ni de contrato de datos persistido, revertir es volver al commit anterior (los componentes viejos vuelven con el revert).

## Open Questions

- ¿El running balance se calcula sobre todo el historial de la cuenta o se acota a una ventana (p. ej. el mes navegado)? A resolver al medir el costo de fetch; afecta la query de la vista de cuenta.
- ¿El encabezado de período se muestra también en la vista de cuenta con la misma forma (Entró/Salió/Comprometido) además del saldo actual de la cuenta, o la vista de cuenta privilegia el saldo + running balance? Decisión fina de UI a confirmar en implementación.
