## 1. Lógica compartida (`@grana/money-logic`)

- [x] 1.1 Agregar `runningBalanceCurrencies(rows, accountId, initial, configured)` junto a `computeRunningBalances` y exportarla; verificar con tests en `packages/money-logic/__tests__/` (solo ARS, solo USD, ambas por movimientos, USD solo por saldo inicial, USD solo por la pata de destino de un cambio, cuenta vacía cae a las monedas configuradas, orden siempre ARS→USD)
- [x] 1.2 Agregar `receivedLeg` opcional a `MovementView` y poblarlo en `resolveMovementView` solo para cambio de moneda con la cuenta como origen y destino; verificar con tests (mismo-cuenta lo trae, cambio entre dos cuentas no, transferencia no, perspectiva global no)

## 2. Web

- [x] 2.1 `MovementRow`: recibir la lista de monedas a mostrar y renderizar un saldo por moneda (ARS arriba, USD debajo más chico) en la columna `md:` y, debajo de `md`, debajo del monto; renderizar `receivedLeg` debajo del monto con signo `+`. Verificar con `pnpm typecheck` y `pnpm lint`
- [x] 2.2 `MovementList` y `movement-list-account-container.tsx`: calcular las monedas con `runningBalanceCurrencies` sobre el historial ascendente y pasarlas a las filas; ocultar el saldo también con búsqueda activa. Verificar con `pnpm test:web`
- [x] 2.3 Verificar en el navegador el detalle de una cuenta bimoneda con un cambio de moneda en la misma cuenta, a 1280px y a 390px: dos saldos por fila, las dos patas en el cambio, el saldo oculto al filtrar o buscar; y una cuenta de una sola moneda igual que antes

## 3. App nativa

- [x] 3.1 Pasar el saldo inicial por moneda de la cuenta de `accounts/[id]/index.tsx` a `MovementsSection`, calcular ahí snapshots (`computeRunningBalances`) y monedas (`runningBalanceCurrencies`), y ocultarlos con filtros o búsqueda activos. Verificar con `pnpm typecheck:mobile`
- [x] 3.2 `components/accounts/MovementRow`: mostrar debajo del monto la pata recibida del cambio y el bloque de saldos con la misma tipografía y orden que la web angosta; actualizar el comentario que dice que no hay saldo por fila. Verificar con `pnpm typecheck:mobile` y `pnpm lint:mobile`
- [x] 3.3 Test en `apps/mobile/lib/` que fije que la pantalla calcula el saldo con las funciones compartidas y lo oculta con filtros (lectura de fuente, como `invalidation-wiring.test.ts`); verificar con `pnpm test`

## 4. Cierre

- [x] 4.1 Correr `pnpm verify` (o, si el build no puede correr acá, todos sus pasos menos `build`) y dejarlo en verde
