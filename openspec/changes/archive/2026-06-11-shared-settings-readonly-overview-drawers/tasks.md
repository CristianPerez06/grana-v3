## 1. i18n (paridad es/en)

- [x] 1.1 Agregar en `packages/i18n-messages/src/es.json` y `en.json`, bajo `shared.settings.*`, las claves de drawer: `edit_action` (es "Editar" / en "Edit"), `drawer_eyebrow` (es "Compartido" / en "Shared"), `name_drawer_title` (es "Editar nombre" / en "Edit name"), `split_drawer_title` (es "Editar reparto" / en "Edit split")
- [x] 1.2 Verificar paridad de claves entre `es.json` y `en.json` (sin diferencias); confirmar que `common.save`/`common.cancel` existen para el footer del drawer

## 2. Drawer de edición de nombre

- [x] 2.1 Crear `apps/web/app/(app)/shared/settings/_components/name-edit-drawer.tsx`: client component que recibe `open`, `onClose`, valor inicial del nombre y un `onSave`; usa el primitivo `Drawer`, el `Input` de nombre (precargado, `maxLength=50`) y footer con `Cancelar` (secundario) + `Guardar` (verde/primario)
- [x] 2.2 Sembrar el borrador del nombre al abrir; `Guardar` deshabilitado con nombre vacío; cerrar por `Cancelar`/scrim/`Esc` no muta

## 3. Drawer de edición de reparto

- [x] 3.1 Crear `apps/web/app/(app)/shared/settings/_components/default-split-edit-drawer.tsx`: recibe `open`, `onClose`, nombres de ambos integrantes, `firstPct` inicial y `onSave`; usa `Drawer` con el `Input` numérico del primer integrante (1–99) y el complemento `100 - firstPct` como texto readonly, footer `Cancelar` + `Guardar`
- [x] 3.2 Sembrar `firstPct` desde el split almacenado (`defaultSplit.find(... members[0].userId)?.percentage ?? 50`); cerrar por `Cancelar`/scrim/`Esc` no muta

## 4. Reescritura de la página a vista readonly

- [x] 4.1 Reescribir `apps/web/app/(app)/shared/settings/_components/settings-form.tsx` para mostrar readonly: nombre (texto + botón `Editar` neutro), integrantes (lista actual), resumen de reparto (ambos nombres + %, + botón `Editar` neutro) sólo con dos miembros, `InviteCard` inline con menos de dos miembros, y la sección destructiva
- [x] 4.2 Cablear el estado de apertura (`nameOpen`, `splitOpen`) y montar `NameEditDrawer` y `DefaultSplitEditDrawer`; `onSave` reutiliza el helper `run()` con `updateHouseholdConfig({ name })` / `updateHouseholdConfig({ default_split: [first, 100-first] })`, cierra el drawer en éxito y hace `router.refresh()`
- [x] 4.3 Mantener `LeaveHouseholdDialog` intacto (sigue siendo `Dialog`, no drawer); preservar el `Alert` de error compartido

## 5. Ajustes visuales

- [x] 5.1 Recolorear el pill de rol: `Creador/a` a slate/blue-gray (fuera del verde), `Miembro` neutro; confirmar que `Editar` queda neutro/secundario y que el único verde del flujo es `Guardar`

## 6. Verificación

- [x] 6.1 `pnpm --filter web lint` y `pnpm --filter web typecheck` en verde
- [x] 6.2 `pnpm --filter web test` en verde
- [x] 6.3 `openspec validate shared-settings-readonly-overview-drawers --strict` en verde
- [x] 6.4 Revisión visual contra `docs/design/shared-settings/web/shared-settings.html` y los componentes de drawer: nombre/reparto readonly + drawers de edición; verificar que guardar nombre y reparto persiste vía las mutaciones existentes y que cancelar no muta
