## 1. Baseline reproducible

> El proyecto Supabase es online-only y el repo solo tiene la anon key, así que
> estas queries las corrió el usuario en el SQL Editor. Las queries y sus salidas
> crudas NO quedaron versionadas: agregaban datos financieros de todos los
> usuarios del proyecto (el SQL Editor ignora RLS). Las conclusiones que importan
> están anotadas en cada tarea.

- [x] 1.1 Registrar los valores actuales contra el ledger real como baseline del "caso sano": saldo por cuenta y moneda, y neto ARS de junio y julio. Anclas conocidas: Mercado Pago `2.850.000 − 2.534.848,75 = 315.151,25`; neto julio ARS `−2.684.140`. Ningún paso posterior puede moverlos. → **ambas anclas cierran** (con la query scopeada por `user_id`; una primera corrida sin ese filtro agregaba todos los usuarios del proyecto y por eso el ancla de julio no cerraba): MP ARS `315.151,25` exacto y julio ARS `−2.684.140,02` (el `−2.684.140` del change venía redondeado a pesos). Disponible ARS `425.151,40`, USD `0`; junio ARS `259.291,42`.**
- [x] 1.2 Correr Q5 del diagnóstico (cuentas `cash`/`bank` con `is_active = false` y movimientos) para saber si el fix del `is_active` cambia números ya vistos o es puramente preventivo. Anotar el resultado en el change. → **cero filas en TODO el proyecto: no existe ninguna cuenta cash/bank archivada. El fix del `is_active` es puramente PREVENTIVO — ningún número ya visto se mueve.** Al no haber filtro de usuario el resultado es más fuerte que lo pedido y no necesita re-correrse.
- [x] 1.3 Confirmar el `max-rows` configurado del proyecto Supabase y anotarlo. No cambia el diseño; sí cuánto margen hay hoy. → **`max-rows = 1000` (el default), 511 filas on-ledger en todo el proyecto** (bajo RLS cada usuario ve menos). El techo está a menos de 2× del volumen actual y crece con cada movimiento: el defecto 2 no mordía, pero no faltaba tanto.
- [x] 1.2b *(agregada)* Verificar si existen transferencias con **una sola** pata propia. 1.2 descarta el camino de las cuentas archivadas, pero el defecto 3 también se destapa con una transferencia hacia una cuenta que no sea `cash`/`bank` activa. Es lo que decide si el fix de `classifyCashContribution` mueve algún número ya visto. → **cero filas: todas las transferencias del ledger van de cuenta propia a cuenta propia, así que netean cero con la implementación vieja y con la nueva. El fix del defecto 3 también es puramente PREVENTIVO.**

## 2. Regresiones primero (deben fallar antes del fix)

- [x] 2.1 Test: una cuenta `type='bank'` con `is_active = false` y movimientos en el mes NO aporta a ninguna fila de `buildMonthBalanceSeries` ni a `finalBalance`.
- [x] 2.2 Test: una `transfer` con **una sola** pata propia se contabiliza por esa pata (resta si el origen es propio, suma si el destino lo es); con **ambas** patas propias sigue neteando cero.
- [x] 2.3 Test: `finalBalance` del mes es igual al cambio del Disponible calculado con `calculateTransactionSums` sobre el mismo set, con una cuenta archivada y una transferencia de una pata en el set.
- [x] 2.4 Verificar que 2.1–2.3 fallan contra el código actual. Un test que ya pasa no está cubriendo el defecto. → los 7 tests de `packages/dashboard/__tests__/balance-read-path.test.ts` fallaban contra el código previo.

## 3. Fix de scoping y de transferencias (defectos 1 y 3)

- [x] 3.1 Agregar `.eq('is_active', true)` al fetch de cuentas de `getMonthBalanceSeries` (`packages/dashboard/src/queries.ts:110-113`), igualando `getDashboardHero` (línea 64). → aplicado; en 5.5 el predicado a mano se reemplaza por la definición normativa en SQL.
- [x] 3.2 Reescribir la rama `transfer` de `classifyCashContribution` (`packages/dashboard/src/aggregations.ts:214`) para evaluar cada pata por separado, con la misma forma que `calculateTransactionSums`.
- [x] 3.3 Ajustar el comentario de la rama `transfer` — hoy afirma "between owned cash/bank accounts both legs net to zero", que es la suposición que causaba el defecto.
- [x] 3.4 Verificar que 2.1–2.3 pasan y que el baseline de 1.1 no se movió. → tests en verde (40/40 en `@grana/dashboard`, incluidos los 30 de regresión del caso sano). La verificación contra el ledger real se consolida en 7.2.

## 4. RPC de agregación de saldo (defecto 2)

- [x] 4.1 Escribir la migración con la función SQL `SECURITY INVOKER` que devuelve neto por cuenta y moneda, replicando las reglas de signo de `calculateTransactionSums` (income, expense, transfer por pata, adjustment signado, exchange cross-moneda por pata, reimbursement solo `target='account'` + `received_at` no nulo + `cancelled_at` nulo, settlement in/out) y excluyendo filas off-ledger (`status IS NOT NULL`). → `supabase/migrations/0051_account_balance_sums.sql`
- [x] 4.2 Incorporar el criterio de cuenta propia (`type IN ('cash','bank') AND is_active = true`) dentro de la función, como definición normativa única (design D2). → `get_owned_account_ids()`, del que `get_account_balance_sums` deriva su scope cuando `p_account_ids` es NULL.
- [x] 4.3 Agregar el self-check de la migración siguiendo el patrón de las migraciones existentes (`0010`, `0044`): verificar que la función existe y es `SECURITY INVOKER`.
- [x] 4.4 Test de paridad SQL ↔ TS: mismo set de movimientos cubriendo **todos** los tipos y estados (incluye `reimbursement` en sus cuatro estados, `settlement` in/out, `exchange` cross-moneda, `transfer` de una y de dos patas) → la RPC y `calculateTransactionSums` devuelven idéntico neto por cuenta y moneda. → `apps/web/lib/accounts/__tests__/balance-sums-migration.test.ts`, corriendo el SQL de la migración sobre Postgres real (PGlite).
- [x] 4.5 Test de RLS: un usuario solo recibe filas que sus policies le permiten; la función no eleva privilegios. → mismo archivo, describe "RLS is enforced inside the function" (rol no-owner + policies por usuario).

