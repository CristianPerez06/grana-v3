## 1. Baseline reproducible

- [ ] 1.1 Registrar los valores actuales contra el ledger real como baseline del "caso sano": saldo por cuenta y moneda, y neto ARS de junio y julio. Anclas conocidas: Mercado Pago `2.850.000 − 2.534.848,75 = 315.151,25`; neto julio ARS `−2.684.140`. Ningún paso posterior puede moverlos.
- [ ] 1.2 Correr Q5 del diagnóstico (cuentas `cash`/`bank` con `is_active = false` y movimientos) para saber si el fix del `is_active` cambia números ya vistos o es puramente preventivo. Anotar el resultado en el change.
- [ ] 1.3 Confirmar el `max-rows` configurado del proyecto Supabase y anotarlo. No cambia el diseño; sí cuánto margen hay hoy.

## 2. Regresiones primero (deben fallar antes del fix)

- [ ] 2.1 Test: una cuenta `type='bank'` con `is_active = false` y movimientos en el mes NO aporta a ninguna fila de `buildMonthBalanceSeries` ni a `finalBalance`.
- [ ] 2.2 Test: una `transfer` con **una sola** pata propia se contabiliza por esa pata (resta si el origen es propio, suma si el destino lo es); con **ambas** patas propias sigue neteando cero.
- [ ] 2.3 Test: `finalBalance` del mes es igual al cambio del Disponible calculado con `calculateTransactionSums` sobre el mismo set, con una cuenta archivada y una transferencia de una pata en el set.
- [ ] 2.4 Verificar que 2.1–2.3 fallan contra el código actual. Un test que ya pasa no está cubriendo el defecto.

## 3. Fix de scoping y de transferencias (defectos 1 y 3)

- [ ] 3.1 Agregar `.eq('is_active', true)` al fetch de cuentas de `getMonthBalanceSeries` (`packages/dashboard/src/queries.ts:110-113`), igualando `getDashboardHero` (línea 64).
- [ ] 3.2 Reescribir la rama `transfer` de `classifyCashContribution` (`packages/dashboard/src/aggregations.ts:214`) para evaluar cada pata por separado, con la misma forma que `calculateTransactionSums`.
- [ ] 3.3 Ajustar el comentario de la rama `transfer` — hoy afirma "between owned cash/bank accounts both legs net to zero", que es la suposición que causaba el defecto.
- [ ] 3.4 Verificar que 2.1–2.3 pasan y que el baseline de 1.1 no se movió.

## 4. RPC de agregación de saldo (defecto 2)

- [ ] 4.1 Escribir la migración con la función SQL `SECURITY INVOKER` que devuelve neto por cuenta y moneda, replicando las reglas de signo de `calculateTransactionSums` (income, expense, transfer por pata, adjustment signado, exchange cross-moneda por pata, reimbursement solo `target='account'` + `received_at` no nulo + `cancelled_at` nulo, settlement in/out) y excluyendo filas off-ledger (`status IS NOT NULL`).
- [ ] 4.2 Incorporar el criterio de cuenta propia (`type IN ('cash','bank') AND is_active = true`) dentro de la función, como definición normativa única (design D2).
- [ ] 4.3 Agregar el self-check de la migración siguiendo el patrón de las migraciones existentes (`0010`, `0044`): verificar que la función existe y es `SECURITY INVOKER`.
- [ ] 4.4 Test de paridad SQL ↔ TS: mismo set de movimientos cubriendo **todos** los tipos y estados (incluye `reimbursement` en sus cuatro estados, `settlement` in/out, `exchange` cross-moneda, `transfer` de una y de dos patas) → la RPC y `calculateTransactionSums` devuelven idéntico neto por cuenta y moneda.
- [ ] 4.5 Test de RLS: un usuario solo recibe filas que sus policies le permiten; la función no eleva privilegios.

## 5. Migrar los call sites a la RPC

- [ ] 5.1 Migrar `getTransactionSums` de `@grana/accounts` (`packages/accounts/src/queries.ts:33-53`) a la RPC, preservando la firma y el tipo de retorno (`Map<accountId, {ARS, USD}>`).
- [ ] 5.2 Migrar la copia de `getTransactionSums` de `@grana/dashboard` (`packages/dashboard/src/queries.ts:71-98`) y eliminar la duplicación.
- [ ] 5.3 Verificar que `getAccounts`, `getCashAndBankAccounts`, `getAccountDetail` y `getDashboardHero` siguen devolviendo exactamente lo mismo (baseline 1.1).
- [ ] 5.4 Verificar que `apps/mobile` sigue compilando y funcionando: consume los mismos packages y no debería requerir cambios.

## 6. Completitud del read de detalle (defecto 2, caso filas)

- [ ] 6.1 Agregar loop de `.range()` exhaustivo a `getAccountMovementsAscending` (`packages/transactions/src/queries.ts:100-107`) hasta agotar el conjunto.
- [ ] 6.2 Actualizar el comentario "No pagination, no filtering" (`packages/transactions/src/queries.ts:89-94`) — la afirmación pasa a ser cierta en vez de cierta-por-debajo-del-techo.
- [ ] 6.3 Test: con un ledger de una cuenta que supera el `max-rows`, el running balance final coincide con el saldo que devuelve la RPC.
- [ ] 6.4 Auditar el resto de reads sin cota y decidir por cada uno: `getAccountIdsWithTransactions` (`packages/accounts/src/queries.ts:58-88`, no alimenta un saldo — resolver con `EXISTS` o plegar en la RPC) y el fetch de filas de `getMonthBalanceSeries` (acotado por mes, documentar por qué no aplica).

## 7. Cierre

- [ ] 7.1 Correr lint y typecheck del monorepo.
- [ ] 7.2 Re-verificar el baseline de 1.1 contra el ledger real: los saldos y los netos de junio/julio no se movieron (salvo lo que 1.2 haya identificado como cambio esperado por cuentas archivadas).
- [ ] 7.3 Actualizar `openspec/specs/dashboard/spec.md` y `openspec/specs/web-data-access/spec.md` con los deltas al archivar.
