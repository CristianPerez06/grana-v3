## Why

Hoy `/shared/settings` (web) mezcla lectura y edición: nombre del hogar y reparto por defecto se editan **inline** con inputs siempre visibles y un botón "OK", lo que vuelve la pantalla ruidosa y confunde qué es dato actual y qué es acción. El nuevo handoff de diseño (`docs/design/shared-settings/`) la reordena como una **vista de configuración readonly** con valores actuales a la vista y **drawers enfocados** para los pocos campos editables. Es momento de hacerlo sobre web (la ruta nativa mobile de Compartido no existe) sin tocar mutaciones ni semántica.

## What Changes

- **Vista readonly:** la página muestra valores actuales sin inputs inline:
  - nombre del hogar como texto readonly, con acción `Editar`.
  - lista de integrantes readonly (nombre + rol).
  - resumen del reparto por defecto (ambos integrantes con su %) cuando hay exactamente dos miembros, con acción `Editar`.
  - bloque de invitación inline (`InviteCard`) cuando hay menos de dos miembros.
  - zona destructiva "Salir del hogar".
- **Drawers enfocados** (usando el primitivo `Drawer` existente):
  - `Editar` nombre abre un drawer con el `Input` de nombre existente + Guardar/Cancelar; guarda con `updateHouseholdConfig({ name })`.
  - `Editar` reparto abre un drawer con el `Input` numérico del primer integrante, el complemento derivado `100 - primero` como texto, + Guardar/Cancelar; guarda con `updateHouseholdConfig({ default_split })`.
- **Ajustes visuales:** los botones `Editar` quedan neutros/secundarios; el verde se reserva para el `Guardar` del drawer. El pill de rol `Creador/a` deja de ser verde (pasa a slate/blue-gray) y `Miembro` queda neutro, para no competir con las acciones positivas.
- **Sin cambios de comportamiento:** se preservan tal cual ambas mutaciones de `updateHouseholdConfig`, su `revalidatePath` + `router.refresh` (sin redirect nuevo), `InviteCard`, y el patrón destructivo de `LeaveHouseholdDialog` (confirmación, bloqueo server-side por deuda viva, redirect a `/shared`).
- **No incluye:** nuevos datos, settings, roles, permisos, queries ni summaries; ni implementación mobile nativa (se difiere; el mock mobile es referencia responsive/futura).

## Capabilities

### New Capabilities
<!-- Ninguna. -->

### Modified Capabilities

- `shared`: el requirement del **split por defecto** cambia su contrato de presentación en `/shared/settings` — la página pasa de input editable inline a **resumen readonly + input editable dentro de un drawer enfocado** (regla de derivación `100 - primero` y validación sin cambios). Además se agrega que el **nombre del hogar** se presenta readonly en la página y su edición ocurre en un drawer enfocado con la misma mutación existente. El requirement de **salir del hogar** se mantiene **sin cambios** (sigue siendo `Dialog` destructivo, no drawer).

## Impact

- **Web:** `apps/web/app/(app)/shared/settings/_components/settings-form.tsx` (reescritura a vista readonly + disparadores de drawer); nuevos componentes de drawer locales a la ruta (`name-edit-drawer`, `default-split-edit-drawer`); recolor del pill de rol. Sin cambios en `page.tsx`/`layout.tsx`/`loading.tsx` salvo lo necesario.
- **Mutaciones / acciones:** ninguna. `updateHouseholdConfig`, `createInvite`, `leaveHousehold` y `LeaveHouseholdDialog` quedan intactas.
- **Primitivos:** se reutiliza `Drawer` (Radix Dialog, `side` left/right; en narrow es full-width — no hay variante bottom-sheet y no se agrega una). `Button`, `Input`, `Label`, `Alert`, `InviteCard` sin cambios de API.
- **i18n:** nuevas claves en `packages/i18n-messages/src/es.json` + `en.json` (no existe `common.edit`; faltan eyebrow y títulos de drawer), respetando la paridad de claves es/en. `common.save`/`common.cancel` se reutilizan en el footer del drawer.
- **Specs:** delta en `shared`. Sin cambios en `overlay-primitives` (se usa el primitivo tal cual) ni en otras capabilities.
