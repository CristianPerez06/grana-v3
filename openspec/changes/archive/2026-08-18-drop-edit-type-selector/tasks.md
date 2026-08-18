## 1. Web — sin selector de tipo en edición

- [x] 1.1 En `apps/web/lib/transactions/components/movement-form.tsx`, hacer que `typeSelector` sea `null` cuando `isEdit`, dejando el branch de alta (strip mobile / `Segmented` escritorio) exactamente como está.
- [x] 1.2 Quitar la opción `disabled: isEdit` del `Segmented`: en el único branch que la evalúa, `isEdit` ya es `false`.
- [x] 1.3 Condicionar el wrapper del selector en el header del drawer (`<div className="mt-4">`) a que `typeSelector` exista, para no dejar un contenedor vacío separando el título del monto.
- [x] 1.4 Confirmar que la fila "TIPO" de `contextRows` queda intacta y pasa a ser la única fuente del dato en edición.

## 2. Nativa — verificar que ya cumple

- [x] 2.1 Confirmar que `apps/mobile/components/transactions/MovementForm.tsx` no necesita cambios: el selector ya está envuelto en `!isEdit` y la fila "TIPO" ya se emite. No editar el archivo.

## 3. Verificación

> 3.2–3.6 son verificación manual en navegador y simulador. `apps/web` y `apps/mobile` no tienen tests de componente ni Storybook para este formulario (sólo el hook `useMovementForm` está cubierto en `packages/movement-form`), así que quedan como checklist para quien corra la app; el diff no las cubre.

- [x] 3.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` (web) y `pnpm typecheck:mobile`, `pnpm lint:mobile`.
- [ ] 3.2 **Web, viewport angosto**: editar un gasto desde el drawer del detalle y desde `/transactions/[txId]/edit`. No hay tabs; el header pasa directo al monto sin hueco; la card de contexto muestra TIPO · MONEDA · CUENTA con caption de "no editable".
- [ ] 3.3 **Web, viewport ancho**: mismas dos superficies. Ya no está el `Segmented` deshabilitado y la fila "TIPO" sigue en su lugar.
- [ ] 3.4 **Web**: editar una transferencia y un cambio de moneda — el contexto muestra el tipo y las dos cuentas; y la madre de una compra en cuotas — la fila dice "Compra en cuotas".
- [ ] 3.5 **Web**: guardar un gasto y una transferencia editados; los cambios persisten.
- [ ] 3.6 **Alta (regresión)**: el selector de tipo funciona igual que antes. **Web ancho verificado** (`Segmented` de cinco). Pendientes: web angosto (tres slots parejos + popover "Otros") y nativa (hoja "Otros") — ver issue #38.

> La verificación manual pendiente en la **app nativa** está consolidada en el issue #38 (`QA App Mobile — formulario de edición de movimiento`), asignado y con checklist propio.

## 4. Cierre

- [x] 4.1 Archivar la change antes del merge según el checklist de `AGENTS.md`: mover a `openspec/changes/archive/YYYY-MM-DD-drop-edit-type-selector/` y aplicar los deltas sobre `openspec/specs/transactions/spec.md` (sin dejar secciones de delta en el master spec).
- [x] 4.2 Correr `pnpm openspec:check` en la branch. Debe pasar antes del merge.
