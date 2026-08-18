## 1. Hook compartido

- [x] 1.1 En `use-movement-form.ts`, derivar `isDirty` comparando un snapshot serializado de los campos editables contra el del primer render (`useRef`).
- [x] 1.2 Condicionar el bloque de reintegro dentro del snapshot a `reimbursementEnabled`, para que el efecto de montaje que elige la cuenta por defecto no ensucie el formulario.
- [x] 1.3 Exponer `isDirty` en el retorno del hook y declararlo en `MovementFormResult` (`types.ts`), documentado.
- [x] 1.4 Tests: pristine al abrir (alta y edición), se ensucia al cambiar, vuelve a pristine al deshacer, sobrevive al default de reintegro del mount, y se ensucia al prender el reintegro.

## 2. Web

- [x] 2.1 `movement-form.tsx`: nueva prop `onDirtyChange`, reportada por efecto, documentada como el canal hacia el host.
- [x] 2.2 `movement-form.tsx`: CTA deshabilitado cuando `isEdit && !isDirty`.
- [x] 2.3 Nuevo `use-discard-guard.tsx` en `transactions/_components/`: devuelve `requestClose`, `setDirty` (identidad estable) y el `AlertDialog` de confirmación.
- [x] 2.4 Cablearlo en `movement-drawer.tsx` (alta) y en `global-transaction-detail.tsx` (edición): el `onClose` del `Drawer` y el del formulario pasan por `requestClose`; `onSuccess` sigue cerrando directo.
- [x] 2.5 i18n: `transactions.discard_changes.{title,body,discard,keep_editing}` en `es.json` y `en.json`.

## 3. Nativa

- [x] 3.1 `MovementForm.tsx`: CTA deshabilitado cuando `isEdit && !form.isDirty`, con el `accessibilityState` acompañando.
- [x] 3.2 Dejar documentado en el proposal por qué el guard de salida no entra en esta pasada (`usePreventRemove` no es dependencia directa de `apps/mobile`).

## 4. Verificación

> 4.2–4.7 son verificación manual. El hook tiene tests; el cableado de UI no.

- [x] 4.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` (web), `pnpm --filter @grana/movement-form test`, `pnpm typecheck:mobile`, `pnpm lint:mobile`.
- [ ] 4.2 **Edición web**: abrir el drawer y no tocar nada → "Guardar cambios" deshabilitado. Cambiar el monto → se habilita. Volver al valor original → se deshabilita.
- [ ] 4.3 **Edición web**: cambiar algo y cerrar con la ✕ → pide confirmación. Repetir con `Esc` y con un click en el scrim → mismo diálogo.
- [ ] 4.4 **Edición web**: "seguir editando" deja los cambios intactos; "descartar" cierra y los pierde.
- [ ] 4.5 **Alta web**: cargar monto y categoría, cerrar por los tres caminos → confirma. Abrir el drawer y cerrarlo sin tocar nada → cierra directo, sin diálogo.
- [ ] 4.6 **Guardado exitoso** (alta y edición): cierra sin preguntar.
- [ ] 4.7 **Nativa**: en edición el CTA arranca deshabilitado y se habilita al primer cambio; el alta no cambió.

## 5. Cierre

- [x] 5.1 Archivar la change antes del merge según el checklist de `AGENTS.md` y aplicar el delta sobre `openspec/specs/transactions/spec.md`.
- [x] 5.2 Correr `pnpm openspec:check` en la branch.
