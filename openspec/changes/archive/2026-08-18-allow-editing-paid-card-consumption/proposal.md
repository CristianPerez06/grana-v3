# Proposal: allow-editing-paid-card-consumption

## Why

El spec se contradecía a sí mismo sobre un consumo de tarjeta cuyo resumen ya se pagó (`status='paid'`):

- El requirement **"El usuario puede editar una transacción"** decía: *"Si `status='paid'`, sólo editables descripción y categoría"* — o sea, el consumo sigue siendo editable, con el monto y la fecha congelados.
- El requirement del **detalle** definía `canEdit` como `canManage && cuenta resoluble && status !== 'paid' && no es cuota hija` — o sea, el detalle esconde la acción Editar justo en ese caso.

El código implementaba las dos a la vez, con el resultado peor posible: `getEditableFields` tiene su rama `locked = status === 'paid'` (monto y fecha `false`, categoría y descripción `true`), testeada y funcionando, pero **inalcanzable desde la UI**. Y la puerta quedó a medio cerrar: `buildMovementEditContext` NO devuelve `null` para un pagado, así que `/transactions/<id>/edit` responde igual si uno escribe la URL a mano. Botón escondido, ruta abierta.

El caso de uso es cotidiano: pagás el resumen y después ves que un gasto quedó mal categorizado. Hoy queda mal para siempre, salvo que conozcas la URL.

## What Changes

- **Un consumo pagado vuelve a ser editable desde el detalle**, en web y en la nativa: `canEdit` deja de mirar `status`. Lo que se puede cambiar no cambia — lo sigue decidiendo `getEditableFields`: categoría, subcategoría y descripción sí; monto y fecha no, y ahora se muestran como contexto read-only (change `show-locked-fields-as-context`).
- **Borrar sigue bloqueado.** `canDelete` conserva `status !== 'paid'`: deshacer un resumen liquidado revierte todo el período (movimientos a pendiente, sello, gasto-débito) y eso vive en el detalle del período; además `period_payments` tiene una FK `RESTRICT` que lo impide en la base.
- **El spec queda congruente**: la definición de `canEdit` deja de excluir los pagados y remite al requirement de campos mutables, que a su vez explicita que el consumo no se congela y que el borrado sí queda bloqueado. Se agrega un escenario que fija las dos mitades juntas.

Sin cambios de datos, de validación ni contables. Las defensas ya existían y no se tocan: el server action rechaza cambios de monto y fecha sobre un consumo pagado, y la FK impide el borrado.

## Capabilities

### Modified Capabilities

- `transactions`: se corrige la contradicción entre el requirement de campos mutables y la definición de `canEdit` del detalle.

### New Capabilities

(ninguna)

**Pre-change check.** La change activa `fix-recurrence-projection-and-orphans` toca `transactions` sobre requirements disjuntos (recurrencias, borrado, edición desde el módulo global). Sin solapamiento.

## Impact

- **`apps/web/app/(app)/transactions/[txId]/_components/global-transaction-detail.tsx`** — `canEdit` deja de exigir `status !== 'paid'`.
- **`apps/mobile/app/(app)/transactions/[txId]/index.tsx`** — el mismo cambio, en el mirror nativo.
- **Sin cambios** en `getEditableFields`, en `buildMovementEditContext`, en las server actions ni en el schema: todo eso ya contemplaba el caso.
- **i18n**: sin claves nuevas.
- **Efecto lateral**: la rama `locked` de `getEditableFields` pasa a ser alcanzable desde la UI por primera vez, así que el contexto read-only de monto y fecha se vuelve visible en el caso para el que se escribió.
