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
- Valor actual del nombre del hogar.
- Edicion de nombre del hogar con la misma mutacion existente.
- Lista de miembros con badge creador/miembro.
- Valor actual del reparto por defecto para dos miembros:
  - porcentaje del primer miembro.
  - porcentaje complementario del segundo miembro.
- Edicion del reparto por defecto con la misma mutacion existente.
- Invitacion condicional cuando hay menos de dos miembros:
  - generar codigo.
  - copiar.
  - WhatsApp.
  - compartir.
- Accion destructiva para salir del hogar.
- Alert de error.
- Loading skeleton.

## Direccion propuesta

- Mantener la ruta como una vista de configuracion, no convertirla en dashboard.
- Aumentar el ancho de `max-w-lg` a un ancho moderado cercano a `760px`, igual que `/settings`.
- Separar lectura y edicion:
  - la pagina muestra valores actuales y datos readonly.
  - las secciones editables abren un drawer enfocado.
- Agrupar las secciones en paneles consistentes:
  - nombre del hogar con accion `Editar`.
  - miembros readonly.
  - reparto por defecto con accion `Editar`, solo si hay dos miembros.
  - invitacion, solo si falta el segundo miembro.
  - zona destructiva.
- Mantener el header simple con `PageHeader` y back link.
- Usar drawer para:
  - editar nombre del hogar.
  - editar reparto por defecto.
- No usar drawer para:
  - integrantes, porque es readonly.
  - invitacion, porque ya es un bloque de accion propio.
  - salir del hogar, porque es destructivo y debe conservar su dialog/patron destructivo actual.
- Hacer el split mas legible: la pagina muestra ambos porcentajes como resumen; el drawer muestra el input numerico acotado para el primer porcentaje y el complemento derivado para el segundo.
- En mobile/narrow, el drawer puede comportarse como bottom sheet para dar espacio al formulario.

## Recomendaciones

- No agregar nuevos permisos, roles, historiales, metricas ni confirmaciones que no existan.
- Conservar `Button`, `Input`, `Label`, `Card`, `Alert` e `InviteCard`.
- Componer el drawer con el primitivo existente `Drawer` si se implementa.
- El input de porcentaje puede seguir siendo numerico: no es un campo monetario.
- No cambiar la logica de `default_split`; la UI solo edita el porcentaje existente del primer miembro y deriva `100 - firstPct`.
- Mantener la confirmacion destructiva existente para salir del hogar. Si se cambia esa confirmacion o se agregan pasos nuevos, debe pasar por OpenSpec antes.

## Archivos del bundle

- `shared.css`
- `web/shared-settings.html`
- `mobile/shared-settings.html`
- `components/route-shell.html`
- `components/name-section.html`
- `components/name-edit-drawer.html`
- `components/members-list.html`
- `components/default-split-section.html`
- `components/default-split-edit-drawer.html`
- `components/invite-section.html`
- `components/leave-section.html`
- `components/error-state.html`
- `components/loading-state.html`
