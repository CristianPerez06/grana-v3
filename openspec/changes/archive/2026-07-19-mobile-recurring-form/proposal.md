## Why

El hub de recurrencias nativo (③.1, ya shipeado) es **manage-only**: lista reglas por estado, muestra el detalle read-only, pausa/reactiva/elimina y confirma pendientes. Pero **no puede crear una regla desde cero ni editar sus campos** — hoy la única forma de crear una recurrencia en mobile es el toggle "Repetir" del alta de movimiento (`createRecurrenceFromMovement`), que además **crea un movimiento hoy**. No hay forma de programar una regla a futuro (el alquiler que empieza el mes que viene, el sueldo que todavía no cobré) ni de corregir el monto/frecuencia/fin de una regla existente.

La web sí las tiene, como **dos superficies deliberadamente separadas**: un `CreateRecurrenceModal` (crea sólo la regla vía `createRecurrence`, sin movimiento — la primera ocurrencia cae como instancia **pendiente**) y un `RecurrenceEditDrawer` de 4 campos (`updateRecurrence`). El toggle "Repetir" del form de movimiento es un tercer camino, independiente.

El bloqueo NO es de datos ni de arquitectura: `createRecurrence` y `updateRecurrence` **ya son isomórficos** en `@grana/recurrences` (extraídos en ③.1), y los primitivos de picker que el form necesita (`SelectSheet`, `SelectField`, `MoneyAmountInput`, `Segmented`, `Switch`, `DateField`, `AccountAvatar`) **ya existen** como componentes reusables — `MovementForm` los compone, no los define inline. Lo único que falta es el **wiring de UI**: dos forms nativos y sus afordancias de entrada.

## What Changes

- **Form de creación de regla desde cero** (`/transactions/recurring/new` + `RecurrenceForm`): un form nativo **dedicado** (Option C — no reusa `MovementForm`) que compone los primitivos existentes. Campos: tipo (ingreso/gasto/transferencia — sin ajuste/cambio/cuotas), cuenta (elegibilidad por tipo: sólo gasto admite tarjeta), moneda, monto, categoría+subcategoría (o cuenta destino en transferencia), descripción, **fecha de inicio** (default hoy), **frecuencia** (preset + custom con intervalo), **fecha de fin** opcional, **máximo de ocurrencias** opcional, y **compartir** (template de split, gasto + hogar de 2). Al guardar invoca `createRecurrence` (crea sólo la regla; la primera instancia vencida se materializa como **pendiente**), invalida el cache y vuelve al hub. Entry: una afordancia **"+"** en el header del hub.
- **Form de edición de regla** (`RecurrenceEditForm`, sheet desde el header del detalle): edita el **subconjunto mutable** — monto, frecuencia, fecha de fin, descripción — vía `updateRecurrence`. Cuenta, categoría y tipo son **fijos en la creación** (la instancia es un snapshot de la regla; paridad con el drawer web). Al guardar invalida el detalle + el hub y cierra el sheet. Entry: una afordancia **Editar** en el header del detalle.
- **Mutators mobile nuevos** en `apps/mobile/lib/recurrences/mutators.ts`: `createRecurrence` (resuelve auth, trae el hogar y lo mapea a `RecurrenceHousehold`, delega en el package) y `updateRecurrence` (auth + delega). Thin — la validación y el write viven en `@grana/recurrences`.
- **Afordancias de entrada**: el header del **hub** gana un icon-button "+" → `/transactions/recurring/new`; el header del **detalle** gana un icon-button Editar que abre el sheet. El comentario "never opens an edit form" de `[id].tsx` deja de ser cierto.

## Capabilities

### Added Capabilities

- `transactions`: **"La app nativa crea una regla recurrente desde cero"** — form dedicado `/transactions/recurring/new` (income/expense/transfer + cadencia + compartir) que compone los primitivos existentes y llama a `createRecurrence`; crea sólo la regla (sin movimiento hoy), la primera ocurrencia cae como pendiente.
- `transactions`: **"La app nativa edita los campos mutables de una regla recurrente"** — sheet de edición (monto/frecuencia/fin/descripción) vía `updateRecurrence`; cuenta/categoría/tipo son inmutables.

### Modified Capabilities

- `transactions`: **"La app nativa expone el hub de recurrencias `/transactions/recurring`"** — el hub gana la afordancia de **crear** ("+" en el header → `/transactions/recurring/new`).
- `transactions`: **"La app nativa expone el detalle de una regla recurrente con pausar/reanudar/eliminar"** — el detalle gana la afordancia de **editar** (reemplaza el escenario "no ofrece editar ni crear").

## Impact

- **Packages**: ninguno nuevo. `createRecurrence`/`updateRecurrence` ya existen en `@grana/recurrences`. Sin cambios de datos/API/RLS/migraciones/validation.
- **Mobile**: nuevos `apps/mobile/app/(app)/transactions/recurring/new.tsx`, `components/recurrences/RecurrenceForm.tsx` y `RecurrenceEditForm.tsx`; se editan `mutators.ts` (+2 mutators), `recurring/index.tsx` (afordancia "+") y `recurring/[id].tsx` (afordancia Editar + montaje del sheet). Reusa `SelectSheet`/`SelectField`/`MoneyAmountInput`/`Segmented`/`Switch`/`DateField`/`AccountAvatar`/`Drawer`/`PageHeader`, la elegibilidad de cuenta y el split del form de movimiento. Sin deps nuevas.
- **i18n**: el namespace `recurrences.*` de `@grana/i18n-messages` **ya trae** las keys de create/edit (`recurrences.create.*`, `recurrences.edit_title`, `recurrences.actions.save_changes`/`create`, `recurrences.labels.*`, `recurrences.custom_interval.*`, `recurrences.create.{start_date,has_end_date,max_occurrences,errors.*}`). Se reusan; el objetivo es cero (o casi cero) keys nuevas.
- **Dependencias entre changes**: cierra §3 (recurring management) del backlog de paridad. No toca §4 restante (filtros del feed, breakdown/donut, reintegro, tile de recurrencia en el detalle de movimiento).

### Fuera de scope

- **Reusar `MovementForm` para crear** (Option B): descartado — acoplaría la creación de regla al hot path del alta de movimiento (fork en un componente de 1120 líneas + el hook compartido) sin ahorrar código de pickers (ya son primitivos). Se elige el form dedicado (Option C), espejo del diseño de dos superficies de la web. Ver `design.md`.
- **Editar cuenta/categoría/tipo de una regla existente**: inmutables por diseño (la instancia es un snapshot); paridad con el drawer web.
- **Warning de saldo negativo** en el form / pendientes: sigue diferido (requiere el read de saldos por cuenta).
- **Tile de recurrencia en el detalle de movimiento** y demás slices de §4.
