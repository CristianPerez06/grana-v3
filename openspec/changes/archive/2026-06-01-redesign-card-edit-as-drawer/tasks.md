# Tareas — Rediseño de "Editar tarjeta" como drawer

## 1. Drawer + form

- [x] 1.1 `EditCardForm` (`cards/[id]/_components/edit-card-form.tsx`) con `variant: 'drawer' | 'page'`, header/body/footer del drawer reusando el patrón de `movement-form`.
- [x] 1.2 `EditCardDrawerProvider` + `useEditCardDrawer` (`cards/[id]/_components/edit-card-drawer.tsx`) sobre el primitivo `Drawer`, remontando el form con `key` en cada apertura.
- [x] 1.3 Trigger "Editar" del detalle (`card-actions.tsx`, rama activa) abre el drawer; archivar/eliminar se mudan al drawer.
- [x] 1.4 `EditCardDrawerProvider` montado en las ramas activas de `cards/[id]/page.tsx` con los datos de la tarjeta.

## 2. Campos y preview

- [x] 2.1 Vista previa en vivo (acento del backend, avatar, meta red·banco, límite + barra, mini-ciclo).
- [x] 2.2 Identidad (nombre + buscador de banco), red read-only con candado, límite plano (`MoneyAmountInput`).
- [x] 2.3 Ciclo editable: 4 fechas (actual + próximo) con validaciones y hint de cascada / próximo pagado.
- [x] 2.4 Acciones: Archivar (con `DeactivateBlockDialog`) y Eliminar (deshabilitado si hay movimientos), componiendo el primitivo `Button`.

## 3. Persistencia

- [x] 3.1 Guardar persiste nombre/banco/límite vía `updateCreditCard`.
- [x] 3.2 Fechas del ciclo vía `updatePeriodDates` (actual primero, luego próximo; solo las que cambiaron).
- [x] 3.3 Confirmación de descarte si hay cambios sin guardar; Guardar deshabilitado sin cambios.

## 4. Rutas e i18n

- [x] 4.1 `/cards/[id]/edit` reescrita como fallback no-JS renderizando el mismo `EditCardForm` (`variant="page"`).
- [x] 4.2 Eliminado el `edit-credit-card-form.tsx` viejo.
- [x] 4.3 Claves i18n nuevas en `cards.edit` (`packages/i18n-messages/src/es.json`).
- [x] 4.4 Helper compartido `resolveEditCycle` en `card-presentation.ts`.

## 5. Verificación

- [x] 5.1 `pnpm --filter web typecheck` limpio.
- [x] 5.2 `pnpm --filter web lint` limpio (solo warning preexistente ajeno).
- [x] 5.3 `pnpm --filter web build` OK.
- [x] 5.4 `pnpm --filter web test` (302 tests) en verde.
