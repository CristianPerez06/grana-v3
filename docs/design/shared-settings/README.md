# Propuesta visual `/shared/settings`

## Contexto

Esta propuesta aplica `docs/design/route-ui-system.md` a la ruta `/shared/settings`. El alcance es solo la configuracion del hogar compartido; no incluye `/shared`, `/shared/settle` ni otras rutas.

La ruta mobile nativa de Compartido no existe hoy. El mock mobile de este bundle es una referencia responsive/futura, no scope de implementacion nativa inmediata.

## Implementacion inspeccionada

- `apps/web/app/(app)/shared/settings/layout.tsx`
- `apps/web/app/(app)/shared/settings/page.tsx`
- `apps/web/app/(app)/shared/settings/loading.tsx`
- `apps/web/app/(app)/shared/settings/_components/settings-form.tsx`
- `apps/web/app/(app)/shared/_components/invite-card.tsx`
- `apps/web/lib/shared/queries.ts`

## Datos disponibles

- Header con titulo `shared.settings.title` y back link a `/shared`.
- `household.name`.
- `household.members`, incluyendo `fullName` e `isCreator`.
- `household.defaultSplit`.
- Estado de dos miembros (`household.members.length === 2`).
- Formulario para guardar nombre.
- Lista de miembros con badge creador/miembro.
- Control de porcentaje default para dos miembros:
  - porcentaje del primer miembro.
  - porcentaje complementario del segundo miembro.
  - accion OK para guardar.
- Invitacion condicional cuando hay menos de dos miembros:
  - generar codigo.
  - copiar.
  - WhatsApp.
  - compartir.
- Accion destructiva para salir del hogar.
- Alert de error.
- Loading skeleton.

## Direccion propuesta

- Mantener la ruta como formulario de configuracion, no convertirla en dashboard.
- Aumentar el ancho de `max-w-lg` a un ancho moderado cercano a `760px`, igual que `/settings`.
- Agrupar el formulario en secciones con paneles consistentes:
  - nombre del hogar.
  - miembros.
  - reparto por defecto, solo si hay dos miembros.
  - invitacion, solo si falta el segundo miembro.
  - zona destructiva.
- Mantener el header simple con `PageHeader` y back link.
- Hacer el split mas legible: dos nombres visibles, input numerico acotado para el primer porcentaje, porcentaje complementario claro para el segundo, boton OK alineado.
- En mobile, apilar los campos y hacer que las acciones ocupen ancho completo.

## Recomendaciones

- No agregar nuevos permisos, roles, historiales, metricas ni confirmaciones que no existan.
- Conservar `Button`, `Input`, `Label`, `Card`, `Alert` e `InviteCard`.
- El input de porcentaje puede seguir siendo numerico: no es un campo monetario.
- No cambiar la logica de `default_split`; la UI solo edita el porcentaje existente del primer miembro y deriva `100 - firstPct`.
- Si se quiere agregar modal de confirmacion para salir del hogar, eso es nuevo comportamiento y debe pasar por OpenSpec antes.

## Archivos del bundle

- `shared.css`
- `web/shared-settings.html`
- `mobile/shared-settings.html`
- `components/route-shell.html`
- `components/name-section.html`
- `components/members-list.html`
- `components/default-split-section.html`
- `components/invite-section.html`
- `components/leave-section.html`
- `components/error-state.html`
- `components/loading-state.html`
