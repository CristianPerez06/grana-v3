## 1. Web

- [x] 1.1 Acotar `contextRows` a cuenta (o las dos puntas de transferencia/cambio), cantidad de cuotas y fecha bloqueada. Eliminar las filas de tipo y moneda, y `TYPE_LABELS` con ellas.
- [x] 1.2 Sacar las filas del `fieldGroup` a su propia card, montada en `body` entre el héroe y los campos editables.
- [x] 1.3 Dibujar el héroe **read-only** cuando `getEditableFields` bloquea el monto: misma card, mismo cuerpo, sin input ni calculadora, moneda como chip estático y caption de "no editable".
- [x] 1.4 No dibujar ninguna de las dos cards vacía: la de contexto sólo con filas, la de campos sólo con campos editables.

## 2. Nativa

- [x] 2.1 Mismo recorte de `contextRows` y mismo héroe read-only.
- [x] 2.2 Mover la card de contexto de **arriba** del héroe a **abajo**, igualando el orden de web.
- [x] 2.3 Verificar que `GroupCard` ya devuelve `null` sin hijos (no hace falta el guard que web sí necesita).

## 3. Verificación

> 3.2–3.6 son manuales. No hay tests de componente para este formulario en ninguna de las dos apps.

- [x] 3.1 `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @grana/movement-form test`, `pnpm typecheck:mobile`, `pnpm lint:mobile`.
- [ ] 3.2 **Gasto cash/bank en edición** (web angosto, web ancho, nativa): héroe editable, y debajo una card con una sola fila — CUENTA. Sin filas de tipo ni moneda.
- [ ] 3.3 **Transferencia / cambio**: dos filas, cuenta origen y cuenta destino.
- [x] 3.4 **Consumo de tarjeta pagado**: héroe read-only con el monto grande y su caption; debajo, CUENTA y FECHA.
- [ ] 3.5 **Madre de compra en cuotas con cuota paga**: héroe read-only; debajo CUENTA, CUOTAS y FECHA.
- [ ] 3.6 **Alta**: sin cambios en ninguna superficie — el contexto inmutable es exclusivo de edición.

## 4. Cierre

- [x] 4.1 Archivar la change y aplicar el delta sobre `openspec/specs/transactions/spec.md`.
- [x] 4.2 Correr `pnpm openspec:check`.
