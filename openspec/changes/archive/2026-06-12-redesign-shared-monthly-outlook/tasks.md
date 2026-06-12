# Tareas

## 1. Lógica de deuda (Opción B)
- [x] 1.1 En `getHouseholdDebt` (`apps/web/lib/shared/queries.ts`), gatear el `counts` del reintegro contra el `due_date` del **gasto linkeado** (`linked_transaction_id`), no el propio.
- [x] 1.2 Traer el `due_date` del gasto linkeado en el fetch de transacciones (segundo lookup acotado `linkedDueDateById`).
- [x] 1.3 Helper puro `reimbursementCountsTowardDebt` en `packages/money-logic/src/shared.ts`.
- [x] 1.4 Tests en `apps/web/lib/shared/__tests__/debt.test.ts`: helper + caso YPF de producción (hoy "al día", julio "$43.284"). 22 tests verdes.

## 2. Proyección mensual
- [x] 2.1 Primitivas puras `gateSplit` / `householdDebtAt` / `householdOutlook` (money-logic) + `collectDebtInputs` y `getHouseholdOutlook` (queries); `getHouseholdDebt` acepta `asOf`.
- [ ] 2.2 Agrupar planes de cuotas largos (3 meses visibles + resto agrupado) — se resuelve en la UI (tarea 4).
- [x] 2.3 Tests de la proyección (consumo de tarjeta a julio; reintegro que neteа en el mes del gasto). 26 tests verdes.

## 3. Desglose "En qué gastaron"
- [x] 3.1 `getSharedExpenses({ month })` extendida con `categoryId/color/icon`; el desglose del mes se computa en la page (gastaron juntos / tu parte / por categoría).
- [x] 3.2 Barrita apilada del handoff integrada en el hero, con filas de leyenda clickeables → `/transactions?month&category&currency`.
- [~] 3.3 Bimoneda: ARS protagonista (barrita ARS) + USD inline en el hero. Toggle ARS/USD del desglose: PENDIENTE (por ahora barrita ARS; USD se ve inline).

## 4. Layout de la home (web)
- [x] 4.1 `page.tsx` reescrito: navegador de mes (URL `?m=`), hero navy (2 métricas + USD inline + barrita), próximos compromisos, últimos movimientos. Columna única `max-w-[720px]`.
- [x] 4.2 Últimos movimientos estilo `MovementRow` (ícono de categoría tintado, taxonomía categoría › subcategoría, chip de reintegro, tono income/expense). Bespoke (no se fuerza `FinancialMovement`).
- [x] 4.3 CTA de alta: `RegisterMovementButton` (Button primary) en el header; `QuickAddFab` ya global en `AppShell` cubre mobile.
- [x] 4.4 Configuración del hogar como ícono (`Settings2`), sin texto.
- [x] 4.5 Bloque de integrantes removido de la home.

## 5. Integrantes en Configuración
- [x] 5.1 `/shared/settings` ya lista integrantes (`settings-form.tsx`, `members_title`). Sin cambios.

## 6. i18n y cierre
- [x] 6.1 Claves es/en nuevas: `to_settle`, `spent_together`, `your_month_share`, `in_the_month`, `spent_on`, `upcoming_title`; `recent_title` → "Últimos movimientos".
- [x] 6.2 Validar `openspec validate redesign-shared-monthly-outlook --strict` (válido). Build de prod OK (`/shared` compila).
- [x] 6.3 Casos de QA agregados en `docs/qa/plan-de-pruebas.md` (SHA-N2-03/04, SHA-N3-03). Ejecución manual pendiente del usuario.
- [x] 6.4 Archivar el change y sincronizar `openspec/specs/shared/spec.md` EN la branch, antes de mergear.
- [x] 6.5 Decisión visual: se mantiene la **terracota aclarada** (`#e3a395`) para "le debés" sobre el navy.
