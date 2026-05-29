# Tareas — Frecuencia personalizada en recurrencias

## Grupo 1 · Migración SQL

- [ ] 1.1. Nueva migración en `supabase/migrations/` que agrega a la tabla de reglas recurrentes: `interval_count INTEGER NOT NULL DEFAULT 1` (CHECK ≥ 1), `interval_unit TEXT NOT NULL DEFAULT 'month'` (CHECK IN day/week/month/year), `max_occurrences INTEGER NULL` (CHECK NULL OR ≥ 1).
- [ ] 1.2. Extender el CHECK de `frequency` para admitir `'custom'`.
- [ ] 1.3. Backfill en la misma migración: weekly⇒(1,week), biweekly⇒(2,week), monthly⇒(1,month), annual⇒(1,year).
- [ ] 1.4. Regenerar `packages/supabase/src/types.ts` contra el proyecto remoto (`supabase gen types`).

## Grupo 2 · Lógica pura en money-logic

- [ ] 2.1. En `packages/money-logic/src/recurrences.ts`, agregar `addInterval(dateISO: string, unit: IntervalUnit, count: number): string` con clamping de fin de mes para month/year.
- [ ] 2.2. Refactor de la función de próxima ocurrencia para usar `addInterval` (eliminar el switch por enum del cálculo; el preset se resuelve a `(count, unit)` antes de llamar).
- [ ] 2.3. Helper `presetToInterval(frequency)` → `{ count, unit }` y `shouldStopGenerating({ nextDate, endDate, materializedCount, maxOccurrences })`.
- [ ] 2.4. Exportar tipos `IntervalUnit` y los helpers desde `packages/money-logic/src/index.ts`.
- [ ] 2.5. Tests en `packages/money-logic/src/__tests__/recurrences.test.ts`: cada N día/semana/mes/año, clamping 31-ene→28-feb, 29-feb→28-feb año no bisiesto, corte por end_date, corte por max_occurrences, corte por la primera condición.

## Grupo 3 · Validación

- [ ] 3.1. En `packages/validation/src/recurrences.ts`, sumar `'custom'` a `RECURRENCE_FREQUENCIES`.
- [ ] 3.2. Agregar `interval_count` (entero ≥ 1, requerido si `frequency==='custom'`), `interval_unit` (oneOf day/week/month/year, requerido si custom), `max_occurrences` (entero ≥ 1, opcional) al `recurrenceBaseSchema`.
- [ ] 3.3. Mantener el test `end_date >= start_date`. Agregar test de coherencia: si `frequency !== 'custom'`, ignorar/derivar interval.
- [ ] 3.4. Tests del schema: custom válido, custom sin interval_count falla, preset no exige interval, max_occurrences < 1 falla.

## Grupo 4 · Server actions

- [ ] 4.1. `createRecurrenceFromMovement` y `updateRecurrence` (`apps/web/app/_actions/recurrences.ts`): aceptar/derivar `interval_count`/`interval_unit`/`max_occurrences`. Para presets, derivar vía `presetToInterval`.
- [ ] 4.2. El cron/generador de instancias usa `shouldStopGenerating` y `addInterval`.

## Grupo 5 · i18n

- [ ] 5.1. Claves en `packages/i18n-messages/src/{es,en}.json`: `recurrences.frequency.custom`, `recurrences.interval.every`, `recurrences.interval.unit.{day,week,month,year}` (con plural), `recurrences.end.after_occurrences` (interpolación `{count}`).

## Grupo 6 · Verificación

- [ ] 6.1. `pnpm --filter @grana/money-logic test` y `pnpm --filter @grana/validation test` verdes.
- [ ] 6.2. `pnpm lint` y `pnpm build` (web) verdes.
- [ ] 6.3. Archivar el change (mover a `archive/`, integrar deltas en `openspec/specs/transactions/spec.md`) y `pnpm openspec:check` antes del merge.

> Nota: el **UI** del selector "Personalizado" (pills + control `cada N · unidad` + fin) NO es parte de este change — se implementa en `redesign-movement-form-as-drawer`, que depende de éste.
