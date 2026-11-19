## 1. Lógica compartida

- [x] 1.1 Agregar `legInCurrency(view, currency)` en `@grana/money-logic` y verificar con tests (cambio en la misma cuenta en las dos monedas, gasto en ARS sin parte en USD, cambio desde otra cuenta solo en la moneda de destino)

## 2. Web

- [x] 2.1 `MovementRow`/`MovementList`: reemplazar los saldos dobles por `currencyLens` (una parte y un saldo por fila); verificar con `pnpm typecheck` y `pnpm lint`
- [x] 2.2 Contenedor del detalle de cuenta: selector ARS | USD (solo con las dos monedas), la moneda filtra por la parte en esta cuenta, la moneda no oculta el saldo ni cuenta para el estado vacío de "filtros"; verificar con `pnpm test:web`

## 3. App nativa

- [x] 3.1 `MovementsSection`, `MovementRow` y `applyAccountFilters`: mismo selector, misma regla de pertenencia y de saldo; actualizar `running-balance-wiring.test.ts`. Verificar con `pnpm typecheck:mobile`, `pnpm lint:mobile` y `pnpm test`

## 4. Ajustes tras la primera prueba

- [x] 4.1 Selector al lado del título «Movimientos» (web: encabezado de la tarjeta, se acomoda debajo del título en pantallas angostas; app: fila del título, el mes pasa a su propia fila). Verificado a 1280, 390 y 360px
- [x] 4.2 La moneda deja de ser un filtro cuando hay selector: sin chip, sin contar en el botón, sin bloque en la hoja, «Limpiar todo» no la cambia (web y app)
- [x] 4.4 Celular en dos filas: «+» sin texto y mes corto en la web; en la app, mes corto e íconos en la misma fila que el mes. Verificado a 372 y 390px (web)
- [x] 4.5 Encabezado más bajo en el celular (web): menos margen y el «+» a 36px como los íconos, con área de toque de 44px. Verificado a 372px
- [x] 4.6 Pestaña Movimientos de la app: «Buscar / Filtros» pasan a los mismos botones de ícono que la web (`ToolbarIconButton`, compartido con el detalle de cuenta)
- [x] 4.3 Quitar la etiqueta «USD» debajo de los montos en dólares en las filas de movimiento (web y feed nativo)

## 5. Lista corrida

- [x] 5.1 Web: sin navegador de mes en el detalle de cuenta, «Desde / Hasta» en la hoja (chip y conteo), título + íconos + «+» en una fila (`leading` / `trailing` de `MovementFilters`). Verificado a 372 y 1280px
- [x] 5.2 App: lista corrida con «Cargar más», «Desde / Hasta» en la hoja compartida (`showDateRange`), íconos en la fila del título y ARS | USD debajo
- [x] 5.3 App: el detalle de cuenta usa `MovementList` / `MovementRow` de la pestaña Movimientos (con saldo y lente); se borran la fila propia y `movement-view.ts`
- [x] 5.5 Sin acceso a recurrencias en el detalle de cuenta (web y app); título, ARS | USD, búsqueda, filtros y «+» en una fila. Verificado (web) a 358px de tarjeta: una fila; a 343 y 328px el selector baja prolijo
- [x] 5.6 «+» flotante en el celular (web y app) con la cuenta preseleccionada; en desktop, «+ Agregar» en la fila. Una sola fila verificada a 360px (web)
- [x] 5.4 Mes «Noviembre 2026» y días «Viernes, 13 de noviembre» en web y app

## 6. Cierre

- [ ] 6.1 El usuario lo prueba en la web y en la app nativa y decide si se queda
- [ ] 6.2 `pnpm verify` en verde (salvo el paso de archivo, que corre al archivar)
