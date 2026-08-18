## 1. Web

- [x] 1.1 En `movement-form.tsx`, agregar a `contextRows` la fila de monto cuando `editable.amount` es falso, con un helper local que arme `signo + símbolo + formatForDisplay(amount)` derivando el signo del tipo (y de `adjustmentDirection` para un ajuste).
- [x] 1.2 Agregar la fila de fecha al final de `contextRows` cuando `editable.date` es falso, usando `formatDateValue`.
- [x] 1.3 Mover la declaración de `formatDateValue` arriba de `contextRows`: quedaba en TDZ (`contextRows` se evalúa antes).

## 2. Nativa

- [x] 2.1 Mismo agregado en `MovementForm.tsx`, con la misma regla de signo y `formatForDisplay`.
- [x] 2.2 Para la fecha, reusar `formatShortDate` de `components/transactions/detail/format.ts` con `useLocale()`. No duplicar el formateo.

## 3. Verificación

> 3.2–3.5 son verificación manual. No hay tests de componente para este formulario en ninguna de las dos apps; el diff no cubre lo visual.

- [x] 3.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` (web) y `pnpm typecheck:mobile`, `pnpm lint:mobile`.
- [ ] 3.2 **Consumo de tarjeta pagado**: abrir en edición en web (angosto y ancho) y en la nativa. Se ven MONTO y FECHA como filas read-only con caption "no editable"; categoría y descripción siguen editables.
- [ ] 3.3 **Madre de compra en cuotas con una cuota paga**: mismo control, más la fila "Compra en cuotas" y la de cantidad de cuotas.
- [ ] 3.4 **Sin regresión en los casos normales**: un gasto cash/bank editable sigue mostrando el héroe del monto y la fila de fecha editable, y NO duplica ninguna de las dos en el bloque de contexto.
- [ ] 3.5 **Formato**: el monto se lee con signo y símbolo (`−$200.000`, `+U$D 350`), con centavos cuando los tiene, igual que en el detalle.

## 4. Cierre

- [x] 4.1 Archivar la change antes del merge según el checklist de `AGENTS.md` y aplicar el delta sobre `openspec/specs/transactions/spec.md`.
- [x] 4.2 Correr `pnpm openspec:check` en la branch.
