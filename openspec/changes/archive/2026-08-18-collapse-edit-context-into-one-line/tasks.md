## 1. Web

- [x] 1.1 Reemplazar `contextRows` (array label/valor) por `contextParts` (array de strings) + `lockedAmount`, uniendo origen y destino de transferencia/cambio en un segmento con flecha.
- [x] 1.2 Renderizar `contextLine` como un `<p>` atenuado con los segmentos separados por `·`, el monto bloqueado en negrita al frente y un único caption `common.not_editable` al final.
- [x] 1.3 Montar la línea en `body`, inmediatamente después del héroe, y eliminar el `map` de filas del `fieldGroup`.
- [x] 1.4 Devolver `null` en `fieldGroup` cuando en edición no queda ninguna fila editable, para no dibujar una card vacía.

## 2. Nativa

- [x] 2.1 Mismo reemplazo de `contextRows` por `contextParts` + `lockedAmount`.
- [x] 2.2 Renderizar la línea con los mismos dos niveles de peso y moverla de arriba del héroe a **abajo**, igualando el orden de web.
- [x] 2.3 Verificar que `GroupCard` ya devuelve `null` sin hijos (no hace falta el guard que web sí necesita).

## 3. Verificación

> 3.2–3.6 son verificación manual. No hay tests de componente para este formulario.

- [x] 3.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` (web), `pnpm --filter @grana/movement-form test`, `pnpm typecheck:mobile`, `pnpm lint:mobile`.
- [ ] 3.2 **Gasto simple en edición** (web angosto, web ancho, nativa): una línea `Gasto · ARS · <cuenta> — no editable` bajo el monto; los campos editables arrancan justo debajo.
- [ ] 3.3 **Transferencia / cambio**: las dos cuentas se leen como `Origen → Destino` en un solo segmento.
- [ ] 3.4 **Consumo de tarjeta pagado**: el monto encabeza la línea en negrita, seguido del resto atenuado y de la fecha; no hay héroe.
- [ ] 3.5 **Madre de compra en cuotas con cuota paga**: la línea incluye "Compra en cuotas" y la cantidad de cuotas; se acepta que envuelva, no debe truncar.
- [ ] 3.6 **Alta**: sin cambios en ninguna superficie — la línea es exclusiva de edición.

## 4. Cierre

- [x] 4.1 Archivar la change antes del merge y aplicar el delta sobre `openspec/specs/transactions/spec.md`.
- [x] 4.2 Correr `pnpm openspec:check`.
