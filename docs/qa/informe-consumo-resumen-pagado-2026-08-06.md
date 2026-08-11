# Informe: consumos imputados a un resumen futuro equivocado

**Fecha:** 6 de agosto de 2026
**Change asociado:** `openspec/changes/archive/2026-08-06-fix-card-consumo-period-assignment/`
**Branch:** `bugfix/reject-card-consumo-in-paid-period`

---

## Cómo apareció

Salió de una observación de un usuario: un gasto recurrente "Finquality" con fecha **25/06/2026** figuraba imputado al resumen **24/10 → 23/11/2026** — cuatro meses adelante — y no aparecía en el resumen que le correspondía. El cartel del detalle decía *"Este consumo no afecta tu disponible hasta que pagues el resumen del 24 de oct…"*, claramente mal.

## Qué estaba pasando (en criollo)

Cuando se cargaba un consumo de tarjeta con una **fecha que caía dentro de un resumen ya pagado**, en vez de frenar y avisar, el sistema **inventaba un resumen nuevo meses adelante** (en la "frontera" de la tarjeta) y metía el consumo ahí.

Consecuencias:

- El gasto quedaba en un **resumen equivocado y futuro** (un consumo de junio imputado a octubre).
- **No figuraba** en el resumen real.
- Se acumulaban **resúmenes futuros fantasma**.

Se disparaba sobre todo con **gastos recurrentes o cargas atrasadas**: para cuando se confirmaban, el resumen real de esa fecha ya estaba pagado.

## La causa técnica

`getOrCreatePeriodForDate` (`packages/transactions-mutations/src/internal/card-periods.ts`) resuelve a qué `card_periods` se imputa un consumo. Usaba `assignTransactionToPeriod`, que **filtra los períodos pagados** (`!has_payment`). Cuando el único período que cubría la fecha estaba **pagado**, la función no lo "veía", caía a la rama de *rolling* y **creaba un período nuevo en la frontera**, asignándole el consumo — sin verificar jamás que ese período nuevo contuviera la fecha.

Esto **contradecía un requirement que ya existía** en el spec: *"El sistema rechaza registrar un consumo con fecha dentro de un período pagado"* (`period_already_paid`). El guard que debía rechazar (`register-card-purchase.ts`) era **código muerto**: nunca se alcanzaba, porque la función ya había devuelto un período recién creado (sin pagar) antes de llegar ahí.

## El arreglo

`getOrCreatePeriodForDate` ahora **clasifica** la fecha en vez de hacer *rolling* a ciegas:

- resumen **no pagado** que cubre la fecha (día de cierre incluido) → usarlo;
- resumen **pagado** que cubre la fecha → **rechazar** (`CardConsumoInPaidPeriodError` → cartel `period_already_paid`);
- fecha anterior al primer resumen → error de historial;
- fecha **estrictamente posterior** al último resumen → crear período por rolling (única rama que inserta);
- cualquier otra fecha no cubierta (hueco) → rechazar, **nunca** fabricar frontera.

El rechazo llega a los tres caminos que comparten esa función: consumo simple, cuotas y **confirmación de recurrencias**. El día de cierre sigue siendo inclusive para resúmenes abiertos.

## Alcance real en datos (producción, 6-ago-2026)

La detección (query en el `design.md` del change) encontró que el bug tocó **3 consumos en toda la app**, todos resueltos a mano:

| Caso | Usuario | Qué era | Resolución |
|---|---|---|---|
| Finquality | Cristian | consumo recurrente 25/06 mal imputado | corregido cambiando la fecha |
| Comida $12.895 (Visa Santander) | Julieta | **duplicado** (misma compra cargada dos veces) | borrado el duplicado (su reintegro se fue en cascada) |
| Consumo $27.413 (Visa Galicia) | Cristian | consumo real mal imputado | reasignado al resumen abierto correcto |

La detección sobre **todos los usuarios activos** volvió vacía tras la limpieza: no quedó ningún otro afectado.

**Falso positivo descartado:** la "proliferación de períodos futuros" en Visa Santander de Cristian **no era el bug** — eran **cuotas** legítimas de tres compras en 6 pagos, que naturalmente pueblan períodos futuros. No se tocó nada ahí.

## Lo que NO se hizo, y por qué

- **No hay migración de esquema.** Es una corrección de código.
- **No se auto-reparó la data vieja.** Adónde va un consumo cuyo resumen ya está cerrado y pagado es una decisión del dueño (correr la fecha, registrar un ajuste, o borrar si es duplicado). Se detectó y se revisó caso por caso, sin `UPDATE` a ciegas.
- **No se borraron los períodos futuros vacíos.** Son inofensivos (estimados, sin impacto en saldos) y el sistema los reconcilia solo.
