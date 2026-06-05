## Why

Dos commits que llegaron a `main` recientemente movieron código sin actualizar la spec `transactions`. La spec quedó desincronizada del código vigente: una requirement describe un botón que ya no existe, y un comportamiento nuevo no está documentado. Esta deriva contradice el pilar fundacional del repo ("la spec es la memoria") y obstaculiza a un agente fresco que abra `openspec/specs/transactions/spec.md` esperando ver la verdad actual.

Este change es **pura higiene de spec**, sin cambios de código. Quitar la deuda ahora — mientras el contexto está fresco — evita que se acumule.

## What Changes

- **BREAKING (a nivel spec)** Remover la requirement "Guardar y cargar otro" de `openspec/specs/transactions/spec.md`. El botón "+ Otro" del drawer de alta de movimiento fue eliminado por el commit `c0580e36` ("refactor(transactions): quitar el boton '+ Otro' del alta de movimiento") junto con su plumbing en `apps/web/.../movement-form.tsx`, su handler `onSubmitAndAddAnother` en el hook compartido `@grana/movement-form`, y las claves `transactions.drawer.add_another` de `es.json` / `en.json`. La requirement quedó huérfana sin código que la respalde.
- Agregar una requirement nueva en `openspec/specs/transactions/spec.md` que documente la **fila sintética "Saldo inicial"** que el detalle de cuenta inyecta en su listado de movimientos. Introducida por el commit `5b6c3819` ("feat(accounts): mostrar el saldo inicial como movimiento en el detalle de cuenta"), implementada en `apps/web/app/(app)/accounts/[id]/_components/movement-list-account-container.tsx` con los helpers `INITIAL_BALANCE_ID_PREFIX`, `isInitialBalanceMovement` y `toInitialBalanceMovement` exportados desde `apps/web/lib/transactions/movements.ts`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`: dos deltas — `REMOVED` requirement obsoleta ("Guardar y cargar otro") y `ADDED` requirement nueva ("El detalle de cuenta inyecta una fila sintética 'Saldo inicial' en su listado").

## Impact

**Código**: ninguno. Este change no modifica archivos en `apps/`, `packages/`, ni schemas. Solo edita `openspec/specs/transactions/spec.md` (vía deltas archivados).

**Specs**: dos deltas dentro de `transactions`. La requirement removida es la única source-of-truth de un comportamiento ya inexistente; la requirement nueva consolida en la spec un comportamiento ya en código (fila sintética excluida del módulo global, no navegable, excluida del recurrence-link lookup).

**Tests**: ninguno (no hay código). Los tests de `apps/web/lib/transactions/__tests__/movements.test.ts` que cubren `isInitialBalanceMovement` y `toInitialBalanceMovement` ya existen — este change no los modifica.

**i18n**: ninguno. La clave `accounts.initial_balance_label` que el código usa para el label de la fila sintética ya existe; este change no añade ni quita claves.

**Migración / rollback**: trivial — son sólo edits a markdown.
