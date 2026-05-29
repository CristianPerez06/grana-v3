# Tareas — Frecuencia personalizada en recurrencias

## Grupo 1 · Migración SQL

- [x] 1.1. Nueva migración en `supabase/migrations/` que agrega a la tabla de reglas recurrentes: `interval_count INTEGER NOT NULL DEFAULT 1` (CHECK ≥ 1), `interval_unit TEXT NOT NULL DEFAULT 'month'` (CHECK IN day/week/month/year), `max_occurrences INTEGER NULL` (CHECK NULL OR ≥ 1). → `0021_custom_recurrence_frequency.sql`
- [x] 1.2. Extender el CHECK de `frequency` para admitir `'custom'`.
- [x] 1.3. Backfill en la misma migración: weekly⇒(1,week), biweekly⇒(2,week), monthly⇒(1,month), annual⇒(1,year).
- [x] 1.4. Regenerar `packages/supabase/src/types.ts` contra el proyecto remoto (`supabase gen types`). → Editado a mano (Supabase es online-only; sin credenciales en el entorno). Regenerar oficialmente al aplicar la migración en el dashboard.

## Grupo 2 · Lógica pura en money-logic

- [x] 2.1. En `packages/money-logic/src/recurrences.ts`, agregar `addInterval(dateISO, unit, count, options)` con clamping de fin de mes para month/year.
- [x] 2.2. Refactor de `getNextRecurrenceDate` para usar `addInterval` (el preset se resuelve a `(count, unit)` vía `presetToInterval`; el enum ya no entra al cálculo).
- [x] 2.3. Helper `presetToInterval(frequency)` → `{ count, unit }`. El corte por fin lo resuelve `decideRecurrenceInstance` (reason `max_occurrences_reached` / `past_end_date`) usando `materializedCount`.
- [x] 2.4. Exportar `IntervalUnit`, `addInterval`, `presetToInterval` desde `packages/money-logic/src/index.ts` (vía `export *`).
- [x] 2.5. Tests: en `apps/web/lib/recurrences/__tests__/custom-frequency.test.ts` (los tests de recurrencias del repo viven en `apps/web` vía re-exports). Cubre cada N día/semana/mes/año, clamping 31-ene→28-feb, 29-feb→28-feb, corte por max_occurrences, precedencia has_pending.

## Grupo 3 · Validación

- [x] 3.1. En `packages/validation/src/recurrences.ts`, sumar `'custom'` a `RECURRENCE_FREQUENCIES` (con `RECURRENCE_PRESET_FREQUENCIES` para suggestions/accept, que solo emiten presets).
- [x] 3.2. Agregar `interval_count` (entero ≥ 1, requerido si custom), `interval_unit` (oneOf day/week/month/year, requerido si custom), `max_occurrences` (entero ≥ 1, opcional) al `recurrenceBaseSchema`, `createRecurrenceFromMovementSchema` y `updateRecurrenceSchema`.
- [x] 3.3. Mantenido el test `end_date >= start_date`. La coherencia preset/custom se logra con `.when('frequency', is:'custom')`: presets no exigen interval.
- [x] 3.4. Tests del schema (en `custom-frequency.test.ts`): custom válido, custom sin interval_count falla, preset no exige interval, max_occurrences < 1 falla, interval_count no entero falla.

## Grupo 4 · Server actions

- [x] 4.1. `createRecurrenceFromMovement` y `updateRecurrence` aceptan/derivan `interval_count`/`interval_unit`/`max_occurrences` (presets vía `presetToInterval`).
- [x] 4.2. El generador `generateDueRecurrenceInstances` pasa interval + `max_occurrences` + `materializedCount` (conteo de instancias por regla) a `decideRecurrenceInstance`.

## Grupo 5 · i18n

- [x] 5.1. Claves en `packages/i18n-messages/src/{es,en}.json`: `recurrences.frequencies.custom`, `recurrences.frequencies_lower.custom`, `transactions.frequencies.custom`, y grupo `recurrences.custom_interval` (`every`, `units.{day,week,month,year}` con plural ICU, `end_after_occurrences`).

## Grupo 6 · Verificación

- [x] 6.1. Tests verdes: `pnpm --filter web test -- lib/recurrences` → 288 passed (money-logic y validation se ejercitan vía los tests de `apps/web`).
- [x] 6.2. `pnpm --filter web typecheck` limpio; `pnpm lint` 0 errores (2 warnings preexistentes ajenas al change); `pnpm build` verde.
- [x] 6.3. Archivar el change (mover a `archive/`, integrar deltas en `openspec/specs/transactions/spec.md`) y `pnpm openspec:check` antes del merge.

> Nota: el **UI** del selector "Personalizado" (pills + control `cada N · unidad` + fin) NO es parte de este change — se implementa en `redesign-movement-form-as-drawer`, que depende de éste.
