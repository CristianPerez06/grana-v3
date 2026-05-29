# Rediseño visual del módulo Movimientos

## Why

El módulo `transactions` tiene la lógica contable estable (53 requirements al cierre del roadmap previo) pero su presentación visual no termina de transmitir la personalidad que el producto declara ("no es un banco, no es una planilla — sugiere y enseña"). En la pasada anterior se relevó el código actual, se compararon patrones con cinco apps comparables (Mobills, Spendee, YNAB, Splitwise y Splid) y se diseñaron doce artboards en Paper. De ese trabajo salió un set de decisiones visuales coherente que esta change implementa.

El rediseño NO cambia comportamiento contable, persistencia, ordering, ni reglas de negocio. Cambia presentación: encabezado de la pantalla, color semántico de los montos, marcadores de estado, distribución por categoría, acceso a recurrencias, y los estados de carga / vacío. Los flujos funcionales (alta, edición, eliminación, filtros, búsqueda) quedan intactos.

Decisiones de diseño tomadas (referencia visual en `docs/design/movimientos/`):

1. **Header narrativo**: el `PageHeader` genérico se reemplaza por un encabezado tipo portada (eyebrow + display de mes con navegación por mes integrada `‹ ›` + subtítulo con conteo y moneda). Sin botones CTA primary arriba — el FAB ya cubre "Registrar movimiento", y el acceso a recurrencias pasa a un **link sutil en el subtítulo** ("· Ver recurrencias →"), no a un botón secundario.
2. **Color semántico editorial**: los gastos pasan de `text-red-600` crudo a una terracota mineral (`#B56A5A`), tomada de la paleta de tokens del repo. Income se mantiene en emerald (`#10B981`). Las transferencias, cambios de moneda y ajustes neutros usan navy primario (`#0B1A2B`). Los reintegros pendientes (esperados, no recibidos) se muestran en gris medio (`text-muted`), no en verde, para distinguirlos visualmente del income real.
3. **Marcador de recurrencia con label**: el indicador actual (ícono `Repeat` 12px muted suelto) pasa a un chip slate con label "Recurrente" para que se lea como patrón en el listado, alineado al research (YNAB pinta scheduled transactions con un treatment visual fuerte; Spendee y Mobills entierran el concepto y los usuarios lo pierden).
4. **`CategorySpendingOverview` como variante híbrida**: donut estático grande (200px) con el total al centro + ranking lateral de hasta cinco categorías con meta enriquecida (porcentaje + contexto: número de movimientos, "cuotas <descripción>", "<n> recurrentes"). Footer que vuelve explícito el principio off-ledger ("Sin contar consumos en tarjeta sin pagar") y link al detalle. Reemplaza la variante anterior (que renderiza ranking puro o donut compacto según hubiera versión preliminar).
5. **Loading skeleton**: durante la carga inicial del listado, mostrar un esqueleto con la estructura de filas pero contenido placeholder, no `Spinner` centrado (que rompe la jerarquía editorial del header).
6. **Empty state contextual del mes vacío**: refinar la copy de la variante `none` del empty state para que sea contextual al mes navegado, no genérica.

## What Changes

- **MODIFIED** "La fila de movimiento muestra ícono de categoría, jerarquía y color semántico": el color del monto se especifica con tokens semánticos editoriales (`--expense` terracota para gastos, `--income` emerald para income, `text-text` navy neutro para transferencia y cambio, `text-muted` para reintegros pendientes), no con palabras genéricas "rojo / verde".
- **MODIFIED** "La fila de movimiento muestra marcadores de estado": el marcador de recurrencia se presenta como **chip con label "Recurrente"** en color slate, no como un ícono Repeat suelto inline.
- **MODIFIED** "El listado global distingue el motivo de un resultado vacío": la copy de la variante `none` SHALL ser contextual al estado del usuario (bienvenida si no tiene ningún movimiento histórico, mensaje específico del mes si solo navegó a un mes vacío).
- **ADDED** "El listado global usa un encabezado narrativo con navegación por mes integrada": eyebrow + display + nav `‹ ›` + subtítulo, sin botones CTA primary.
- **ADDED** "El acceso a la gestión de recurrencias vive en el subtítulo del encabezado": link contextual `Ver recurrencias →`, no botón.
- **ADDED** "El listado global muestra un esqueleto de filas durante la carga inicial": skeleton coherente con la anatomía de la fila, en lugar de `Spinner` centrado.
- **ADDED** "El componente de gastos por categoría usa la variante híbrida donut + ranking enriquecido": donut estático 200px + meta enriquecida en cada fila del ranking + footer con la nota off-ledger.

## Follow-up debido: redistribuir pago de resumen por categoría

