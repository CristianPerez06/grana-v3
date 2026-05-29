# Frecuencia personalizada en recurrencias

## Why

Hoy las recurrencias de v3 (`@grana/validation` → `RECURRENCE_FREQUENCIES`) soportan solo cuatro frecuencias fijas: `weekly`, `biweekly`, `monthly`, `annual`. El rediseño del form de carga de movimientos (drawer) incluye un toggle "Repetir" cuyo set de frecuencias del prototipo es `Semanal · Quincenal · Mensual · Anual · Personalizado`. Las primeras cuatro existen; **"Personalizado" no existe ni en el schema, ni en la validación, ni en la generación de fechas**.

En una definición de producto (Cristian, mayo 2026) se decidió implementar "Personalizado" como un **intervalo genérico `cada N · unidad`** (día/semana/mes/año), con **condición de fin opcional** (hasta una fecha, ya soportada por `end_date`, o tras un número de ocurrencias). El razonamiento: un intervalo genérico cubre la mayoría de los casos reales (cada 3 meses, cada 10 días, cada 2 años) con la mínima superficie de backend, y **generaliza** las cuatro frecuencias actuales en lugar de agregar un caso especial desconectado.

Decisión de diseño central: las cuatro frecuencias fijas pasan a ser **presets** del mismo modelo intervalo+unidad, de modo que la generación de fechas tenga **un solo camino** y no dupliquemos lógica. No se agrega selección de día específico (lunes / día 15) en v1 — se puede sumar después sin romper el contrato.

Este change es **fase 1** de la secuencia del rediseño del form: es dependencia de `redesign-movement-form-as-drawer` (que expone el UI de "Personalizado"). Se implementa primero porque el backend debe estar listo antes de que la UI lo consuma.

## What Changes

### A — Modelo de datos: intervalo + unidad + fin por ocurrencias

- **MODIFIED** "El usuario puede crear una regla recurrente al registrar un movimiento": la frecuencia deja de ser solo el enum de cuatro valores. La regla recurrente SHALL persistir `interval_count` (entero ≥ 1) e `interval_unit` (`day | week | month | year`). El enum `frequency` se mantiene por compatibilidad y para presets, sumando el valor `custom`.
- **ADDED** "Las frecuencias fijas son presets del modelo intervalo+unidad": `weekly` ⇒ `{1, week}`, `biweekly` ⇒ `{2, week}`, `monthly` ⇒ `{1, month}`, `annual` ⇒ `{1, year}`. `custom` ⇒ el par `interval_count`/`interval_unit` elegido por el usuario.
- **ADDED** "Condición de fin por ocurrencias": además del `end_date` ya existente, la regla SHALL aceptar `max_occurrences` (entero ≥ 1) opcional. Son mutuamente compatibles; la generación se detiene con la primera que se cumpla.
- **MODIFIED** migración SQL: agregar columnas `interval_count`, `interval_unit`, `max_occurrences` a la tabla de reglas recurrentes y backfill de las filas existentes a su preset equivalente. `frequency` admite `custom`.

### B — Generación de fechas generalizada en `@grana/money-logic`

- **MODIFIED** `packages/money-logic/src/recurrences.ts`: la función de próxima ocurrencia SHALL calcular la fecha siguiente a partir de `(date, interval_count, interval_unit)`, no de un enum. Las cuatro frecuencias fijas se resuelven vía su preset. Se mantiene el clamping de día de mes (un `monthly` desde el 31 cae al último día del mes corto) y se aplica el mismo criterio a `year`/`week`/`day`.
- **ADDED** corte por `max_occurrences`: el generador SHALL dejar de proponer instancias cuando el conteo de ocurrencias generadas alcanza `max_occurrences`, igual que ya corta por `end_date`.

### C — Validación

- **MODIFIED** `packages/validation/src/recurrences.ts`: `RECURRENCE_FREQUENCIES` suma `custom`. Cuando `frequency === 'custom'`, `interval_count` (≥ 1, entero) e `interval_unit` (`day|week|month|year`) son requeridos; cuando es un preset, se ignoran/derivan. `max_occurrences` opcional (≥ 1). Mantener el test `end_date >= start_date`.

## Stakeholders

- **Producto** (Cristian): valida que "Personalizado = cada N · unidad + fin opcional" sea el alcance correcto, y el copy del límite por ocurrencias.
- **Mobile** (tech lead): el modelo intervalo+unidad y `buildNextOccurrence` quedan en `@grana/money-logic` (paquete compartido) y la validación en `@grana/validation`. Mobile los consume directo; la UI mobile del selector "Personalizado" es scope de `redesign-movement-form-as-drawer`.

## Mobile work pendiente (handoff)

- **Contracts/lógica**: `interval_count`/`interval_unit`/`max_occurrences` y el generador generalizado ya quedan compartidos. Mobile no reimplementa cálculo de fechas.
- **i18n keys** nuevas para el copy de "Personalizado" se agregan en este change (`recurrences.frequency.custom`, `recurrences.interval.unit.{day,week,month,year}`, `recurrences.end.after_occurrences`).
