## Why

Dos defectos en el read path del saldo hacen que los números de plata puedan ser silenciosamente incorrectos. Ninguno tira error: devuelven un saldo plausible pero mal.

1. **Cuentas archivadas contaminan "Balance del mes".** `getMonthBalanceSeries` resuelve sus `ownedAccountIds` con `.in('type', ['cash','bank'])` **sin** `.eq('is_active', true)` (`packages/dashboard/src/queries.ts:110-113`), mientras `getDashboardHero` (mismo archivo, línea 64) y los tres reads de `@grana/accounts` (`packages/accounts/src/queries.ts:109,166,256`) sí lo filtran. Los movimientos de una cuenta archivada cuentan en el neto del mes pero su saldo no está en el Disponible, lo que rompe la reconciliación que la spec `dashboard` declara explícitamente ("El neto del mes (`finalBalance`) SHALL reconciliar exactamente con el cambio del Disponible en ese mes"). El mismo gap cambia el trato de las transferencias: una transferencia entre una cuenta activa y una archivada netea cero en la serie del mes pero sí mueve el Disponible en el Hero.

2. **El saldo se calcula sobre un fetch sin cota.** `getTransactionSums` (`packages/accounts/src/queries.ts:33-53`, y su copia en `packages/dashboard/src/queries.ts:71-98`) trae el ledger entero con un `.select()` sin `.range()`, sin `.limit()` y sin `.order()`. PostgREST aplica un `max-rows` del lado del servidor (1000 por defecto en Supabase) y **trunca en silencio**: sin error, sin señal. Al cruzar ese techo los saldos de cuenta y el Disponible empiezan a perder movimientos, y como no hay `ORDER BY`, *cuáles* se pierden es arbitrario. Hoy no muerde (484 filas on-ledger), pero es una bomba de tiempo: el síntoma sería exactamente el reporte que originó este change — saldos que no cierran contra el ledger.

3. **Las transferencias de una sola pata se descartan.** `classifyCashContribution` devuelve `null` para **todo** `transfer` (`packages/dashboard/src/aggregations.ts:214`), asumiendo que ambas patas son cuentas propias y netean cero. `calculateTransactionSums` no hace esa suposición: debita el origen cuando es propio y acredita el destino cuando lo es, cada pata por separado. Hoy el defecto está latente porque la serie del mes considera propias también a las archivadas (defecto 1), así que las dos patas caen dentro del set. **Arreglar el defecto 1 lo vuelve alcanzable**: una transferencia hacia una cuenta archivada pasaría a mover el Disponible sin mover el neto del mes. Los dos se arreglan juntos o la reconciliación queda rota justo en el caso que este change viene a corregir.

Los tres comparten raíz: el saldo es un agregado que hoy se calcula trayendo todo el ledger al cliente y sumando en JS, con el scoping de cuentas y las reglas de signo duplicados a mano en cada call site.

## What Changes

- `getMonthBalanceSeries` SHALL filtrar `is_active = true` al resolver las cuentas propias, igualando el criterio de `getDashboardHero` y de los reads de `@grana/accounts`. Con eso el neto del mes vuelve a reconciliar con el cambio del Disponible aun cuando el usuario tenga cuentas archivadas con historia.
- El criterio "cuenta propia" (`type IN ('cash','bank') AND is_active`) SHALL dejar de estar duplicado en cada query: se centraliza en un helper único de `@grana/accounts` que todos los reads de saldo consumen, de modo que un cambio futuro no pueda volver a divergir por olvido.
- Los reads que alimentan un saldo SHALL ser **completos por construcción**, no por suerte: ninguno puede depender de que la cantidad de filas quede por debajo del `max-rows` del servidor. Se resuelve moviendo la agregación a Postgres vía RPC `SECURITY INVOKER` (el contrato que la spec `web-data-access` ya establece para reads compuestos calientes), que devuelve el neto por cuenta y moneda en vez de embarcar el ledger entero al cliente.
- `classifyCashContribution` SHALL tratar cada pata del `transfer` por separado, igual que `calculateTransactionSums`: resta cuando el origen es cuenta propia, suma cuando el destino lo es. Con las dos patas propias el resultado sigue siendo cero (comportamiento actual preservado); con una sola pata deja de descartarse.
- `calculateTransactionSums` y `computeRunningBalances` SHALL permanecer intactos y siguen siendo la fuente de verdad de los signos por tipo: la RPC replica esas reglas en SQL y un test de paridad las mantiene sincronizadas.
- Se agrega cobertura de regresión para los tres defectos: una cuenta archivada con movimientos no mueve el neto del mes, una transferencia de una sola pata sí lo mueve, y un ledger por encima del `max-rows` produce el mismo saldo que uno por debajo.

No hay cambio visible de UI ni de copy. Este change corrige aritmética; el renombre de la card "Balance del mes" (que se lee como stock siendo flujo) queda explícitamente fuera de alcance.

## Capabilities

### New Capabilities

Ninguna. Este change corrige el cumplimiento de requirements ya especificados.

### Modified Capabilities

- `dashboard`: el requirement de reconciliación del neto del mes con el Disponible SHALL explicitar que el universo de cuentas propias excluye las archivadas (`is_active = false`), con el mismo criterio que el Hero.
- `web-data-access`: SHALL agregarse el requirement de que todo read que alimente un saldo o un agregado monetario sea completo — prohibido derivarlo de un `.select()` sin cota explícita, sujeto al `max-rows` de PostgREST.

## Impact

**Código**

- `packages/dashboard/src/queries.ts` — `getMonthBalanceSeries` (scoping de cuentas), `getTransactionSums` (copia local, pasa a RPC).
- `packages/dashboard/src/aggregations.ts` — `classifyCashContribution`, rama `transfer` (patas independientes).
- `packages/accounts/src/queries.ts` — `getTransactionSums`, `getAccountIdsWithTransactions` (mismo patrón sin cota), y el nuevo helper de scoping de cuentas propias.
- `packages/transactions/src/queries.ts` — `getAccountMovementsAscending` documenta "No pagination" porque el running balance necesita la historia completa; esa afirmación solo es cierta por debajo del `max-rows` y hay que auditarla en el mismo pase.
- `supabase/migrations/` — nueva migración con la(s) función(es) RPC `SECURITY INVOKER`.

**Consumidores**

Hero/Disponible, card "Dónde está", listado y detalle de cuentas, "Balance del mes", y sus equivalentes en `apps/mobile` (consumen los mismos packages). El contrato de retorno de los reads no cambia, así que los componentes no se tocan.

**Riesgo**

Toca el cálculo de todos los saldos de la app. La mitigación es que las funciones puras (`calculateTransactionSums`, `computeRunningBalances`) no se modifican y el test de paridad SQL↔TS ancla la equivalencia.
