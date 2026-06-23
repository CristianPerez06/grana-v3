## Why

Es el **Paso 2** del rediseño de Compartido (`docs/design/shared/decisiones-rediseno.md`): alinear la **base contable** del módulo con el resto de la app, sobre la seguridad ya estabilizada en el Paso 1. Hoy Compartido usa un reloj distinto para "qué gastamos juntos": lo cuenta por **impacto** (cuándo se paga), mientras el dashboard y el módulo `spending-by-category` ya cuentan por **devengado** (cuándo se compra). Esa inconsistencia hace que un consumo compartido de tarjeta con resumen futuro **no aparezca** en "Gastaron juntos" del mes en que se compró, contradiciendo el modelo de las tres lentes. Además quedaron dos huecos del backlog: la **bimoneda USD** está incompleta en el desglose por categoría (B3) y el formulario de **saldar** se saltea el aviso transversal de **saldo negativo** (B4).

## What Changes

- **"Gastaron juntos" y "En qué gastaron" pasan a DEVENGADO.** El gasto del hogar del mes y su desglose por categoría se cuentan por **fecha de compra** (cash/débito por su fecha, consumo de tarjeta por su fecha de compra —no por el resumen—, y cada **cuota** en **su** mes), reutilizando el reloj devengado que ya usa el dashboard (`category-spending-accrual`). **BREAKING (de comportamiento):** un consumo compartido de tarjeta comprado este mes con resumen el mes próximo **ahora SÍ cuenta** en "Gastaron juntos" y en el desglose de este mes (antes no).
- **La deuda / cuenta corriente NO cambia.** Sigue en reloj de **impacto** (`countsByPeriod` por vencimiento) — ya es correcto. El desfasaje gasto-devengado vs deuda-impacto es deliberado (igual que CONSUMO vs CAJA en Movimientos).
- **Se conserva que /shared muestra el TOTAL del hogar** (ambas partes) en "Gastaron juntos" y el desglose —no la parte propia, a diferencia del dashboard—; lo único que cambia es el **reloj**, no el total-vs-parte-propia. "Tu parte" sigue derivándose del total.
- **B3 · Bimoneda USD completa.** El desglose por categoría se calcula y se muestra para **ARS y USD** (hoy el breakdown es solo ARS). La proyección ya es bimoneda; se asegura su consistencia. USD se subordina visualmente pero nunca se esconde (bimoneda por defecto).
- **B4 · Aviso de saldo negativo al saldar.** El formulario de saldar muestra el aviso **no bloqueante** de saldo negativo cuando la cuenta elegida quedaría en `disponible < 0`, reutilizando el util transversal (`checkNegativeBalance` / `NegativeBalanceNotice`) que ya usa el alta de movimiento. Informa, no impide.

## Capabilities

### New Capabilities
<!-- Ninguna: todo modifica la capability `shared` existente. -->

### Modified Capabilities
- `shared`: "Gastaron juntos" y "En qué gastaron" pasan de reloj de impacto a **devengado** (por fecha de compra; cuotas mes a mes), conservando el total del hogar; el desglose por categoría se completa en **ARS y USD**; y el flujo de **saldar** suma el aviso no bloqueante de saldo negativo. La deuda derivada (impacto) y su proyección no cambian.

## Impact

- **`apps/web/lib/shared/queries.ts`** — el cálculo de "Gastaron juntos" + desglose por categoría deja de scopearse por `impactMonth` (due_date) y pasa a scoping **devengado** por fecha de compra, reutilizando el patrón de `packages/dashboard/src/queries.ts` (`getMonthCategoryBreakdown`: filtro por `date`, cuotas hijas por su fecha, excluir parents y períodos pagados) pero **sumando el total del hogar** y devolviendo **ambas monedas**. Probable nueva función `getSharedSpendingBreakdown` (o ampliación de `getSharedExpenses` con modo `accrualMonth`).
- **`apps/web/app/(app)/shared/(home)/page.tsx`** — usar el dataset devengado para "Gastaron juntos" + desglose; renderizar el breakdown **USD** además del ARS (hoy solo `arsBreakdown`). La deuda, la proyección y "Últimos movimientos" no cambian de fuente.
- **`apps/web/app/(app)/shared/settle/_components/settle-form.tsx`** — importar y mostrar `NegativeBalanceNotice` cuando el monto a pagar deje la cuenta origen en negativo (con `checkNegativeBalance` sobre el `disponible` de la cuenta elegida).
- **`openspec/specs/shared/spec.md`** — actualizar el requirement "El usuario puede ver el dashboard del hogar" (scenarios de "Gastaron juntos"/"En qué gastaron" pasan a devengado; el de "consumo de tarjeta futuro no cuenta" se invierte) y el de saldar (sumar el scenario del aviso de saldo negativo).
- **Sin migraciones** (es lógica de lectura + UI). **Sin cambios de contrato para mobile** (la capa compartida/contratos quedan estables; la lógica pura reutilizada vive en `money-logic`/`dashboard`).
- **Tests** de la lógica devengada compartida (por fecha de compra, cuotas mes a mes, ARS+USD, total del hogar) en `apps/web/lib/shared/__tests__/`.
