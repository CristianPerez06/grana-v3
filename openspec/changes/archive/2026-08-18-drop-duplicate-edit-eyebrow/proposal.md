# Proposal: drop-duplicate-edit-eyebrow

## Why

El encabezado del formulario en modo edición apilaba un eyebrow en versalitas —**EDITAR**— sobre el título **"Editar movimiento"**. La misma palabra, dos veces, una arriba de la otra. El eyebrow existe para dar contexto que el título no da; acá no daba ninguno.

El alta en viewport angosto ya lo había resuelto en la pasada `simplify-movement-form-surface`, que le sacó el eyebrow "NUEVO" y dejó un título de una línea. La edición quedó afuera de esa poda.

## What Changes

- **Sin eyebrow en edición**, en las tres superficies. Queda solo "Editar movimiento".
- **El alta no se toca**: en escritorio conserva su eyebrow "NUEVO", que sí agrega algo sobre un título distinto ("Registrar movimiento"), y en viewport angosto sigue sin eyebrow como quedó en la pasada anterior.
- La app nativa ya cumplía: su pantalla de edición monta un `PageHeader` con título solo.

Sin cambios de datos, validación ni contables.

## Capabilities

### Modified Capabilities

- `transactions`: el requirement del drawer en modo edición pasa a exigir encabezado sin eyebrow.

### New Capabilities

(ninguna)

**Pre-change check.** La change activa `fix-recurrence-projection-and-orphans` toca `transactions` sobre requirements disjuntos. Sin solapamiento.

## Impact

- **`apps/web/lib/transactions/components/movement-form.tsx`** — `showEyebrow` pasa de `!(isMobile && !isEdit)` a `!isEdit && !isMobile`.
- **`apps/mobile`** — sin cambios, ya cumplía.
- **i18n**: `transactions.drawer.eyebrow_edit` queda sin uso. Se conserva: `eyebrow_new` sigue en uso y sacar solo la mitad del par deja el catálogo asimétrico sin ganar nada.
