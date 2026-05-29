# Diseño — Frecuencia personalizada en recurrencias

## Contexto

El generador actual mapea un enum de cuatro valores a un salto de fecha fijo. Agregar "Personalizado" como un quinto caso especial duplicaría lógica y dejaría dos caminos de generación que pueden divergir. La decisión es **invertir la relación**: el modelo base es `(interval_count, interval_unit)` y las cuatro frecuencias nombradas son presets que resuelven a ese par.

## Decisiones

### D1 — Persistir intervalo+unidad, mantener `frequency` como etiqueta

Se agregan tres columnas a la tabla de reglas recurrentes (la creada en `2026-05-19-add-recurring-movements`):

- `interval_count INTEGER NOT NULL DEFAULT 1` — CHECK `>= 1`.
- `interval_unit TEXT NOT NULL DEFAULT 'month'` — CHECK `IN ('day','week','month','year')`.
- `max_occurrences INTEGER NULL` — CHECK `max_occurrences IS NULL OR max_occurrences >= 1`.

`frequency` se mantiene (no se dropea) y suma `'custom'` al CHECK. Razón: `frequency` sigue siendo la etiqueta que la UI muestra ("Mensual", "Personalizado") y permite distinguir un preset de un intervalo a medida sin inferirlo. Para filas preset, `interval_count`/`interval_unit` son redundantes pero se persisten igual (fuente única para el generador).

Backfill de filas existentes:

| frequency | interval_count | interval_unit |
|---|---|---|
| weekly | 1 | week |
| biweekly | 2 | week |
| monthly | 1 | month |
| annual | 1 | year |

`max_occurrences` queda `NULL` (las reglas existentes no tienen límite por conteo).

### D2 — Un solo generador en money-logic

`recurrences.ts` expone `addInterval(dateISO, unit, count)` y la generación de la próxima fecha lo usa siempre. El enum no entra al cálculo: el caller (action) resuelve el preset → `(count, unit)` antes de llamar.

Clamping de fin de mes: `addInterval('2026-01-31', 'month', 1)` ⇒ `2026-02-28` (último día válido), consistente con el comportamiento mensual actual. Para `year`, el 29-feb cae a 28-feb en años no bisiestos. `week`/`day` son aritmética de días, sin clamp.

### D3 — Corte de generación

El generador secuencial (una instancia pendiente por vez, ya especificado) corta cuando se cumple **la primera** de:

- la próxima fecha supera `end_date` (comportamiento actual), o
- el número de instancias ya materializadas (confirmadas + omitidas + la pendiente viva) alcanza `max_occurrences`.

Ambas condiciones conviven. Si las dos están seteadas, gana la que ocurra antes.

### D4 — Unidades soportadas y límites

`interval_unit ∈ {day, week, month, year}`. `interval_count` razonable: 1–365 (CHECK blando en validación, no en DB más allá de `>= 1`). No se soporta "día específico del mes/semana" en v1 — explícitamente fuera de alcance para no introducir reglas de calendario (BYDAY/BYMONTHDAY estilo RRULE).

## Riesgos

- **Migración con backfill**: las filas existentes deben quedar con preset correcto antes de que el generador deje de leer el enum. La migración hace el backfill en la misma transacción que agrega las columnas.
- **Compatibilidad de la action**: `createRecurrenceFromMovement` y `updateRecurrence` deben empezar a pasar `interval_count`/`interval_unit`. Para presets, los deriva; no rompe llamadores que solo mandan `frequency` preset.

## Alternativas descartadas

- **RRULE completo (iCal)**: sobredimensionado para el caso de uso; introduce parsing y reglas de calendario que nadie pidió.
- **"Personalizado" como caso especial separado del enum**: deja dos caminos de generación; descartado por D2.
