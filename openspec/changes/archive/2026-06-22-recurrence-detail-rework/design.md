## Context

`/transactions/recurring/[id]` hoy abre en modo edición: `RecurrenceDetailForm` (un `'use client'` de ~240 líneas) renderiza un `<form>` siempre visible con amount/frequency/end_date/description, más botones de pausar/eliminar arriba y un `confirm()` nativo para el borrado. La pantalla de referencia, `/transactions/[txId]`, sigue otro patrón: `GlobalTransactionDetail` muestra una vista read-only (hero + detail rows) con acciones en el header (`TxActionsMenu`) y la edición en un `Drawer` que monta `MovementForm variant="drawer"`.

Hechos del código verificados en explore (2026-06-15):
- **Mutaciones completas**: `updateRecurrence`, `pauseRecurrence`, `resumeRecurrence`, `deleteRecurrence` existen como server actions y el form inline ya las invoca correctamente. No hay backend que tocar.
- **`TxActionsMenu` no es un kebab**: renderiza hasta dos icon-buttons directos (✏️/🗑️), no un dropdown. Para recurrencias hay **tres** acciones (Editar / Pausar-Reactivar / Eliminar) → se extiende a A1 (tres icon-buttons), decisión tomada con el usuario.
- **Edit es un field set reducido**: el form inline solo edita amount/frequency/end_date/description. `account_id`, `category_id` y `movement_type` se fijan al crear (`create-recurrence-modal.tsx`) y no son editables. → el drawer de edición NO es el form de creación.
- **Chrome ya resuelto**: `recurring/[id]/layout.tsx` ya renderiza el back-link "← Recurrencias". El detalle de movimiento ubica sus acciones en el cuerpo (top-right), no en un slot del header.
- **`Drawer`** (`components/ui/drawer.tsx`): API `{ open, onClose, ariaLabel, children }`.
- **`RecurrenceDetail`** (lib/recurrences/types): `RecurrenceSummary & { instances }`, con `account`, `destination_account`, `category`, `subcategory`, `pending_instance`, `status: 'active'|'paused'|'deleted'`, `frequency`, `amount`, `currency_code`, `end_date`, `description`, `created_at`.

## Goals / Non-Goals

**Goals:**
- Alinear la pantalla de detalle de recurrencia al lenguaje de `/transactions/[txId]`: read-only por defecto, editar en drawer, acciones en header.
- Patrón A1: tres icon-buttons (Editar / Pausar-Reactivar / Eliminar) arriba a la derecha del detail.
- Borrado con Radix `AlertDialog` (no `confirm()` nativo).
- Mantener `RecurrenceInstancesList` debajo.

**Non-Goals:**
- Cambiar mutaciones, queries o schema — todo el backend se reusa.
- Hacer editable account / categoría / movement_type (siguen fijos post-creación).
- Extraer un `@grana/recurrence-form` o generalizar los primitivos `Tx*` (ver Decisión 4).
- Tocar la pantalla lista `/transactions/recurring` ni el modal de creación.

## Decisions

**Decisión 1 — Tres icon-buttons en el header (A1), no un dropdown.**
Replica `TxActionsMenu` (icon-buttons directos) extendido a la acción de estado propia de recurrencias. Pausar/Reactivar es un único botón que togglea según `status`. Edición abre el drawer; borrado abre el `AlertDialog`. Las acciones se renderizan en el cuerpo del detail (top-right, `justify-end`), igual que la referencia.
- _Alternativa descartada_: dropdown `⋮` (A2) — diverge del lenguaje visual de la referencia que el usuario quiere replicar. Hybrid (A3) descartado: no hay razón para promover Pausar a primer nivel sobre las otras dos.

**Decisión 2 — Edit drawer con form reducido propio, no reuso del create-modal.**
El drawer monta un form de 4 campos (amount/frequency/end_date/description) que llama `updateRecurrence` y cierra + `router.refresh()` al success. No reusa `create-recurrence-modal.tsx` porque ese form incluye pickers de cuenta/categoría/tipo que aquí no aplican (campos fijos). Se extrae la lógica de guardado del actual `RecurrenceDetailForm` casi tal cual, movida adentro del drawer.
- _Alternativa descartada_: un form compartido create/edit con campos ocultos en modo edit — agrega branching condicional a un form ya cargado; no se justifica para 4 campos.

**Decisión 3 — Detail read-only con filas locales, refrescado por `router.refresh()`.**
La page sigue siendo RSC (server-rendered) y pasa `rule: RecurrenceDetail` al detail component. La vista read-only arma filas (frecuencia, monto, cuenta/destino, categoría, próxima fecha, end-date, creada el). Tras editar/pausar/reactivar, las header actions y el drawer disparan `router.refresh()` para re-render del RSC (mismo patrón que el form inline hoy). Borrado navega a `/transactions/recurring`.

**Decisión 4 — Filas read-only locales a recurrencia, sin generalizar los primitivos `Tx*`.**
`TxHero/TxContextNote/TxDetailGroup/TxDetailRow` viven en `[txId]/_components/` y están modelados sobre `FinancialMovement`. Los datos de una recurrencia difieren (frecuencia, próxima fecha, sin period/cuotas/reintegros). Se escriben filas read-only locales en `recurring/[id]/_components/`. Coherente con la regla de no extraer hasta que la duplicación real lo justifique (≥2 rutas) — acá la forma se parece pero el contenido no se comparte.
- _Si al implementar la similitud visual es altísima_, evaluar reusar `TxDetailRow`/`TxDetailGroup` como primitivos presentacionales puros (sin acoplarlos a movimientos). Decidir en `apply`, no ahora.

**Decisión 5 — `AlertDialog` de borrado clonado del patrón `TxActionsMenu`.**
Mismo Radix `AlertDialog` con copy contextual de recurrencia (reusar `recurrences.confirmations.delete` o clave equivalente). Reemplaza el `confirm()` nativo del form actual.

## Risks / Trade-offs

- **[Duplicación de la lógica de mutación al partir el form inline]** → El `RecurrenceDetailForm` actual concentra save/pause/resume/delete. Al repartirlo (drawer = save; header = pause/resume/delete), parte de la lógica de pending/error se reescribe. Mitigación: extraer mínimos helpers compartidos si aparece duplicación real; mantener cada pieza thin.
- **[Divergencia sutil vs la referencia]** → la referencia tiene 2 acciones, nosotros 3; el usuario ya validó A1. Documentado como decisión, no como copia literal.
- **[i18n]** → labels del detail read-only y copy del AlertDialog: reusar `recurrences.*` existentes donde se pueda; agregar solo las faltantes.

## Migration Plan

1. Crear el detail read-only component + las filas locales.
2. Crear las header actions (icon-buttons + AlertDialog de delete + toggle pause/resume).
3. Crear el edit drawer con el form reducido (mueve la lógica de save del form inline).
4. Cablear todo en `page.tsx`; borrar `recurrence-detail-form.tsx`.
5. Delta ADDED en el spec `transactions`.
6. `pnpm lint` + `pnpm typecheck`; verificación manual (read-only por defecto, editar en drawer, pausar/reactivar, borrar con diálogo, instancias intactas).

Rollback: revertir el commit; sin estado persistente ni migraciones.

## Open Questions

- ¿La vista read-only previsualiza las próximas N instancias, o eso queda 100% en `RecurrenceInstancesList` debajo? Lean: solo "próxima fecha" en el detail; la lista completa abajo evita redundancia. Confirmar en `apply`.
- ¿Reusar `TxDetailRow`/`TxDetailGroup` como primitivos puros vs filas locales? Decidir al ver el diff real (Decisión 4).