El componente del breakdown ahora respeta el principio off-ledger excluyendo gastos en cuentas `type='credit'` (consumos directos y cuotas hijas tienen `card_period_id IS NOT NULL`). El footer "Sin contar consumos en tarjeta sin pagar" pasa a ser **honesto** (antes mentía).

**Pero esto deja un hueco**: hoy los consumos de tarjeta **nunca** aparecen en el breakdown — ni cuando devengan, ni cuando se pagan. La query también skippea pagos de resumen (vía `period_payments?.length > 0`) para evitar doble conteo histórico, pero ese skip ya no protege nada útil.

**Comportamiento correcto del producto (decisión del owner, mayo 2026)**: la **categoría y el monto deben impactar el breakdown del mes cuando el resumen efectivamente se paga**, distribuyendo el monto pagado entre las categorías de los consumos que ese pago cubrió. El walk es: statement payment → `card_period` → consumos del período (parent de cuotas o consumo directo) → categoría de cada uno.

Este change implementa la **mitad mecánica** (excluir consumos pendientes) pero **no la redistribución al pagar**. Se difiere a un change separado porque (a) requiere reescribir `getMonthCategoryBreakdown` para hacer el walk, (b) la decisión de cómo categorizar pagos parciales (proporcional vs FIFO) merece su propio explore, (c) afecta también a la lista de movimientos (el pago de resumen podría tener que mostrar las categorías cubiertas en su detalle).

Tracked como TODO inline en `apps/web/lib/transactions/queries.ts:getMonthCategoryBreakdown`.

## Stakeholders

- **Producto** (Cristian): valida criterio editorial, copy contextual, principio off-ledger explícito.
- **Diseño**: las decisiones quedan congeladas en este proposal y en los 12 PNGs + HTML standalone en `docs/design/movimientos/`. Futuros cambios visuales que entren en conflicto con estas decisiones DEBEN abrir un nuevo change.
- **Mobile** (tech lead): la paridad mobile se traslada por el contrato de props en `@grana/ui-contracts`. Esta change actualiza los contratos y el tech lead replica en `apps/mobile/`. La implementación mobile no es scope de este change.

## Mobile work pendiente (handoff al tech lead)

Esta change toca **únicamente `apps/web/`**. Cero archivos de `apps/mobile/` modificados. Lo que sí ya está disponible para mobile cuando el tech lead vaya a replicar (vía `packages/`):

- **Tokens semánticos editoriales** (`@grana/ui-tokens`): `--expense`, `--income`, `--neutral-amount`, `--pending` (con sus variants Tailwind si Tailwind mobile aplica).
- **PageHeader contract** (`@grana/ui-contracts`): props nuevos `eyebrow`, `monthLabel`, `monthLabelParts`, `prevMonthHref`, `nextMonthHref`, `descriptionExtras`. Opcionales — el componente mobile decide si renderearlos o caer al patrón clásico.
- **Lógica pura** (`@grana/money-logic`): `buildSliceMetaLine` con tipos `SliceMetaContext` / `SliceMetaTemplates`.
- **i18n keys** (`@grana/i18n-messages`): namespaces nuevos `transactions.spending.{eyebrow,center_label,categories_caption,off_ledger_note,see_detail,others_label,seeAllCategories,meta.*}`, `transactions.header.{eyebrow,movements_count,currencies_*,see_recurrences}`, `transactions.empty.{welcome,month}.*`, `transactions.list.recurrent_short`, `transactions.filters.{cancel,clear_search,refine,close}`.

Lo que el tech lead tiene que implementar en `apps/mobile/`:

1. **`MovementRow`** con los nuevos tokens de color (`text-expense`/`text-income`/`text-neutral-amount`/`text-pending`) y el chip slate "Recurrente".
2. **`MovementListSkeleton`** (estructura nueva, no existe en mobile).
3. **`CategorySpendingOverview`** con donut SVG (RN SVG en vez de HTML), ranking compacto de una línea y flechitas `‹ ›` al lado del label del mes.
4. **`PageHeader`** simplificado (solo title, sin actions slot).
5. **`MovementFilters`** con la micro-toolbar de tres íconos (Search expansible + Recurrencias link + Filtros). **Diferencia esperada con web**: el sheet de filtros en mobile típicamente es **bottom sheet**, no panel desde la derecha — esto es un divergence consciente del patrón web (mismo contract de props, JSX nativo).
6. **Empty states contextuales** (welcome vs month-vacío) con las keys i18n ya provistas.

La adaptación natural de cada pieza a React Native está cubierta por el principio "props contract compartido + JSX nativo por plataforma" de AGENTS.md.
