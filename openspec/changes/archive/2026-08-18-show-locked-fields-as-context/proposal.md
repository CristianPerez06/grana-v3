# Proposal: show-locked-fields-as-context

## Why

Cuando `getEditableFields` bloquea el monto o la fecha de un movimiento, el formulario de edición **los saca de la pantalla** en vez de mostrarlos como contexto:

```
apps/web/.../movement-form.tsx     const showAmountHero = isEdit ? editable?.amount : true
apps/web/.../movement-form.tsx     {editable?.date && dateRow}
apps/mobile/.../MovementForm.tsx   const showAmount = isEdit ? !!editable?.amount : true
apps/mobile/.../MovementForm.tsx   const showDate = isEdit ? !!editable?.date : true
```

Ninguna de las dos plataformas tiene fallback read-only. Los casos reales son **un consumo de tarjeta ya pagado** y **la madre de una compra en cuotas con alguna cuota paga**: el usuario abre "Editar movimiento" y ve el tipo, la moneda, la cuenta, la categoría y la descripción, pero **no cuánto era ni de cuándo**. Está editando a ciegas justamente el movimiento cuyos números no puede tocar.

Y no es una decisión de diseño: **el spec ya pide lo contrario**. El requirement de la edición en la app nativa tiene el escenario "Los campos bloqueados no se editan", que dice textualmente *"el consumo pagado muestra monto y fecha **como contexto read-only** (sólo categoría/descripción editables)"*. Es drift entre spec e implementación, del tipo que este repo existe para no tener.

## What Changes

- **Un campo bloqueado se muestra, no se oculta.** Cuando `editable.amount` es falso, el monto pasa a ser una fila de contexto read-only; ídem la fecha con `editable.date`. Mismo tratamiento y mismo caption de "no editable" que el tipo, la moneda y la(s) cuenta(s), que ya viven ahí.
- **Orden**: el monto abre el bloque inmutable (donde habría estado el héroe) y la fecha lo cierra, de modo que los hechos inmutables quedan juntos y los campos editables siguen abajo.
- **El monto conserva signo y símbolo** (`−$200.000`, `+U$D 350`), derivados del tipo del movimiento y —para un ajuste— de su dirección, así que se lee igual que en el detalle.
- **Las dos plataformas, misma regla**, con los formatters que cada una ya tiene (`formatForDisplay` compartido para el monto; `formatDateValue` en web y `formatShortDate` en la nativa para la fecha).
- **Se generaliza la regla en el spec**: hoy sólo estaba escrita en el requirement de la app nativa; pasa al requirement del formulario único, que gobierna las tres superficies.

Sin cambios de datos, validación ni contables: qué se puede editar lo sigue decidiendo `getEditableFields`, exactamente igual. Sólo cambia qué se muestra cuando la respuesta es "no".

## Capabilities

### Modified Capabilities

- `transactions`: el requirement del formulario único incorpora la regla de que un campo bloqueado se muestra como contexto read-only en vez de desaparecer, con un escenario propio. El requirement de la edición nativa no se toca: ya lo decía para su plataforma.

### New Capabilities

(ninguna)

**Pre-change check.** La change activa `fix-recurrence-projection-and-orphans` también tiene deltas sobre `transactions`, pero sobre requirements disjuntos (proyección de recurrencias, duplicados de reglas, borrado, edición desde el módulo global). No hay solapamiento.

## Impact

- **`apps/web/lib/transactions/components/movement-form.tsx`** — `contextRows` gana dos filas condicionales (monto al inicio, fecha al final) y un helper local que formatea el monto bloqueado con su signo. `formatDateValue` se declara antes de `contextRows` (antes vivía más abajo y quedaba en TDZ).
- **`apps/mobile/components/transactions/MovementForm.tsx`** — mismo agregado, reusando `formatShortDate` de `components/transactions/detail/format.ts` y `useLocale()` para el idioma.
- **i18n**: sin claves nuevas — `transactions.labels.amount` y `transactions.labels.date` ya existen y ya se usan en el formulario.
- **Sin impacto** en `@grana/money-logic` (`getEditableFields` no cambia), en `@grana/movement-form`, en las server actions ni en el schema.
