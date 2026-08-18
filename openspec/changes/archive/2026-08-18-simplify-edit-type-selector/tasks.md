## 1. Web — selector simplificado en edición mobile

- [x] 1.1 En `apps/web/lib/transactions/components/movement-form.tsx`, cambiar el gate del selector de `isMobile && !isEdit` a `isMobile`, de modo que la edición en viewport angosto deje de caer al `Segmented` de cinco tipos.
- [x] 1.2 En el branch mobile, renderizar los slots primarios como `span` no accionables cuando `isEdit` (sin `onClick`, fuera del orden de tabulación), y como `button` en alta. Extraer las clases del slot a un helper para que alta y edición no puedan divergir visualmente.
- [x] 1.3 Condicionar el slot "Otros" a `secondaryTabs.length > 0 || (isEdit && isSecondaryTab)` y renderizarlo en edición como `span` con la etiqueta del tipo activo, sin chevron y sin montar el `Popover`.
- [x] 1.4 Poner `role="group"` + `aria-label` del tipo en el contenedor y `aria-current` en la opción activa.
- [x] 1.5 Podar la fila "TIPO" de `contextRows` cuando `isMobile`, salvo `edit.isParent`.

## 2. Nativa — mismo selector, read-only

- [x] 2.1 En `apps/mobile/components/transactions/MovementForm.tsx`, sacar el bloque del selector de su envoltorio `!isEdit` para que también se dibuje en edición.
- [x] 2.2 Renderizar cada slot como `View` en edición y como `Pressable` en alta, compartiendo las mismas clases; bajar `accessibilityRole` a `none` en el contenedor cuando `isEdit`.
- [x] 2.3 Derivar `showOtrosSlot` / `otrosLabel` con la misma regla que web y dejar el `SelectSheet` de "Otros" montado sólo en alta.
- [x] 2.4 Podar la fila "TIPO" de `contextRows`, dejando sólo el caso `edit.isParent` ("Compra en cuotas").

## 3. Verificación

> 3.2–3.6 son verificación manual en navegador y simulador. `apps/web` y `apps/mobile` no tienen tests de componente ni Storybook para este formulario (sólo el hook `useMovementForm` está cubierto en `packages/movement-form`), así que quedan como checklist para quien corra la app; el diff no las cubre.

- [x] 3.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` (web) y `pnpm typecheck:mobile`, `pnpm lint:mobile`.
- [ ] 3.2 **Web, viewport angosto**: abrir el drawer de edición de un gasto y de un ingreso. El selector muestra Gasto / Ingreso / Otros con el tipo activo, nada responde al tap, no hay tira cortada y el tipo aparece una sola vez.
- [ ] 3.3 **Web, viewport angosto**: editar una transferencia y un ajuste. El slot "Otros" muestra el nombre del tipo y no despliega lista.
- [ ] 3.4 **Web, viewport ancho**: confirmar que el drawer y `/transactions/[txId]/edit` siguen con el `Segmented` deshabilitado y la fila "TIPO" intactos.
- [ ] 3.5 **Web**: editar la madre de una compra en cuotas y confirmar que la fila "Compra en cuotas" sigue estando en mobile.
- [ ] 3.6 **Nativa**: repetir 3.2, 3.3 y 3.5 en `/transactions/[txId]/edit`, y confirmar que el alta no cambió en nada.

## 4. Cierre

- [x] 4.1 Archivar la change antes del merge según el checklist de `AGENTS.md`: mover a `openspec/changes/archive/YYYY-MM-DD-simplify-edit-type-selector/` y aplicar los deltas sobre `openspec/specs/transactions/spec.md` (sin dejar secciones de delta en el master spec).
- [x] 4.2 Correr `pnpm openspec:check` en la branch. Debe pasar antes del merge.
