## 1. i18n — copy nuevo (ambos catálogos)

- [x] 1.1 Agregar a `packages/i18n-messages/src/es.json` y `en.json`, bajo `shared.settings.*`:
  - `leave_confirm_title` (es "¿Salir del hogar?" / en "Leave household?")
  - `leave_confirm_body` (es "Vas a salir del hogar compartido. Se conservan los gastos compartidos históricos." / en "You'll leave the shared household. Past shared expenses are kept.")
  - `leave_description` (es "Esta acción te saca del hogar compartido actual." / en "This removes you from the current shared household.")
  - `default_split_first_label` (es "Primer integrante" / en "First member")
  - `default_split_complement_label` (es "Complementario" / en "Remainder")
- [x] 1.2 Verificar paridad de claves entre `es.json` y `en.json` (1194/1194, sin diferencias)

## 2. Web — confirmación de salida (comportamiento nuevo)

- [x] 2.1 Crear `apps/web/app/(app)/shared/settings/_components/leave-household-dialog.tsx`, espejo de `AccountConfirmDialog`: `open`/`onClose` controlados, CTA `variant="destructive"` con `loading`, `formError` inline en `DialogBody` (incluye el bloqueo por deuda viva), redirige a `/shared` en éxito. Título/cuerpo desde `shared.settings.leave_confirm_*`; CTA reusa `shared.settings.leave_action`; cancelar reusa `common.cancel`.
- [x] 2.2 En `settings-form.tsx`, el botón "Salir del hogar" abre el diálogo en vez de invocar `leaveHousehold` directo; mover la lógica de `onLeave` al diálogo

## 3. Web — copy descriptivo y captions

- [x] 3.1 Agregar la línea descriptiva (`shared.settings.leave_description`) en la sección de salida
- [x] 3.2 Rotular a ambos integrantes en la sección de split con `default_split_first_label` / `default_split_complement_label`, manteniendo edición sólo del primer porcentaje y derivación `100 - primero`

## 4. Web — layout visual de la ruta (ya implementado en la branch)

- [x] 4.1 Ruta a `max-w-[760px]`, secciones en paneles `rounded-2xl border bg-card`, `PageHeader` simple con back link a `/shared`
- [x] 4.2 Lista de integrantes con avatar de iniciales + badge creador/miembro; split legible con ambos nombres; loading espejado

## 5. Decisión documentada (sin código)

- [x] 5.1 Confirmar que el botón destructivo usa `<Button variant="destructive">` (rojo suave del primitivo); la divergencia con el rojo sólido del mock queda como diferencia intencional documentada en `design.md` (no se agrega override por instancia)

## 6. Verificación

- [x] 6.1 `pnpm --filter web lint` y `pnpm --filter web typecheck` en verde
- [x] 6.2 `openspec validate household-settings-design-parity --strict` en verde
- [x] 6.3 Revisión visual contra `docs/design/shared-settings/web/shared-settings.html`: secciones, split con captions, zona destructiva con descripción + confirmación
