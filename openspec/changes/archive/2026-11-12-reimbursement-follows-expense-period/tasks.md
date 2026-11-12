## 1. Arreglo

- [x] 1.1 En `updateTransaction`, cuando el cambio de fecha reasigna el consumo a otro resumen, mover al resumen nuevo los reintegros `statement` vinculados que estaban en el resumen y la fecha anteriores del gasto. Corre antes del arrastre de fecha, que reescribe la fecha por la que filtra.
- [x] 1.2 Tests en `packages/transactions-mutations/__tests__/thin-mutations.test.ts`: el caso de producción (12/11 → 30/09 cambia de resumen y arrastra al reintegro) y un cambio de fecha dentro del mismo resumen que no toca el resumen del reintegro. El primero falla sin el arreglo.

## 2. Datos existentes

- [ ] 2.1 Corregir a mano el reintegro afectado en producción con la consulta del SQL Editor (lo hace una persona).

## 3. Verificación

- [x] 3.1 `pnpm test`, `pnpm typecheck` y `pnpm openspec:check`.
