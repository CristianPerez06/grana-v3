## 1. Lógica compartida

- [x] 1.1 Agregar `legInCurrency(view, currency)` en `@grana/money-logic` y verificar con tests (cambio en la misma cuenta en las dos monedas, gasto en ARS sin parte en USD, cambio desde otra cuenta solo en la moneda de destino)

## 2. Web

- [x] 2.1 `MovementRow`/`MovementList`: reemplazar los saldos dobles por `currencyLens` (una parte y un saldo por fila); verificar con `pnpm typecheck` y `pnpm lint`
- [x] 2.2 Contenedor del detalle de cuenta: selector ARS | USD (solo con las dos monedas), la moneda filtra por la parte en esta cuenta, la moneda no oculta el saldo ni cuenta para el estado vacío de "filtros"; verificar con `pnpm test:web`

## 3. App nativa

- [x] 3.1 `MovementsSection`, `MovementRow` y `applyAccountFilters`: mismo selector, misma regla de pertenencia y de saldo; actualizar `running-balance-wiring.test.ts`. Verificar con `pnpm typecheck:mobile`, `pnpm lint:mobile` y `pnpm test`

## 4. Cierre

- [ ] 4.1 El usuario lo prueba en la web y en la app nativa y decide si se queda
- [ ] 4.2 `pnpm verify` en verde (salvo el paso de archivo, que corre al archivar)
