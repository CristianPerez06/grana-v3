## 1. Hook compartido

- [x] 1.1 En `use-movement-form.ts`, derivar `isDirty` comparando un snapshot serializado de los campos editables contra el del primer render (`useRef`).
- [x] 1.2 Condicionar el bloque de reintegro dentro del snapshot a `reimbursementEnabled`, para que el efecto de montaje que elige la cuenta por defecto no ensucie el formulario.
- [x] 1.3 Exponer `isDirty` en el retorno del hook y declararlo en `MovementFormResult` (`types.ts`), documentado.
- [x] 1.4 Tests: pristine al abrir (alta y edición), se ensucia al cambiar, vuelve a pristine al deshacer, sobrevive al default de reintegro del mount, y se ensucia al prender el reintegro.

## 2. Web

- [x] 2.1 `movement-form.tsx`: nueva prop `onDirtyChange`, reportada por efecto, documentada como el canal hacia el host.
- [x] 2.2 `movement-form.tsx`: CTA deshabilitado cuando `isEdit && !isDirty`.
- [x] 2.3 Nuevo `use-discard-guard.tsx` en `transactions/_components/`: hook de estado con `requestClose`, `setDirty`, `asking`, `discard` y `keepEditing`.
- [x] 2.4 Nuevo `discard-changes-dialog.tsx`: la confirmación como capa absoluta **dentro del panel del drawer**, sin Radix — un segundo modal anidado sobre el `Dialog` abierto no recibe los clicks (design, decisión 4).
- [x] 2.5 Cablearlos en `movement-drawer.tsx` (alta) y en `global-transaction-detail.tsx` (edición): el `onClose` del `Drawer` y el del formulario pasan por `requestClose`, el diálogo se monta dentro del `<Drawer>`; `onSuccess` sigue cerrando directo.
- [x] 2.6 i18n: `transactions.discard_changes.{title,body,discard,keep_editing}` en `es.json` y `en.json`.

## 3. Nativa

- [x] 3.1 `MovementForm.tsx`: CTA deshabilitado cuando `isEdit && !form.isDirty`, con el `accessibilityState` acompañando.
- [x] 3.2 Dejar documentado en el proposal por qué el guard de salida no entra en esta pasada (`usePreventRemove` no es dependencia directa de `apps/mobile`).

## 4. Verificación

> 4.2–4.7 son verificación manual. El hook tiene tests; el cableado de UI no.

- [x] 4.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` (web), `pnpm --filter @grana/movement-form test`, `pnpm typecheck:mobile`, `pnpm lint:mobile`.
- [x] 4.2 **Edición web**: abrir el drawer y no tocar nada → "Guardar cambios" deshabilitado. Cambiar el monto → se habilita. Volver al valor original → se deshabilita.
- [x] 4.3 **Edición web**: cambiar algo y cerrar con la ✕ → pide confirmación. Ídem con `Esc`. **El click en el scrim no se pudo probar en viewport angosto**: ver la nota de abajo.
- [x] 4.3b **Los dos botones responden al click** (el bug que motivó la decisión 4): "Seguir editando" cierra la confirmación y deja el formulario intacto; "Descartar" cierra el drawer. También: click en el fondo oscurecido de la confirmación = seguir editando, y `Esc` con la confirmación abierta la cierra sin cerrar el drawer.
- [x] 4.4 **Edición web**: "seguir editando" deja los cambios intactos; "descartar" cierra y los pierde.

> **El scrim del drawer no es alcanzable en viewport angosto.** El panel es `width: 528px` con `max-w-full` (`components/ui/drawer.tsx`), así que abajo de 528px ocupa todo el ancho y no queda página oscurecida para clickear. Los tres caminos de cierre coexisten **sólo en desktop**; en un teléfono real el único camino es la ✕ (no hay `Esc` ni scrim). No es un defecto de este cambio — es la geometría del drawer — pero conviene saberlo antes de escribir un caso de prueba que a ese ancho no existe.
- [ ] 4.5 **Alta web**: cargar monto y categoría, cerrar por los tres caminos → confirma. Abrir el drawer y cerrarlo sin tocar nada → cierra directo, sin diálogo.
- [ ] 4.6 **Guardado exitoso** (alta y edición): cierra sin preguntar.
- [ ] 4.7 **Nativa**: en edición el CTA arranca deshabilitado y se habilita al primer cambio; el alta no cambió.

## 5. Cierre

- [x] 5.1 Archivar la change antes del merge según el checklist de `AGENTS.md` y aplicar el delta sobre `openspec/specs/transactions/spec.md`.
- [x] 5.2 Correr `pnpm openspec:check` en la branch.
