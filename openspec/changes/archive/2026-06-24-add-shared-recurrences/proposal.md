## Why

Hoy una regla de recurrencia es estrictamente unipersonal: la tabla `recurrences` no
tiene `household_id` ni splits, y nada de "compartido" sobrevive a la generación de
instancias. El caso más común de un hogar —un gasto fijo que se paga 50/50 todos los
meses, como el alquiler— no se puede dejar recurrente. El usuario tiene que recrearlo a
mano cada mes y volver a marcarlo como compartido. Recurrencias y Compartido se
construyeron como módulos independientes y nunca se cruzaron.

## What Changes

- Una regla de recurrencia de tipo **gasto** puede pertenecer a un hogar y llevar un
  split por porcentaje (el "template" del reparto).
- Al generar cada instancia, el hogar y el split se propagan a la instancia (snapshot),
  igual que hoy se copia el `amount`.
- Al confirmar la instancia, el movimiento resultante nace compartido: se reutiliza el
  alta de gasto compartido existente (`createExpense` con `shared` → `applySharedSplits`),
  por lo que la deuda del hogar se deriva sola como con cualquier gasto compartido manual.
- **Caja, no devengado**: mientras la instancia esté pendiente no genera deuda ni impacta
  el gasto, idéntico al comportamiento unipersonal actual.
- El estado compartido es **estructural**: se define al crear la regla y no se edita desde
  el edit drawer (consistente con cuenta/categoría/tipo, que ya son fijos al alta).
- `leaveHousehold` bloquea la salida del hogar si existe una regla compartida activa,
  igual que ya bloquea por deuda o liquidaciones pendientes.
- El modelo de datos soporta **override del split por instancia** desde el día uno
  (campo `split` por instancia); la UI para editarlo antes de confirmar queda fuera de
  esta fase (paso 2).

## Capabilities

### New Capabilities
- `shared-recurrences`: una regla de recurrencia puede pertenecer a un hogar y generar
  movimientos compartidos; el split viaja regla → instancia → transacción, con caja (sin
  devengado) y reuso del alta de gasto compartido existente.

### Modified Capabilities
- `shared`: `leaveHousehold` debe impedir salir del hogar mientras exista una regla de
  recurrencia compartida activa.

## Impact

- **Migración** (nueva, sobre el modelo de `0011_recurring_movements.sql`): agrega
  `household_id` + `default_split` (jsonb) a `recurrences`, y `household_id` + `split`
  (jsonb) a `recurrence_instances`.
- **Generación**: `apps/web/lib/recurrences/queries.ts` (`generateDueRecurrenceInstances`)
  propaga `household_id` y `default_split` → `split`.
- **Confirmación**: `apps/web/lib/recurrences/mapper.ts` (`mapInstanceToConfirmPlan`)
  emite `shared: { household_id, splits }` en el plan de gasto cuando la instancia tiene
  hogar; `apps/web/app/_actions/recurrences.ts` ya delega en `createExpense`.
- **Validación**: `packages/validation/src/recurrences.ts` agrega `shared` opcional al
  schema de recurrencia de gasto (reutiliza `sharedExpenseSchema`).
- **UI**: `create-recurrence-modal.tsx` agrega toggle Compartir + editor de split (solo
  `type=expense`, hogar de dos miembros).
- **Recurrencia desde movimiento**: `packages/transactions-mutations/src/create-recurrence-from-movement.ts`
  hereda el `household_id` + split del gasto semilla compartido, para que hacer recurrente
  un gasto compartido no lo degrade a individual.
- **Hogar**: `apps/web/app/_actions/shared.ts` (`leaveHousehold`) suma el guard.
- **Reuso sin cambios**: `packages/transactions-mutations/src/internal/shared-splits.ts`
  (`applySharedSplits`) y la derivación de deuda por moneda.
- **Fuera de alcance**: income y card_purchase recurrentes compartidos; UI de override de
  split por instancia; deuda devengada/proyectada de instancias pendientes.
