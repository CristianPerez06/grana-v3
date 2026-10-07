## 1. Códigos de guarda en el package

- [x] 1.1 Definir `RecurrenceGuardCode` en `packages/recurrences/src/mutations.ts` (unión de strings) y sumar `guardCode?: RecurrenceGuardCode` y `guardParams?: Record<string, string | number>` a `RecurrenceActionResult`; verificar con `pnpm --filter @grana/recurrences typecheck` o `pnpm typecheck` que compila.
- [x] 1.2 Poner `guardCode` en cada retorno `ok: false` con `formError` de `mutations.ts` y `link.ts` (los 33), conservando el texto; los errores del motor (`insertError?.message`, `written.error?.message`) llevan `save_failed` / `register_failed`; el límite menor a lo gastado lleva `limit_below_spent` con `guardParams: { spent }`. Verificar con un test de código en `packages/recurrences/__tests__/guard-codes.test.ts` que lee los dos archivos y falla si algún objeto `ok: false` con `formError:` no tiene `guardCode:`.
- [x] 1.3 Exportar desde `packages/recurrences/src/index.ts` la lista `RECURRENCE_GUARD_CODES: readonly RecurrenceGuardCode[]` y el helper `guardMessageKey(result)` → `'guards.<code>' | null`; verificar con un test en `guard-codes.test.ts` que la lista contiene exactamente los códigos de la unión (comparando contra los `guardCode:` que el test de 1.2 encuentra en el código).

## 2. Catálogo

- [x] 2.1 Agregar `recurrences.guards.<code>` en `packages/i18n-messages/src/es.json` con los textos actuales del package (el de `limit_below_spent` con `{spent}`), y en `en.json` con su traducción; verificar con el bloque nuevo de `apps/web/lib/recurrences/__tests__/link-error-catalog.test.ts` que cada código de `RECURRENCE_GUARD_CODES` tiene texto en los dos idiomas y que ningún texto es igual en ambos.

## 3. Las dos apps traducen el código

- [x] 3.1 Web: en `apps/web/app/_actions/recurrences.ts`, un helper que traduce `guardCode` (con `guardParams`) vía `getTranslations('recurrences')` y se aplica en cada action que devuelve `result` o `formError ?? result.formError`, en el orden `mapErrorCode` → vínculo → `guardCode` → `formError`; verificar con `pnpm typecheck` y `pnpm test:web`.
- [x] 3.2 Nativo: en `apps/mobile/lib/recurrences/mutators.ts`, `localize` y `localizeForm` traducen `guardCode` antes de caer al genérico, y `localizeForm` deja de devolver el `formError` crudo; verificar con un caso nuevo en `apps/mobile/lib/recurrences/__tests__/invalidation-wiring.test.ts` que lee el código y falla si `localize` o `localizeForm` no consultan `guardCode`, y `pnpm typecheck:mobile`.

## 4. Comentarios que afirman el supuesto viejo

- [x] 4.1 Reescribir los comentarios de `packages/recurrences/src/types.ts` (líneas de `covered_occurrences` y `next_occurrence`), `packages/recurrences/src/mutations.ts` («Idempotent via the one-pending-per-rule unique index»), `packages/recurrences/src/queries.ts` (el bloque de `selectReconstructionBatch` que dice que lo más nuevo existente materializa la actual), `apps/web/app/(app)/transactions/recurring/_components/recurring-tabs.tsx` («always sits at today-or-earlier»), `apps/mobile/lib/recurrences/queries.ts» («finished is derived from a past end_date»), `packages/dashboard/src/queries.ts` (las tres: «one pending instance per rule and only once its date arrives», el KNOWN GAP de «allows one pending instance per rule», y «confirm propagates a corrected amount back to the rule») y `packages/money-logic/src/recurrence-end-condition.ts` (dice que `validateEndCondition` se usa en las mutaciones y no es así); verificar con `grep -rn "only materialized up to today\|always <= today\|today-or-earlier\|past end_date\|propagates a corrected amount\|one pending instance per rule\|one-pending-per-rule unique index" packages apps --include=*.ts --include=*.tsx` que no queda ninguno fuera de tests y migraciones, y con `pnpm lint` que nada se rompió.

## 5. Verificación

- [x] 5.1 `pnpm openspec:check` en verde con el change activo.
- [x] 5.2 `pnpm verify` en verde (incluye lint, typecheck de las dos apps, tests del monorepo y build).
- [x] 5.3 Anotar en `findings.md` del change lo visto y no tocado: la prioridad del lote del generador que toma una ocurrencia resuelta por anticipado como «la actual ya materializada»; las pendientes futuras que cuentan para «trabada», el pill y el teaser de Compartido; los mensajes de guarda de `@grana/transactions-mutations` con el mismo problema; `updateRecurrence` acepta `account_id` sin validar la cuenta.
