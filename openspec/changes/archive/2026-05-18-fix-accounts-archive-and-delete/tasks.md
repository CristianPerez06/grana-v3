## 1. Server actions

- [x] 1.1 En `apps/web/app/_actions/accounts.ts`, reescribir `archiveAccount`: eliminar la lectura de `account_currencies` y el check de `initial_balance`. Conservar solo el update a `is_active=false` con `eq('user_id', userId)`. Mantener el `revalidatePath('/accounts')`.
- [x] 1.2 Reescribir `deleteAccount`: antes del DELETE, ejecutar un query a `transactions` con `.or('account_id.eq.${id},transfer_destination_account_id.eq.${id}')` y `.limit(1)`. Si retorna ≥ 1 fila, retornar `{ ok: false, formError: <mensaje i18n> }`. Si no, proceder con el DELETE como hoy.

## 2. i18n

- [x] 2.1 Agregar en `packages/i18n-messages/src/es.json` bajo `accounts.*` (o donde corresponda en la estructura): `errors.delete_has_transactions`: "Esta cuenta tiene movimientos. Archivala para preservar el historial."
- [x] 2.2 Replicar en `en.json`.
- [x] 2.3 Actualizar `deleteAccount` para usar el mensaje en español directamente (manteniendo el patrón actual de error en español hardcodeado en la action, igual que los demás errores del módulo).

## 3. UI — detalle de cuenta

- [x] 3.1 En `apps/web/app/(app)/accounts/[id]/page.tsx`, agregar un conteo de transacciones de la cuenta. Reusar el array `transactions` que ya se carga: `hasTransactions = transactions.length > 0` (alcanza con saber si hay al menos una, no hace falta el COUNT exacto si el listado ya las trae).
- [x] 3.2 Pasar `hasTransactions` como prop al `AccountDetailHeader`.
- [x] 3.3 En `account-detail-header.tsx`, mostrar el botón "Eliminar" cuando `!hasTransactions` y "Archivar" cuando `hasTransactions`. Nunca los dos al mismo tiempo. Si la cuenta ya está archivada, mostrar "Reactivar".
- [x] 3.4 El botón "Eliminar" abre un confirm dialog que dice "Esta cuenta no tiene movimientos. ¿Eliminarla? Esta acción no se puede deshacer." El de "Archivar" dice "¿Archivar esta cuenta? Vas a poder reactivarla más tarde."

## 4. Spec cleanup

- [x] 4.1 En `openspec/specs/accounts/spec.md`, remover la "Nota de implementación" en el Requirement de archivado (las dos líneas blockquote después del párrafo principal).
- [x] 4.2 En el mismo archivo, remover la "Nota de implementación" en el Requirement de eliminación.

## 5. Validación final

- [x] 5.1 Correr `openspec validate fix-accounts-archive-and-delete` sin errores.
- [x] 5.2 Correr `pnpm build` sin errores.
- [x] 5.3 Test manual:
  - Crear una cuenta nueva sin transacciones → verificar que el detalle muestra "Eliminar" → confirmar el borrado funciona.
  - Crear una cuenta nueva, agregarle una transacción → verificar que el detalle ahora muestra "Archivar" → confirmar que archivar funciona y la cuenta sale del listado.
  - Intentar eliminar una cuenta con transacciones via URL directa o consola (no debería ser posible vía UI) → verificar que la action rechaza con el mensaje correcto.
  - Verificar que cuentas con `initial_balance ≠ 0` pero sin transacciones ahora se pueden archivar (antes era imposible).
