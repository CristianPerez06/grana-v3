## Why

El spec de `accounts` define que **archivar** una cuenta sirve para sacar del listado activo una cuenta con historial — siempre debe estar disponible. Y **eliminar** es solo para limpiar cuentas creadas por error, que nunca tuvieron transacciones. Ambas reglas son funcionalmente claras y se documentaron en `openspec/specs/accounts/spec.md` con notas explícitas marcando que el código no las refleja.

Hoy el código hace lo opuesto:

- `archiveAccount` **rechaza** archivar si `initial_balance ≠ 0` en alguna moneda (chequea el saldo inicial, lo cual no tiene sentido funcional).
- `deleteAccount` **acepta** borrar cuentas con transacciones, cascadeando todo el historial a la basura via `ON DELETE CASCADE`. Eso destruye datos sin pedirle al usuario una confirmación específica.

Estas dos divergencias son riesgos concretos: un usuario puede perder historial sin darse cuenta al "eliminar" (cuando funcionalmente quería archivar), y se le bloquea archivar cuando es exactamente lo que debería poder hacer.

## What Changes

- **`archiveAccount`** — remover el guard de `initial_balance = 0`. Archivar siempre es válido si la cuenta existe y pertenece al usuario.
- **`deleteAccount`** — agregar guard previo que cuente transacciones donde `account_id = X` o `transfer_destination_account_id = X`. Si hay al menos una, rechazar con mensaje orientando al usuario a archivar.
- **UI del detalle de cuenta** — exponer dinámicamente "Eliminar" cuando la cuenta no tiene transacciones, y "Archivar" cuando sí las tiene. El usuario nunca ve ambas a la vez para evitar confusión.
- **Spec delta** — remover las dos "Notas de implementación" en `openspec/specs/accounts/spec.md` porque después de este change ya no aplican.

**Out of scope:**

- No se toca el modelo de DB (no hace falta migración).
- No se toca el comportamiento de `deactivateCurrencyFromAccount` (ya es correcto).
- No se agrega "soft delete" (delete sigue siendo físico, simplemente más restrictivo).

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `accounts`: ajusta las reglas de archivado y eliminación para alinear el código con la intención funcional ya documentada en el spec.

## Impact

- **`apps/web/app/_actions/accounts.ts`**:
  - `archiveAccount`: elimina la lectura de `account_currencies` y el check de `initial_balance`. Conserva solo la actualización a `is_active=false`.
  - `deleteAccount`: agrega query que verifica existencia de transacciones referenciando la cuenta (cualquiera de las dos columnas) antes de borrar.
- **`apps/web/app/(app)/accounts/[id]/_components/account-detail-header.tsx`** (o donde estén los botones): pasar la información de "tiene transacciones" desde la página y mostrar el botón apropiado.
- **`apps/web/app/(app)/accounts/[id]/page.tsx`**: contar transacciones de la cuenta y pasar el flag al header.
- **i18n**: agregar mensaje de error cuando se intenta eliminar una cuenta con historial, sugiriendo archivar.
- **`openspec/specs/accounts/spec.md`**: remover las dos notas de implementación.