## 5. Migrar los call sites a la RPC

- [x] 5.1 Migrar `getTransactionSums` de `@grana/accounts` (`packages/accounts/src/queries.ts:33-53`) a la RPC, preservando la firma y el tipo de retorno (`Map<accountId, {ARS, USD}>`).
- [x] 5.2 Migrar la copia de `getTransactionSums` de `@grana/dashboard` (`packages/dashboard/src/queries.ts:71-98`) y eliminar la duplicación. → lo duplicado (la lista de campos, el filtro `.or`, la agregación) desapareció dentro de la RPC; el shaping de filas → `Map` se comparte en `balanceSumsFromRows` (`@grana/money-logic`). Queda una llamada `.rpc()` por paquete porque el grafo (`@grana/accounts → … → @grana/dashboard`) prohíbe que dashboard importe accounts.
- [x] 5.3 Verificar que `getAccounts`, `getCashAndBankAccounts`, `getAccountDetail` y `getDashboardHero` siguen devolviendo exactamente lo mismo (baseline 1.1). → contrato de retorno idéntico (typecheck + revisión de cada call site); la verificación numérica contra el ledger es 7.2.
- [x] 5.4 Verificar que `apps/mobile` sigue compilando y funcionando: consume los mismos packages y no debería requerir cambios. → `pnpm typecheck:mobile` y `pnpm lint:mobile` en verde, sin cambios en `apps/mobile`.
- [x] 5.5 *(agregada)* `getMonthBalanceSeries` y `getDashboardHero` resuelven las cuentas propias con `get_owned_account_ids()` en vez de rehacer el predicado a mano. Lo exige el requirement "El universo de cuenta propia tiene una única definición normativa" de la spec `web-data-access`; sin esto quedaban dos copias del criterio y 3.1 era un parche. Mismo número de round-trips que antes.

## 6. Completitud del read de detalle (defecto 2, caso filas)

- [x] 6.1 Agregar loop de `.range()` exhaustivo a `getAccountMovementsAscending` (`packages/transactions/src/queries.ts:100-107`) hasta agotar el conjunto.
- [x] 6.2 Actualizar el comentario "No pagination, no filtering" (`packages/transactions/src/queries.ts:89-94`) — la afirmación pasa a ser cierta en vez de cierta-por-debajo-del-techo.
- [x] 6.3 Test: con un ledger de una cuenta que supera el `max-rows`, el running balance final coincide con el saldo que devuelve la RPC. → `apps/web/lib/accounts/__tests__/account-movements-pagination.test.ts` (2500 filas contra un cap simulado de 1000; incluye el caso de control que muestra que el read viejo daba mal).
- [x] 6.4 Auditar el resto de reads sin cota y decidir por cada uno: `getAccountIdsWithTransactions` (`packages/accounts/src/queries.ts:58-88`, no alimenta un saldo — resolver con `EXISTS` o plegar en la RPC) y el fetch de filas de `getMonthBalanceSeries` (acotado por mes, documentar por qué no aplica). → `getAccountIdsWithTransactions` pasó a un EXISTS por cuenta (`.limit(1)`) — no alimenta un saldo, pero su truncado tenía peor consecuencia: la UI ofrecía *eliminar* una cuenta con historia en vez de *archivar*. El fetch del mes **se paginó** en vez de documentar la excepción (un mes chico es una observación sobre los datos, no una garantía del código, y su producto es un número de plata). Los residuales de otras lentes (`getMonthCategoryBreakdown`, `getCommittedOutlook`, `attachLinkedExpenses`) quedaron anotados como `KNOWN GAP` en un comentario sobre cada función, no en un doc aparte.

## 7. Cierre

- [x] 7.1 Correr lint y typecheck del monorepo. → `pnpm lint`, `pnpm typecheck`, `pnpm lint:mobile`, `pnpm typecheck:mobile` en verde. Tests: 496 en `web`, 40 en `@grana/dashboard`, 73 en `@grana/cards`, 31 en `@grana/transactions-mutations`, 9 en `@grana/movement-form`.
- [x] 7.2 Re-verificar el baseline de 1.1 contra el ledger real: los saldos y los netos de junio/julio no se movieron (salvo lo que 1.2 haya identificado como cambio esperado por cuentas archivadas). → **migración `0051` aplicada con self-check en verde; Q7.2a (paridad de la RPC contra el ledger real completo) cero discrepancias; Q7.2b validado en la app: cambio cero.** Coherente con 1.2 + 1.2b: los tres defectos eran alcanzables pero no activos.
- [x] 7.3 Actualizar `openspec/specs/dashboard/spec.md` y `openspec/specs/web-data-access/spec.md` con los deltas al archivar.
