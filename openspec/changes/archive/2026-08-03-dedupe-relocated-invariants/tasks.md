# Tareas — deduplicar los invariantes reubicados

Este change no toca código. El riesgo no es romper el build: es **perder una cláusula normativa en silencio** al fusionar. Por eso la verificación central es una tabla de trazabilidad, no un `diff`.

## 1. Deltas (hecho al proponer)

- [x] 1.1 Escribir los deltas de `schema-base` (1 `MODIFIED` + 1 `REMOVED`).
- [x] 1.2 Escribir los deltas de `transactions` (2 `MODIFIED` + 1 `REMOVED`).
- [x] 1.3 Escribir los deltas de `cards` (2 `MODIFIED` + 1 `REMOVED`).
- [x] 1.4 Escribir el delta de `accounts` (1 `MODIFIED`).
- [x] 1.5 Cada `REMOVED` declara en su `**Reason**` qué cláusulas y scenarios se absorbieron, en vez de decir sólo "duplicado".

## 2. Trazabilidad — que nada se pierda

Por cada uno de los tres textos eliminados, confirmar que **cada cláusula normativa y cada scenario** está en el sobreviviente o está explícitamente descartado con motivo.

- [x] 2.1 **Aritmética decimal.** Absorbido: la enumeración de operaciones cubiertas (saldos, sumatorias, pagos, límites, cuotas, ajustes); la regla de que la conversión a `number` ocurre sólo en el borde de presentación/persistencia; los scenarios de query-para-display, `Number(row.amount)`, parser de formulario, normalización en server action, y auditoría del baseline. Descartado a propósito: nada.
- [x] 2.2 **`fx_rate_to_ars`.** Absorbido: el nombre `I-CRED-11`; el detalle de enforcement (constraint `CHECK` con subquery sobre `accounts.type` o trigger equivalente). Descartado a propósito: los tres scenarios del eliminado, por ser 1:1 equivalentes a los del sobreviviente (mismo predicado, distinta redacción).
- [x] 2.3 **Período abierto.** Absorbido: el nombre `I-CRED-12`; el alcance explícito a `is_active=true`; el scenario de tarjeta archivada. Descartado **a propósito y con motivo**: la cláusula "o, alternativamente" — es la deuda 4, y su eliminación es parte del objetivo.
- [x] 2.4 **Off-ledger (triple).** El canónico de `cards` absorbió de `transactions` la enumeración de qué sí afecta el saldo y la explicitación `pending`+`paid`; y de `accounts` los scenarios concretos de usuario. `accounts` y `transactions` conservan requirement propio como referencia cruzada + sus scenarios.

## 3. Verificación de la contradicción contra el código

La cláusula `AND status='pending'` de `accounts` se elimina porque contradice al código, no porque esté en minoría.

- [x] 3.1 Confirmar que `getAccounts` (`packages/accounts/src/queries.ts`) trae sólo cuentas `type IN ('cash','bank')`, de modo que las `credit` nunca entran al conjunto que lleva saldo.
- [x] 3.2 Confirmar que el RPC `get_account_balance_sums` (migración `0052_balance_temporal_cut.sql`) filtra `where t.status is null`, y que toda transacción de tarjeta tiene status no nulo (`pending`/`paid`).
- [x] 3.3 Conclusión registrada: dos mecanismos independientes excluyen los consumos de tarjeta **sin mirar el status**. La semántica correcta es `pending` y `paid` por igual.
- [x] 3.4 Confirmar que los tests existentes del motor de saldos siguen verdes (`pnpm --filter web test`). No deberían cambiar —esta change no toca código— pero es la comprobación de que la semántica que se escribe es la que corre.

## 4. Verificación de specs

- [x] 4.1 Confirmar que cada bloque `MODIFIED` difiere de su original **sólo** en lo declarado en el `proposal.md`, por `diff` bloque a bloque.
- [x] 4.2 Confirmar que los títulos de los 3 `REMOVED` existen en su spec maestro antes de archivar.
- [x] 4.3 `npx --yes @fission-ai/openspec@1.7.0 validate dedupe-relocated-invariants --strict` pasa con exit code 0.

## 5. Archivado (en la branch, antes del merge a `main`)

- [x] 5.1 Aplicar los deltas a los 4 specs maestros. Ninguno debe quedar con secciones `## ADDED/MODIFIED/REMOVED/RENAMED`.
- [x] 5.2 Confirmar los conteos: `schema-base` 6→5, `transactions` 124→123, `cards` 43→42, `accounts` 29 (sin cambio, sólo `MODIFIED`). Neto −3 requirements sobre los cuatro specs.
- [x] 5.3 Confirmar que ninguno de los 3 requirements eliminados sobrevive en su spec maestro.
- [x] 5.4 Mover la carpeta a `openspec/changes/archive/YYYY-MM-DD-dedupe-relocated-invariants/`.
- [x] 5.5 `pnpm openspec:check` pasa. Correrlo de verdad y ver el exit code.
- [x] 5.6 `npx --yes @fission-ai/openspec@1.7.0 validate --specs --strict` pasa sobre los specs maestros sincronizados.
- [ ] 5.7 Confirmar en el PR que el job `OpenSpec validation` de CI pasa. Desde que el ruleset de `main` lo exige, es un gate bloqueante.

## 6. Seguimiento

- [x] 6.1 Marcar como saldadas, en `openspec/changes/archive/2026-08-02-split-project-conventions/tasks.md`, las piezas que este change cierra: los 4 solapamientos (tarea 4.2), la propiedad de `fx_rate_to_ars` (tarea 4.4, resuelta a favor de `transactions` con referencia cruzada desde `cards`), y la deuda 4 (invariante de período abierto debilitado).
- [ ] 6.2 La deuda restante de aquel change sigue pendiente y NO se toca acá: la regla de admisión a capabilities meta, la bimoneda desactualizada en `onboarding`, y el layout del monorepo desactualizado en `repo-architecture`.
