# Tareas — Form de movimientos como drawer

> Depende de `add-custom-recurrence-frequency` (fase 1) y `add-overlay-primitives` (fase 2). No empezar grupos 4–7 hasta que esas fases estén mergeadas.

## Grupo 1 · Drawer wrapper (web) reusando el form actual — ✅ slice 1

- [x] 1.1. Montar `movement-form.tsx` existente dentro del primitivo `Drawer` en `apps/web/app/(app)/transactions/_components/movement-drawer.tsx`. Reusa la lógica intacta; se agregó solo un prop opcional `onSuccess` al form (cerrar+refrescar en vez de navegar).
- [x] 1.2. Estado de apertura elevado a `MovementDrawerProvider` (context en `lib/transactions/movement-drawer-context.ts`, provider en `_components/movement-drawer.tsx`) montado en el shell de `/transactions`.
- [x] 1.3. Wire de openers: **FAB** (mobile) y **CTA desktop** (`RegisterMovementButton` en el `PageHeader`) abren el drawer en create; ambos caen a `/transactions/new` si no hay provider (p. ej. dashboard). **Edición** (decisión de producto, opción 3): la fila sigue yendo a la página de **detalle** (reintegros/cuotas), y el botón "Editar" del detalle abre el **drawer de edición** en vez de navegar a `/[txId]/edit` (que queda como fallback).
- [x] 1.4. Header del drawer hi-fi: eyebrow (NUEVO/EDITAR) + título dinámico + botón cerrar; footer fijo con CTA dinámico (color por tipo + kbd ⌘↵) y "+ Otro" (oculto en edición). El chrome vive en `MovementForm` (prop `variant='drawer'`) para no divergir con las rutas página (`variant='page'`). **Borrado:** queda en el menú del detalle (`TxActionsMenu`), no en el header del drawer (decisión 6.2).

## Grupo 2 · Estructura visual e interacciones del prototipo (web)

- [x] 2.1. Selector de tipo con primitivo `Segmented` (5 opciones; deshabilitado en edición). Reconfigura color de monto, helper, labels de cuenta, toggles y CTA al cambiar.
- [x] 2.2. Amount hero con `MoneyAmountInput`, pill de moneda ARS/USD, color por tipo (ingreso verde, resto navy) + signo, autofocus al abrir (~360ms en drawer), helper por tipo (ingreso/ajuste).
- [x] 2.3. Sign toggle (Sumar/Restar) + context banner ámbar (tokens `--warning*`) + preview de saldo — solo Ajuste.
- [x] 2.4. Filas de campos clickeables (cuenta origen, cuenta destino + swap, categoría, fecha) que abren `Popover`. Cuentas con `AccountAvatar` (resuelto server-side, llevado en `MovementFormAccount.avatar`).
- [x] 2.5. Toggles con primitivo `Switch`: "Tiene reintegro" (Gasto) y "Repetir" (Gasto/Ingreso/Transferencia), con paneles desplegables (icono se tinta verde al activar).

## Grupo 3 · Selector de categoría con drill

- [x] 3.1. Popover de categoría de dos niveles reusando `getAllCategories` y el lenguaje visual de `spending-by-category` (chevron `›`, "Toda la categoría", volver con `‹`).
- [x] 3.2. Chip "Sugerida" alimentado por `suggestCategoryFromHistory` (on blur de descripción); se quita al elegir manualmente. Reusa `CategorySuggestionChip`.

## Grupo 4 · Quinto tab: Cambio de moneda

- [x] 4.1. Layout exchange reusando el lenguaje hi-fi compartido: filas cuenta origen ("Desde") / destino ("Hacia") + fecha (`FieldRow`/`Popover`), monto origen en el hero, y card "Monto recibido" como mini-hero (badge de moneda destino) con **helper de tasa implícita** (`1 USD = $X`, derivada de ambos montos). Reusa `createExchange`/`updateExchange`. (Adoptó los estilos existentes; queda sujeto a validación de Diseño si en el futuro hay mockup propio.)
- [x] 4.2. "Repetir" NO se ofrece en exchange (default: oculto) — el `togglesGroup` excluye `exchange`.

## Grupo 5 · Cuotas, reintegro, repetir (con Personalizado)

- [x] 5.1. Cuotas card hi-fi: aparece con cuenta de crédito en Gasto; pills 1×–24× (scroll-x; activo navy); breakdown "N cuotas de $X". Reusa `registerInstallments`/`registerCardPurchase`. (Pendiente: "primera vence …" requiere datos de período en cliente.)
- [x] 5.2. Panel de reintegro (restyle): toggle `Switch` + panel desplegable, reusando los campos existentes (`reimbursementDeclarationSchema` anidado en el gasto).
- [x] 5.3. Repetir con **Personalizado**: el selector de frecuencia suma "Personalizado", que despliega el control `cada N · unidad` (día/semana/mes/año) + límite de ocurrencias opcional, consumiendo `add-custom-recurrence-frequency`. Al guardar, `createRecurrenceFromMovement` recibe `interval_count`/`interval_unit`/`max_occurrences`. (UI = select + inputs; el restyle a freq-pills hi-fi va con el slice de restyle.)

## Grupo 6 · "+ Otro", edición y atajos

- [x] 6.1. "+ Otro": guarda, limpia monto+descripción (y reset de toggles), mantiene cuenta/fecha/tipo/moneda, refoca el monto. Oculto en edición.
- [x] 6.2. Modo edición en el drawer (desde el detalle): reusa el `MovementForm` en modo edit con `editableFields`, tipo deshabilitado, CTA "Guardar cambios". El contexto se arma con `buildMovementEditContext` (compartido entre la página `/edit` y el drawer). Borrado: sigue en el menú del detalle (`TxActionsMenu`) con sus reglas. Cierra+refresca al guardar.
- [x] 6.3. Atajos: Esc (popover → drawer, vía Radix Popover/Dialog) y ⌘/Ctrl+Enter (submit, handler en el `<form>`).

## Grupo 7 · Extracción de lógica compartida + mobile

- [ ] 7.1. Extraer la lógica pura del form (formato, derivaciones por tipo, mapeo a inputs de actions) a `packages/` (`@grana/money-logic` o `packages/movement-form-logic`). Tests de la lógica extraída.
- [ ] 7.2. Hook `useMovementForm()` compartible (estado + handlers, sin JSX).
- [ ] 7.3. Drawer mobile (`apps/mobile/components/transactions/MovementDrawer.tsx`) usando los primitivos mobile y el hook compartido.
- [ ] 7.4. Wire de openers mobile (FAB, fila).

## Grupo 8 · i18n y verificación

- [ ] 8.1. i18n keys nuevas del drawer (títulos, CTAs, helpers, labels de tipo, exchange) en `packages/i18n-messages/src/{es,en}.json`.
- [ ] 8.2. `pnpm lint`, `pnpm build` (web), tests de transactions verdes; typecheck mobile verde.
- [ ] 8.3. Verificación manual (skill `verify`/`run`): alta de cada tipo, edición, "+ Otro", cuotas, reintegro, repetir custom, exchange, atajos.
- [ ] 8.4. Archivar el change (integrar deltas en `openspec/specs/transactions/spec.md`, actualizar `AGENTS.md` Modules si corresponde) y `pnpm openspec:check` antes del merge.
