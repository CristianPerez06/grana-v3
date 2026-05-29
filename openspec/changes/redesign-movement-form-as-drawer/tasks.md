# Tareas — Form de movimientos como drawer

> Depende de `add-custom-recurrence-frequency` (fase 1) y `add-overlay-primitives` (fase 2). No empezar grupos 4–7 hasta que esas fases estén mergeadas.

## Grupo 1 · Drawer wrapper (web) reusando el form actual

- [ ] 1.1. Montar `movement-form.tsx` existente dentro del primitivo `Drawer` en `apps/web/app/(app)/transactions/_components/movement-drawer.tsx`. Sin tocar la lógica del form todavía.
- [ ] 1.2. Estado de apertura del drawer (creación/edición) elevado a un provider o store en el shell de `/transactions`.
- [ ] 1.3. Wire de openers: FAB, botón "Registrar movimiento" del header, click en `MovementRow` → abrir drawer en vez de navegar (manteniendo la ruta como fallback).
- [ ] 1.4. Header del drawer: eyebrow + título dinámico (Nuevo/Editar), botón cerrar, botón eliminar (solo edición). Footer: CTA dinámico + "+ Otro".

## Grupo 2 · Estructura visual e interacciones del prototipo (web)

- [ ] 2.1. Selector de tipo con primitivo `Segmented` (5 opciones; deshabilitado en edición). Reconfigura color de monto, helper, labels de cuenta, toggles y CTA al cambiar.
- [ ] 2.2. Amount hero con `MoneyAmountInput`, pill de moneda ARS/USD, color por tipo, autofocus al abrir, helper por tipo (ingreso/ajuste).
- [ ] 2.3. Sign toggle (Sumar/Restar) + context banner ámbar + preview de saldo — solo Ajuste.
- [ ] 2.4. Filas de campos clickeables (cuenta origen, cuenta destino + swap, categoría, fecha) que abren `Popover`. Cuentas con `AccountAvatar`.
- [ ] 2.5. Toggles con primitivo `Switch`: "Tiene reintegro" (Gasto) y "Repetir" (Gasto/Ingreso/Transferencia), con paneles desplegables.

## Grupo 3 · Selector de categoría con drill

- [ ] 3.1. Popover de categoría de dos niveles reusando `getAllCategories` y el lenguaje visual de `spending-by-category` (chevron `›`, "Toda la categoría", volver).
- [ ] 3.2. Chip "Sugerida" alimentado por `suggestCategoryFromHistory` (on blur de descripción); se quita al elegir manualmente.

## Grupo 4 · Quinto tab: Cambio de moneda

- [ ] 4.1. Layout exchange (cuenta+moneda origen / cuenta+moneda destino, helper de tasa), reusando `createExchange`/`updateExchange`. **Validar diseño con Producto/Diseño antes de cerrar.**
- [ ] 4.2. Decidir con Producto si "Repetir" aplica a exchange (default: ocultar).

## Grupo 5 · Cuotas, reintegro, repetir (con Personalizado)

- [ ] 5.1. Cuotas card: aparece con cuenta de crédito en Gasto; pills 1×–24×; breakdown "N cuotas de $X · primera vence …". Reusa `registerInstallments`/`registerCardPurchase`.
- [ ] 5.2. Panel de reintegro: usa `reimbursementDeclarationSchema` anidado en el gasto.
- [ ] 5.3. Panel de Repetir: freq-pills Semanal/Quincenal/Mensual/Anual/**Personalizado**; el control de Personalizado (`cada N · unidad` + fin) consume `add-custom-recurrence-frequency`. Al guardar, `createRecurrenceFromMovement`.

## Grupo 6 · "+ Otro", edición y atajos

- [ ] 6.1. "+ Otro": guarda, limpia monto+descripción, mantiene cuenta/fecha/tipo, refoca el monto. Oculto en edición.
- [ ] 6.2. Modo edición: precarga el movimiento real, `editableFields`, tipo deshabilitado, reglas de borrado, CTA "Guardar cambios".
- [ ] 6.3. Atajos: Esc (popover → drawer) y ⌘/Ctrl+Enter (submit).

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
