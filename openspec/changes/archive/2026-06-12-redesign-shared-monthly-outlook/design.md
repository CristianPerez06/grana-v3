# Diseño — Rediseño de la home de Compartido (proyección mensual)

## Contexto y problema

Caso real de producción (2026-06-11): un único gasto compartido YPF de `$101.994` pagado con **tarjeta de Cristian** (50·50), más un **reintegro "a cuenta" recibido** de `$15.427`.

```
HOY (junio)                          JULIO (vence el resumen)
─────────────────────────────       ─────────────────────────────
Gasto YPF $101.994                   La cuota vence → ahora cuenta
  due_date julio → NO cuenta           Julieta debe su parte: $50.997
Reintegro $15.427 recibido
  a cuenta → cuenta YA
  (parte de Julieta $7.713 se acredita)

BALANCE: "Cristian te debe $7.713"   BALANCE: "le debés $43.284"
         ▲ el que pagó todo                   (50.997 − 7.713)
           figura debiendo
```

La matemática cierra a largo plazo, pero el estado **transitorio** invierte el signo y la pantalla no anticipa el mes próximo (la pregunta real del usuario).

## Decisiones

### D1 — El balance refleja lo impactado; la proyección da el futuro

**Decisión.** El balance de hoy refleja **lo que realmente impactó**: cada movimiento gatea por su **período propio** — el gasto por su mes de resumen/cuota, el reintegro por cuándo se recibió (un reintegro "a cuenta" recibido cuenta **hoy**, es plata que ya se movió). El estado transitorio "raro" del caso de producción NO se resuelve difiriendo el reintegro, sino **mostrando la proyección** de lo que viene.

**Por qué.** El reintegro es un movimiento impactado: Cristian recibió $15.427 y la parte de Julieta ($7.713) es real y la tiene él. Esconderla del balance de hoy (diferirla a julio) ocultaría plata que ya se movió. La cara real: **hoy Cristian te debe $7.713**; cuando en julio entre el gasto de $50.997, el neto se da vuelta y **le vas a deber $43.284**. Las dos lecturas conviven gracias a la proyección.

**Alternativa descartada (Opción B).** Atar el reintegro al período del gasto linkeado para que el balance de hoy nunca se invierta. Se descartó: escondía un movimiento ya impactado; el usuario quiere que el balance muestre lo real y que el futuro lo explique la proyección.

**Implementación.** `getHouseholdDebt` gatea el reintegro por su `due_date` propio (`received_at && !cancelled_at && countsByPeriod(due_date)`) — el comportamiento original. `collectDebtInputs` arma `ProjectableSplit` con `gateDueDate = due_date` del propio movimiento. La función pura `computeHouseholdBalances` no cambia.

```
counts(reintegro) =
  received_at != null && cancelled_at == null
  && countsByPeriod(due_date_propio, asOf)   // "a cuenta" ⇒ due_date null ⇒ cuenta al recibirse
```

### D2 — Proyección por mes (próximos compromisos)

La deuda derivada se recalcula con `asOf` corrido a cada mes futuro (julio, agosto, …): cada corrida incluye los splits cuyo `due_date` cae en/antes de ese mes. Un mes se **muestra** solo cuando algo nuevo entra (delta ≠ 0), pero se **exhibe el acumulado** del saldo a ese mes (responde "para julio vas a deber …", consistente con el balance de hoy). Cero datos nuevos: `gateSplit` + `computeHouseholdBalances` con distintos `asOf`. Se muestran 3 meses; los planes de cuotas largos se agrupan.

### D3 — Alcance ampliado: "En qué gastaron"

La home pasa de "solo deuda" a "deuda + en qué gastamos". El desglose por categoría del gasto compartido del mes reutiliza el sistema de color existente (paleta real, fallback `cat-1, cat-3, cat-6, cat-5, cat-7, cat-4, cat-2`); en el handoff es una **barrita apilada** y cada categoría **despliega abajo** los movimientos que la componen (no navega a Movimientos).

**Principio de impacto (clave).** "Gastaron juntos {mes}" y el desglose cuentan los gastos por el **mes en que impactan** (= se pagan), no por su fecha de registro: efectivo/débito por `date`, consumo de tarjeta por el `due_date` de su resumen. Un consumo de tarjeta con resumen futuro **no** cuenta en el gasto/categoría del mes actual — solo figura en "Próximos compromisos" (y aparece en "Últimos movimientos" con un tag "Impacta en {mes}"). Se implementa con `getSharedExpenses({ impactMonth })` (filtro `due_date in mes` OR `due_date null AND date in mes`); la lista de "Últimos movimientos" sí es por `date` (lo registrado ese mes).

### D4 — Bimoneda inline

ARS protagonista; USD compacto dentro de "Gastaron juntos" y "Para saldar" (no una fila aparte). Mantiene la regla de bimoneda por defecto (ARS+USD siempre, nunca fusionadas) que ya usa el "Balance del mes" del dashboard.

### D5 — Integrantes a Configuración

El bloque de integrantes deja la home (es referencia estática, no una decisión) y vive en `/shared/settings`, donde la vista readonly ya los lista. La home queda para decisiones: cuánto saldar, qué viene, en qué se gastó, qué movimiento lo explica.

### D6 — Reutilización de componentes (no romper nada)

- **Últimos movimientos:** `MovementRow` del módulo Movimientos (ícono de categoría tintado, taxonomía categoría › subcategoría, chips de estado/reintegro, monto con tono `income`/`expense`).
- **Alta de movimiento:** `Button` variant `primary` (CTA en header web) y `size="fab"` (FAB en mobile), como `QuickAddFab`.
- **Configuración del hogar:** ícono (gear `Settings` de lucide), no texto.
- **Colores de monto:** `text-income` (te deben) / `text-expense` (debés), nunca rojo. En el hero navy se usa una terracota aclarada por legibilidad (a validar vs. el blanco que usa hoy el hero).

## Riesgos

- **R1 — Números observables cambian.** La Opción B altera la deuda en escenarios con reintegros sobre gastos gateados. Cubrir con tests en `lib/shared/__tests__/debt.test.ts` (incl. el caso YPF de producción).
- **R2 — Costo de queries.** La proyección por mes corre la derivación N veces; N chico (3) y datos ya en memoria. Mantener el cálculo en una sola lectura de splits.
- **R3 — Métrica nueva.** El desglose por categoría amplía el alcance de Compartido; es decisión de producto consciente, no un agregado incidental.
