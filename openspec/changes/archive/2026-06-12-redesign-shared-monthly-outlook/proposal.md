## Why

En producción apareció un escenario que deja la home de Compartido confusa: un gasto compartido pagado **con tarjeta** (su deuda se difiere al mes del resumen, `countsByPeriod`) más un **reintegro "a cuenta" recibido hoy** (cuenta de inmediato) produce un balance **invertido** — "Cristian te debe $7.713" cuando Cristian pagó los $101.994. El número es correcto según la spec actual, pero el estado transitorio es ilegible, y la pantalla no responde la pregunta operativa real del usuario: **"¿cuánto de gastos compartidos voy a tener que pagar el mes que viene?"**.

Este change reddiseña la home `/shared` (web; mobile como referencia de paridad futura) para que:
1. el balance de hoy nunca aparezca invertido,
2. se anticipe lo que viene por mes (resúmenes de tarjeta y cuotas), y
3. se vea **en qué se gastó** de forma compartida, reusando el componente "En qué se fue" que ya existe.

El handoff visual final vive en `docs/design/shared/web/monthly-outlook-v11-claude-final.html` y `docs/design/shared/mobile/monthly-outlook-v11-claude-final.html`.

## What Changes

- **Decisión de lógica:** el balance de hoy **refleja lo impactado** — cada movimiento gatea por su período propio (gasto por su resumen/cuota; reintegro por su recepción, "a cuenta" cuenta hoy). NO se difiere el reintegro: es plata que ya se movió. El estado "raro" del caso de producción se resuelve **mostrando la proyección** del mes próximo, no escondiendo el reintegro. (Sin cambio en la matemática de deuda respecto del comportamiento original.)
- **Navegación por mes** en la home (`‹ Junio 2026 ›`), compartiendo el patrón de mes del dashboard.
- **Proyección "Próximos compromisos":** lo que entra cuando venza cada resumen/cuota futura (deuda derivada con `asOf` corrido a cada mes), en cards mensuales colapsables. Reutiliza la matemática pura existente (`computeHouseholdBalances` + `countsByPeriod`); no agrega persistencia.
- **Desglose "En qué gastaron":** gasto compartido del mes por categoría (barrita apilada + leyenda clickeable que lleva a los gastos de esa categoría), bimoneda con toggle ARS/USD. Reutiliza el sistema de color de categorías (`spending-donut`/`category-spending-overview`).
- **Bimoneda inline:** ARS protagonista + USD compacto dentro de "Gastaron juntos" y "Para saldar" (sin fila aparte).
- **Últimos movimientos** replicando el `movement-row` del módulo Movimientos (ícono de categoría tintado, título, taxonomía categoría › subcategoría, chips de estado, monto con tono income/expense).
- **Integrantes salen de la home → Configuración del hogar:** el bloque de integrantes deja de mostrarse en `/shared` y vive en `/shared/settings` (donde la vista readonly ya los lista).
- **CTA de alta de movimiento** con el `Button` de la librería (CTA primary en header web; FAB `size="fab"` en mobile) y **Configuración del hogar como ícono** (gear), no como texto.

## Capabilities

### New Capabilities
<!-- Ninguna. Todo cae bajo `shared`. -->

### Modified Capabilities

- `shared`: (1) el requirement del **reintegro** cambia su regla de gating de deuda (Opción B: hereda el período del gasto linkeado); (2) el requirement del **dashboard** se reescribe: navegación por mes, proyección de próximos compromisos, desglose de gasto por categoría, últimos movimientos estilo Movimientos, CTA de alta e ícono de configuración; (3) el bloque de **integrantes** se **remueve** de la home (se conserva en `/shared/settings`).

## Impact

- **Web:** `apps/web/app/(app)/shared/(home)/page.tsx` (reescritura de layout), `apps/web/lib/shared/queries.ts` (gating Opción B en `getHouseholdDebt`; nueva proyección por mes; desglose de categorías compartidas por mes/moneda). Reutiliza `CategorySpendingOverview`/`SpendingDonut`, `MovementRow`, `Button` (variant primary, size fab), ícono `Settings` de lucide.
- **money-logic:** `packages/money-logic/src/shared.ts` — la decisión de gating del reintegro puede expresarse en el armado de `DebtMovementSplit.counts` (en la query) reusando `countsByPeriod` contra el `due_date` del gasto linkeado; evaluar si conviene un helper puro.
- **Sin cambios** en mutaciones de gasto/reintegro/liquidación, RLS, ni en el ledger personal. La deuda sigue derivada y nunca persistida.
- **Specs:** delta en `shared`. Sin tocar otras capabilities.
- **Mobile:** diferido (la ruta nativa de Compartido no existe); el mock mobile es referencia de paridad.
- **Riesgo:** la Opción B cambia números observables de deuda en escenarios con reintegros sobre gastos gateados — cubrir con tests en `lib/shared/__tests__/debt.test.ts`.
