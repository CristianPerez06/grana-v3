## Why

Hoy un reintegro solo puede declararse **inline en el alta** de un gasto: si el usuario registró el gasto sin marcarlo, o se enteró después de que le iban a devolver plata, no hay ningún camino para agregarlo — tiene que borrar el gasto y volver a cargarlo. El formulario de edición ya es el lugar natural para esto (ya edita monto, categoría, y el toggle Compartir), pero la sección de reintegro está gateada a alta y `submitEdit` no la contempla. Es el followup #3 del módulo de Reintegros/Compartido.

## What Changes

- El formulario de **edición** de movimiento expone la sección "Tiene reintegro" completa (monto esperado, %/tope helper, subtipo a cuenta / en resumen, cuenta de acreditación, "ya me lo acreditaron"), en paridad con el alta.
- Alcance de movimientos, en paridad con el alta: **gasto simple** (efectivo/banco), **compra de tarjeta simple** y **compra en cuotas** (el reintegro se vincula a la madre; subtipo "en resumen" cae en el período de la primera cuota, igual que en el alta).
- Comportamiento **CRUD** sobre el reintegro vinculado:
  - **Agregar** cuando el gasto no tiene reintegro.
  - **Editar** (monto / subtipo / cuenta / marcar recibido) cuando existe y está **pendiente**.
  - **Quitar** cuando existe y está pendiente.
  - Cuando el reintegro ya está **recibido** (`received_at` seteado) o **cancelado**, la sección se muestra **read-only**: no se edita ni se quita desde este formulario (esas transiciones siguen en sus flujos propios de confirmar/cancelar, que tocan saldo/resumen).
- Cuando el gasto es **compartido**, el reintegro hereda el mismo split del hogar (en una sola fila), igual que en el alta, para que la deuda derivada lo netee. Si en la misma edición se cambia el estado de compartido del gasto, el reintegro sigue ese cambio.
- Web-only. La capa compartida (`@grana/movement-form`, `@grana/transactions-mutations`, `@grana/money-logic`, `@grana/validation`) recibe los contratos nuevos para que mobile (tech lead) los consuma sin re-diseñar.

## Capabilities

### New Capabilities
<!-- Ninguna: la capacidad de reintegros ya existe dentro de `transactions`. -->

### Modified Capabilities
- `transactions`: se agrega el requisito de que el usuario pueda **agregar / editar / quitar** un reintegro al **editar** un gasto existente (hoy el requisito solo cubre declararlo en el alta), incluyendo las reglas de estado (pendiente editable, recibido/cancelado read-only), el alcance por tipo de gasto (simple / tarjeta / cuotas) y la herencia del split compartido.

## Impact

- **`packages/movement-form`**: `MovementEditContext` gana un campo `reimbursement` (el reintegro vinculado existente o `null`, con su estado); `Mutators` gana un mutator para declarar/editar/quitar reintegro sobre un gasto existente; `use-movement-form` prefillea el estado desde `edit.reimbursement` y agrega la rama de reintegro en `submitEdit`.
- **`packages/money-logic`**: `EditableFields` gana `reimbursement?: boolean`, computado en `getEditableFields` según tipo/estado del gasto.
- **`packages/transactions-mutations`**: orquestador nuevo (gemelo standalone de `insertDeclaredReimbursement`) que aplica el CRUD del reintegro sobre un gasto existente, incluyendo la herencia del split compartido (`applySharedSplits`). Reutiliza el patrón delete+insert para sortear la inmutabilidad de `estimated_amount` en UPDATE.
- **`packages/validation`**: schema del nuevo mutator.
- **`apps/web`**: server action nueva; el builder del edit context (`buildMovementEditContext`) carga el reintegro vinculado existente; `movement-form.tsx` un-gatea la sección con el patrón gemelo del toggle Compartir en edición.
- **`packages/i18n-messages`**: reutiliza el namespace `transactions.reimbursement` existente; solo agrega copy nuevo si hace falta para los estados read-only.
- **Sin migración**: el esquema y los triggers (`trg_fn_reimbursement_invariants`, `chk_reimbursement_state`) ya soportan todo el modelo.
- **Mobile**: fuera de alcance de implementación; se preservan los contratos compartidos para que el tech lead lo tome.
