# Tasks: edit-recurrence-instance-account

## 1. Contrato de confirmación (`@grana/validation`)

- [x] 1.1 `confirmRecurrenceInstanceSchema`: agregar `account_id` (uuid, opcional). Ausente = usar la cuenta de la instancia.

## 2. Mutación compartida (`@grana/recurrences`)

- [x] 2.1 `confirmRecurrenceInstance`: resolver la cuenta efectiva (`payload.account_id ?? instance.account_id`) antes de leer la cuenta.
- [x] 2.2 Validar la cuenta efectiva con `assertAccountUsable` (pertenencia + activa + moneda de la instancia activa). El mensaje de cuenta archivada solo aplica cuando el usuario NO eligió otra.
- [x] 2.3 Pasar el `type` de la cuenta efectiva al mapper y la cuenta efectiva al `InstanceSnapshot`, para que la familia (cash/bank vs credit) determine el plan.
- [x] 2.4 Rechazar `account_id` igual al `transfer_destination_account_id` de la instancia.
- [x] 2.5 Persistir `account_id` en el `UPDATE` de la instancia al confirmar (hoy escribe monto/fecha/categoría/descripción, no la cuenta).
- [x] 2.6 NO propagar la cuenta a la regla: `ruleUpdates` sigue llevando solo `last_generated_date` y, si cambió, `amount`.

## 3. Proyección de cuentas reutilizable (web)

- [x] 3.1 Extraer `toFormAccounts(grouped)` a `apps/web/lib/accounts/form-accounts.ts` (pura, client-safe) desde la duplicación existente.
- [x] 3.2 Usarla en `movement-drawer-loader.tsx` y en `lib/transactions/edit-context.ts`.

## 4. UI del bloque de pendientes (web)

- [x] 4.1 `pending-recurrences-block-container.tsx`: proyectar las cuentas ya leídas y pasarlas al bloque.
- [x] 4.2 `pending-recurrences-block.tsx`: selector de cuenta en el panel de edición (Popover + AccountAvatar), con la lista filtrada por moneda de la instancia y tipo funcional de la regla.
- [x] 4.3 Enviar `account_id` en los overrides solo cuando difiere del de la instancia.
- [x] 4.4 Recalcular el aviso de saldo negativo contra la cuenta elegida (y no mostrarlo cuando la elegida es de crédito en un gasto).
- [x] 4.5 Cuando la cuenta de la regla está archivada o falta, abrir el panel con el selector visible en vez del error muerto.

## 5. i18n

- [x] 5.1 Claves nuevas en `es.json` / `en.json` (`recurrences.pending.account_*`).

## 6. Verificación

- [x] 6.1 `pnpm --filter web typecheck` y `pnpm lint` verdes.
- [x] 6.2 Tests: contrato del payload (`confirm-overrides.test.ts`) + mapeo por cuenta efectiva y familia (`mapper.test.ts`). Las validaciones de servidor (moneda no activa, cuenta archivada, origen = destino) quedan **sin test automatizado**: `confirmRecurrenceInstance` habla con Supabase y el repo todavía no tiene harness para mockear el cliente en `@grana/recurrences`. Cubiertas por QA manual (6.3).
- [ ] 6.3 QA manual (usuario): confirmar la luz con otra tarjeta; verificar que la regla sigue con la cuenta original y que la próxima instancia se propone con ella.

## 7. Cierre

- [x] 7.1 Archivar el change en la branch (`openspec/changes/archive/YYYY-MM-DD-edit-recurrence-instance-account/`) + sincronizar `openspec/specs/transactions/spec.md`.
- [x] 7.2 `pnpm openspec:check` verde.
