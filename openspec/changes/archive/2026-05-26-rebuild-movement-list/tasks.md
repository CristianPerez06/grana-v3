## 1. Lógica pura en `@grana/money-logic`

- [x] 1.1 Promover `calculateTransactionSums` a `@grana/money-logic` como fuente única; reapuntar `@grana/dashboard` y `apps/web/lib/transactions/balance.ts` a esa versión y borrar el `TODO` de `packages/dashboard/src/aggregations.ts`.
- [x] 1.2 Verificar que los tests existentes del dashboard y del balance siguen pasando con la función ya compartida.
- [x] 1.3 Implementar `resolveMovementView(movement, perspective)` puro: recibe el movimiento y la perspectiva (`global` | `{ account, accountId }`), devuelve view-model neutral (`sign`, `amount`, `currencyCode`, `counterpartyLabel`, `isCategorized`, datos de cuota/pending). Sin React, i18n ni clases.
- [x] 1.4 Tests de `resolveMovementView`: transferencia y cambio de moneda en perspectiva global vs cuenta (signo, pata, contraparte); pago de resumen; ajuste ±; gasto/ingreso categorizado.
- [x] 1.5 Implementar el cálculo puro de saldo corriente (running balance) por moneda: dada la secuencia ascendente (`date ASC, created_at ASC, id ASC`) y el `initial_balance`, devuelve el acumulado tras cada movimiento.
- [x] 1.6 Tests del running balance: por moneda separada, con saldo negativo permitido, excluyendo lo que no toca disponible.
- [x] 1.7 Implementar la suma del resumen por período y moneda: "Entró"/"Salió" (regla del dashboard: excluye transfer y consumos de tarjeta; ajuste ± reparte) y "Comprometido en tarjetas" como suma aparte de consumos de tarjeta.
- [x] 1.8 Tests del resumen: separación por moneda, exclusión de transfer y consumos de tarjeta del "Salió", "Comprometido" aparte, y coincidencia con la salida de `calculateTransactionSums`.

## 2. Datos / queries (`apps/web`)

- [x] 2.1 Asegurar que la query del listado global y la del detalle de cuenta proveen lo que la fila necesita: emoji+color de categoría, datos de cuota (posición `n/N`), estado pending/paid del período de tarjeta. (La query ya traía category icon/color y status vía `TRANSACTION_SELECT`; se expusieron en `FinancialMovement` —`category_name`/`category_icon`/`category_color`— y se agregó el helper `toMovementViewInput` que arma el input puro del resolver.)
- [x] 2.2 Para la vista de cuenta sin filtros, traer los movimientos en orden cronológico ascendente por moneda para alimentar el running balance (resolver la ventana según la Open Question de costo de fetch). (`getAccountMovements` trae el historial completo de la cuenta en ASC; sin paginación porque el saldo corriente lo requiere.)
- [x] 2.3 `getTodayAR()` alimenta el `todayISO` del listado para las etiquetas Hoy/Ayer. (El resumen del período —y su control de mes— se movió al dashboard, así que el listado no tiene control de período propio en este change; la navegación por mes va al Change 2.)

## 3. Componentes de presentación (`apps/web`)

- [x] 3.1 Crear `MovementRow`: ícono por familia (categoría con emoji+color vs estructura neutra), jerarquía descripción→categoría·cuenta (cuenta solo en experto), color semántico del monto, etiqueta de moneda bimoneda-aware (ARS sin etiqueta, USD etiquetada).
- [x] 3.2 Agregar a `MovementRow` la zona de marcadores: recurrencia (↻), revisión (⚠), cuota `n/N`, pendiente — preservando recurrencia y revisión en ambas vistas. (recurrencia + revisión implementados; cuota/pendiente quedan para la vista de tarjeta, fuera de scope de este change.)
- [x] 3.3 Crear `MovementList` (client) con `perspective` como prop: agrupa por fecha con etiquetas relativas (Hoy/Ayer/fecha), renderiza `MovementRow`, mantiene la paginación "cargar más" y el orden de lectura (desc), y muestra el running balance por fila solo en perspectiva de cuenta sin filtros.
- [x] 3.4 ~~`PeriodSummary` en el listado~~ — DESCARTADO (2026-05-26): el resumen del período va en el dashboard, no en el listado (duplicaba el panorama mensual). La lógica pura `summarizePeriod` queda en `@grana/money-logic` para el dashboard; el componente y la query `getPeriodSummary` se quitaron de `/transactions`. Sí se mantiene: "sin total-por-día" en los encabezados.
- [x] 3.5 Agregar claves i18n del listado (Hoy/Ayer) en `@grana/i18n-messages`. (Las del resumen se quitaron con el `PeriodSummary`.)

## 4. Integración en las páginas

- [x] 4.1 Reapuntar `/transactions/page.tsx` a `MovementList` (`perspective` global), conservando `RecurrenceSuggestionBanner` y `PendingRecurrencesBlock`. (Sin `PeriodSummary` — el resumen va al dashboard.)
- [x] 4.2 Reapuntar `/accounts/[id]/page.tsx` a `MovementList` con `perspective={{ kind: 'account', accountId }}` + saldo de la cuenta arriba (`AccountDetailHeader`) + running balance por fila.
- [x] 4.3 Verificar que el "volver" desde el detalle (`?from=`) sigue funcionando desde ambas vistas. (El detalle ahora lee `?from`: `account:<id>` regresa a la cuenta —con su nombre como label—, si no a `/transactions`. Antes el back estaba hardcodeado a `/transactions`.)

## 5. Limpieza y verificación

- [x] 5.1 Eliminar `global-movement-list.tsx` y `transaction-list.tsx` una vez verificada la paridad de comportamiento.
- [x] 5.2 Verificar manualmente los scenarios de la spec: fila en ambas vistas, perspectiva de transfer/exchange, anatomía visual, marcadores, running balance, volver respeta origen. (Verificado por el usuario en navegador; el resumen por moneda se movió al dashboard.)
- [x] 5.3 Correr `pnpm lint` y `pnpm build` (web) sin errores. (Build de producción verde; lint sin errores —solo warnings preexistentes—; 164 tests verdes.)
- [x] 5.4 Confirmar que no hay regresiones en el detalle de compra en cuotas ni en los review flags. (Verificado por el usuario.)
