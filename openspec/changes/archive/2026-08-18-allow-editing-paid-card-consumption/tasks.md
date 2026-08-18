## 1. Habilitar la edición

- [x] 1.1 Web: en `global-transaction-detail.tsx`, sacar `transaction.status !== 'paid'` de `canEdit`, dejando `canManage`, cuenta resoluble y "no es cuota hija".
- [x] 1.2 Nativa: el mismo cambio en `app/(app)/transactions/[txId]/index.tsx`.
- [x] 1.3 Confirmar que `canDelete` conserva `status !== 'paid'` en las dos plataformas.
- [x] 1.4 Comentar en ambos archivos por qué editar sí y borrar no, para que nadie lo "arregle" de vuelta.

## 2. Spec congruente

- [x] 2.1 En el requirement del detalle nativo, sacar `status !== 'paid'` de la definición de `canEdit` y remitir al requirement de campos mutables.
- [x] 2.2 En "El usuario puede editar una transacción", explicitar que un consumo pagado NO se congela (el detalle ofrece Editar; monto y fecha van como contexto read-only) y que el borrado sí queda bloqueado, con su razón.
- [x] 2.3 Agregar el escenario "Un consumo pagado se puede recategorizar", que fija las dos mitades juntas.

## 3. Verificación

> 3.2–3.5 son manuales: no hay tests de componente para el detalle.

- [x] 3.1 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @grana/movement-form test`, `pnpm typecheck:mobile`, `pnpm lint:mobile`.
- [ ] 3.2 **Consumo pagado, web**: el detalle muestra el lápiz y NO la papelera.
- [ ] 3.3 Abrir a editar: sin héroe; la línea de contexto arranca con el monto en negrita y termina con la fecha; categoría y descripción editables.
- [ ] 3.4 Cambiar la categoría y guardar: persiste, y el saldo/resumen no se mueve.
- [ ] 3.5 **Nativa**: repetir 3.2 y 3.3.
- [ ] 3.6 **Regresión**: un consumo `pending` y un gasto cash/bank siguen con lápiz + papelera; una cuota hija sigue sin ninguna de las dos.

## 4. Cierre

- [x] 4.1 Archivar la change y aplicar el delta sobre `openspec/specs/transactions/spec.md`.
- [x] 4.2 Correr `pnpm openspec:check`.
