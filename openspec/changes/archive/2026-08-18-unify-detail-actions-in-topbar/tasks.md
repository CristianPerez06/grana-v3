## 1. Web — dos icon buttons en la topbar, en todo viewport

- [x] 1.1 En `detail-actions.tsx`, sacar el gate `hidden … sm:flex` del par Eliminar + Editar para que se renderice en cualquier viewport.
- [x] 1.2 Eliminar el bloque `sm:hidden` del menú "···" (`DropdownMenu` + `DropdownMenuItemDestructive`) y el bloque `sm:hidden` de la barra inferior fija con "Editar movimiento".
- [x] 1.3 Limpiar los imports que quedan sin uso: `MoreHorizontal`, los cuatro de `@/components/ui/dropdown-menu` y `Button`.
- [x] 1.4 Actualizar el comentario de cabecera del archivo: ya no describe una disposición mobile distinta.
- [x] 1.5 En `global-transaction-detail.tsx`, bajar el contenedor de `pb-24 sm:pb-2` a `pb-6 sm:pb-2` — el padding grande sólo existía para no quedar tapado por la barra fija.

## 2. i18n — claves huérfanas

- [x] 2.1 Eliminar `transactions.detail.actions.more` y `transactions.detail.actions.edit_movement` de `es.json` y `en.json` (sin uso tras 1.2).
- [x] 2.2 Eliminar también `transactions.detail.actions.menu_label`, huérfana desde que se sacó el kebab, verificando antes que no la referencie ningún `.ts`/`.tsx`.

## 2b. Ruta de edición — una sola afordancia de volver

- [x] 2b.1 Sacar `<TxBackLink />` de `transactions/[txId]/edit/page.tsx`: el layout ya monta `EditChrome`, cuyo `PageHeader` trae el título y el "← Detalle". Había dos flechas apiladas hacia destinos distintos.
- [x] 2b.2 Eliminar `_components/tx-back-link.tsx`, sin otro consumidor tras 2b.1.

## 3. Nativa — verificar que ya cumple

- [x] 3.1 Confirmar que `apps/mobile/app/(app)/transactions/[txId]/index.tsx` ya renderiza Eliminar + Editar como icon buttons en el `actions` del `PageHeader`, gateados por `canDelete` / `canEdit`. No editar el archivo.

## 4. Verificación

> 4.2–4.6 son verificación manual en navegador y simulador. `apps/web` y `apps/mobile` no tienen tests de componente para el detalle, así que quedan como checklist para quien corra la app; el diff no las cubre.

- [x] 4.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` (web) y `pnpm typecheck:mobile`, `pnpm lint:mobile`.
- [ ] 4.2 **Web angosto**: abrir el detalle de un gasto propio. La topbar muestra los dos iconos; no hay "···" ni barra inferior; el final del scroll no queda tapado.
- [ ] 4.3 **Web angosto**: scrollear hasta abajo y confirmar que la topbar sticky mantiene los dos iconos accesibles.
- [ ] 4.4 **Web angosto**: tocar Editar (abre el drawer en contexto donde está disponible, o navega a `[txId]/edit`) y tocar Eliminar (abre el `AlertDialog` con la copy que corresponda: default, madre de cuotas, pago de resumen).
- [ ] 4.5 **Web angosto**: un movimiento sin acciones (cuota hija, movimiento ajeno) no muestra ningún icono y la topbar queda sólo con el "volver".
- [ ] 4.5b **Ruta `/transactions/<id>/edit`**: una sola afordancia de volver ("← Detalle", del layout), no dos apiladas.
- [ ] 4.6 **Web ancho y app nativa**: sin regresión — el escritorio queda igual que antes y la nativa no se tocó.

## 5. Cierre

- [x] 5.1 Archivar la change antes del merge según el checklist de `AGENTS.md`: mover a `openspec/changes/archive/YYYY-MM-DD-unify-detail-actions-in-topbar/` y aplicar el rename + el delta sobre `openspec/specs/transactions/spec.md`.
- [x] 5.2 Correr `pnpm openspec:check` en la branch. Debe pasar antes del merge.
