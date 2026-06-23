## Context

Grana ya tiene tres lentes con relojes propios (ver `category-spending-accrual` y la memoria `spending-accrual-and-lenses`): CONSUMO/devengado (por fecha de compra), CAJA/impacto (cuando la plata se mueve), COMPROMISO/proyección. Compartido las proyecta al hogar, pero su home quedó contando "Gastaron juntos" por **impacto** (`getSharedExpenses(supabase, { impactMonth })` → scoping por `due_date`), mientras el dashboard ya cuenta por **devengado** (`packages/dashboard/src/queries.ts` → `getMonthCategoryBreakdown`, scoping por `date`, incluyendo consumos y cuotas por su propia fecha). Este paso alinea el reloj del gasto compartido con el devengado, dejando la deuda en impacto.

Restricciones (AGENTS.md): bimoneda separada (ARS/USD nunca se fusionan, USD subordinado pero nunca oculto); `Money`/`decimal.js`; lógica pura reutilizable en `packages/money-logic` y `packages/dashboard`; mobile lo lleva el tech lead (dejar contratos estables). Sin DB local (online-only) — este paso no necesita migración.

## Goals / Non-Goals

**Goals:**
- "Gastaron juntos" y "En qué gastaron" cuentan por **fecha de compra** (devengado): cash/débito por su fecha, consumo de tarjeta por su fecha (no por el resumen), cada **cuota** en **su** mes.
- El desglose por categoría se calcula y muestra en **ARS y USD** (B3).
- El form de **saldar** muestra el aviso no bloqueante de **saldo negativo** (B4).
- Reutilizar la lógica devengada y el util de aviso ya existentes, sin duplicar reglas contables.

**Non-Goals:**
- **No** tocar la **deuda / cuenta corriente / proyección**: siguen en reloj de impacto (correcto).
- **No** cambiar que /shared muestra el **total del hogar** (ambas partes): el cambio es de reloj, no de total-vs-parte-propia.
- **No** es el rediseño visual (A2 navegador, A3 neto protagonista, cuenta corriente nueva): eso es el Paso 3.
- **Sin** migraciones; **sin** cambios de contrato para mobile.

## Decisions

### D1 · "Gastaron juntos" + desglose: reusar el reloj devengado del dashboard, sumando el total del hogar y en ambas monedas

**Decisión:** reemplazar el dataset `impactMonth` por un scoping **devengado** que mirroree `getMonthCategoryBreakdown` del dashboard (filtro por `date`; excluir `is_parent`; excluir consumos de tarjeta cuyo período ya fue pagado igual que el dashboard; cada cuota hija cuenta por su fecha) — **pero** sumando `amount` (total del hogar, ambas partes) en vez de la parte propia, y devolviendo **`ARS` y `USD`**. Implementarlo como una función de lectura nueva en `apps/web/lib/shared/queries.ts` (p. ej. `getSharedSpendingBreakdown(supabase, month)`), no en page.tsx.

**Por qué reusar el patrón del dashboard:** el devengado tiene sutilezas ya resueltas (cuotas mes a mes, exclusión de parents y de consumos ya pagados, reintegros que netean). Reescribirlo a mano en la home arriesga divergencia con el resto de la app. La diferencia legítima de Compartido es **el agregado (total del hogar) y la doble moneda**, no el reloj.

**Alternativa descartada:** seguir usando `getSharedExpenses({ month })` (scoping por `date`) tal cual. Riesgo: ese filtro plano por `date` no replica exactamente las exclusiones del devengado del dashboard (parents, consumos pagados, cuotas) y podría contar distinto. Mejor un solo reloj canónico.

### D2 · La deuda y la proyección no cambian

**Decisión:** `getHouseholdDebt` / `getHouseholdOutlook` (reloj de impacto, `countsByPeriod` por vencimiento) quedan **intactos**. Solo cambia el número de "gasto del mes" y su desglose.

**Por qué:** el desfasaje gasto-devengado vs deuda-impacto es el modelo correcto (testigo del usuario: "gastamos $100 en nafta este mes pero como lo pagamos con crédito, aún no nos debemos nada"). El gasto cuenta hoy (devengado); la deuda nace al pagar (impacto).

### D3 · B3 — USD en el desglose, subordinado pero nunca oculto

**Decisión:** la función de desglose devuelve `{ ARS: Slice[], USD: Slice[] }`; la home renderiza el breakdown USD además del ARS (hoy solo `arsBreakdown`), con USD subordinado (tipografía menor) y **siempre visible aunque sea cero** (bimoneda por defecto). El drill inline por categoría se conserva para ambas monedas.

### D4 · B4 — aviso de saldo negativo al saldar, reutilizando el util transversal

**Decisión:** en `settle-form.tsx`, calcular `checkNegativeBalance(disponibleDeLaCuentaElegida, monto)` y renderizar `NegativeBalanceNotice` cuando dé negativo. **No bloquea** el pago (regla transversal: informa, no impide). Necesita el `disponible` por cuenta — ya se trae el listado de cuentas a la página de saldar; si falta el disponible, traerlo igual que el alta de movimiento.

**Por qué reusar:** es exactamente la misma regla y el mismo componente del alta de movimiento; no se inventa copy ni lógica nueva.

## Risks / Trade-offs

- **[Cambio de comportamiento visible: el gasto del mes "sube" respecto de antes]** → Mitigación: es el objetivo (alinear con el dashboard). Se documenta en el spec (los scenarios se invierten) y se valida en el QA integral del cierre del paso.
- **[Divergencia entre el devengado del dashboard y el de Compartido]** → Mitigación: reusar el mismo patrón/utilidades (`computeCategoryNet`, scoping por `date`, mismas exclusiones); cubrir con tests que comparen casos testigo (consumo de tarjeta con resumen futuro cuenta este mes; cuota cuenta en su mes).
- **[El total del hogar vs parte propia se confunde con el bug que arregló `spending-counts-shared-split`]** → Mitigación: aquel cambio fue para el **dashboard** (parte propia); en /shared el total del hogar es deliberado. Dejarlo explícito en el spec y en comentarios.
- **[B4 necesita el `disponible` por cuenta en la ruta de saldar]** → Mitigación: si la query actual de cuentas no lo trae, reutilizar la misma fuente que el alta de movimiento; es lectura, sin migración.

## Open Questions

- Ninguna que bloquee. Presentación visual fina (cómo se muestran las dos monedas del desglose, layout) se afina en el Paso 3; acá USD entra subordinado y siempre visible, sin rediseñar la home.
