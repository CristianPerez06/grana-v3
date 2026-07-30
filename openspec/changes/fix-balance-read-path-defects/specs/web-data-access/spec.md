## ADDED Requirements

### Requirement: Los reads que alimentan un saldo o un agregado monetario son completos por construcción

Un read cuyo resultado alimenta un saldo, un neto o cualquier agregado monetario SHALL ser **completo por construcción**: su corrección NO SHALL depender de que la cantidad de filas quede por debajo de un techo implícito del servidor.

PostgREST aplica un `max-rows` configurado del lado del servidor (1000 por defecto en Supabase). Un `.select()` sin cota explícita que supere ese techo se **trunca en silencio**: devuelve `error === null` y menos filas de las que matchean, sin señal alguna para el caller. Un agregado calculado sobre ese resultado es un número plausible pero incorrecto, y el modo de falla es especialmente hostil porque aparece de golpe al cruzar un umbral invisible y sin `ORDER BY` es no determinístico qué filas se pierden.

Por lo tanto, el sistema NO SHALL derivar un saldo de un `.select()` que traiga filas de detalle sin una cota explícita. Un read de este tipo SHALL adoptar una de estas dos formas:

1. **Agregación en Postgres (preferido).** El neto se calcula en SQL vía función RPC `SECURITY INVOKER` y viaja ya agregado (p. ej. neto por cuenta y moneda). El volumen de la respuesta pasa a ser función de la cantidad de cuentas, no de la cantidad de movimientos, y el techo deja de ser alcanzable. Es el mismo contrato que el requirement "Los reads compuestos calientes se implementan como funciones RPC de Postgres".
2. **Paginación explícita y exhaustiva.** Si la agregación debe ocurrir en el cliente, el read SHALL iterar con `.range()` hasta agotar el conjunto y SHALL fijar un `.order()` determinístico, de modo que la completitud sea una propiedad del código y no del tamaño del dataset.

Las funciones puras de agregación (`calculateTransactionSums`, `computeRunningBalances`, `buildMonthBalanceSeries`) SHALL permanecer como fuente de verdad de las reglas de signo por tipo de movimiento. Cuando la agregación se implemente en SQL, la migración SHALL replicar esas reglas y un **test de paridad** SHALL alimentar el mismo set de movimientos a la implementación SQL y a la TS verificando que devuelven idéntico resultado, para que las dos no se desincronicen en el tiempo.

Un read paginado destinado a **mostrar** filas (el listado de movimientos) queda fuera de este requirement: su cota es intencional y visible para el usuario. El requirement gobierna los reads cuyo producto es un número.

#### Scenario: El saldo de cuenta no depende del tamaño del ledger

- **WHEN** un usuario tiene un ledger on-ledger que supera el `max-rows` de PostgREST
- **THEN** el saldo de cada cuenta y el Disponible son idénticos a los que daría el mismo ledger por debajo del techo
- **AND** ningún movimiento se pierde silenciosamente del cálculo

#### Scenario: Un select sin cota no puede alimentar un saldo

- **WHEN** un desarrollador inspecciona los reads que alimentan saldos (`getTransactionSums` y equivalentes)
- **THEN** ninguno deriva su resultado de un `.select()` de filas de detalle sin `.range()` exhaustivo ni agregación en SQL
- **AND** los que agregan en el cliente fijan un `.order()` determinístico

#### Scenario: La agregación SQL y la TS dan el mismo número

- **WHEN** se corre el test de paridad con un set de movimientos que cubre todos los tipos (`income`, `expense`, `transfer` de una y de dos patas, `adjustment` signado, `exchange` cross-moneda, `reimbursement` recibido/pendiente/cancelado/en resumen, `settlement` in/out)
- **THEN** la función RPC y `calculateTransactionSums` devuelven el mismo neto por cuenta y moneda
- **AND** el test falla si una de las dos implementaciones cambia sus reglas de signo sin la otra

#### Scenario: El truncado silencioso no vuelve a pasar inadvertido

- **WHEN** un read de saldo recibe exactamente `max-rows` filas
- **THEN** el sistema no asume que el conjunto está completo
- **AND** o bien continúa paginando hasta agotarlo, o bien el número nunca vino de filas de detalle

---

### Requirement: El universo de "cuenta propia" tiene una única definición normativa

El criterio que define qué cuentas componen el patrimonio disponible del usuario —`type IN ('cash','bank') AND is_active = true`— SHALL tener una única definición normativa, y todo read que dependa de él SHALL derivarlo de esa definición en vez de reconstruirlo a mano.

La definición normativa SHALL vivir **en SQL**, dentro de la(s) función(es) RPC que resuelven el saldo: son las que producen el número, corren bajo RLS y son consumibles por igual desde web y mobile. Los reads que además necesitan las **filas de detalle** (no solo el agregado) SHALL obtener el conjunto de cuentas propias desde ese mismo origen, no replicando el predicado.

La definición NO SHALL centralizarse en un helper de `@grana/accounts`: el grafo de dependencias del monorepo va `@grana/accounts → @grana/cards → @grana/transactions → @grana/dashboard`, de modo que `@grana/dashboard` no puede importar `@grana/accounts` sin introducir un ciclo. Ubicar el criterio en SQL evita el ciclo y sirve a los dos paquetes sin invertir la jerarquía.

La duplicación manual ya produjo una divergencia real: `getMonthBalanceSeries` omitía `is_active` mientras el Hero y los reads de `@grana/accounts` lo aplicaban, de modo que una cuenta archivada aportaba movimientos al neto del mes sin aportar saldo al Disponible. Unificar la definición hace que ese defecto sea imposible por olvido en vez de detectable por auditoría.

#### Scenario: Todos los reads de saldo comparten el mismo universo de cuentas

- **WHEN** un desarrollador inspecciona los reads que alimentan Hero/Disponible, "Dónde está", el listado y el detalle de cuentas, y "Balance del mes"
- **THEN** todos derivan las cuentas propias de la misma definición normativa en SQL
- **AND** ninguno reconstruye a mano el predicado `type` + `is_active`

#### Scenario: La definición compartida no introduce un ciclo de paquetes

- **WHEN** se agrega la definición compartida del universo de cuentas propias
- **THEN** `@grana/dashboard` NO importa `@grana/accounts`
- **AND** el grafo de dependencias del monorepo permanece acíclico

#### Scenario: Archivar una cuenta la saca de las dos lentes a la vez

- **WHEN** el usuario archiva una cuenta `type='bank'` que tiene movimientos
- **THEN** la cuenta desaparece simultáneamente del Disponible y del universo de "Balance del mes"
- **AND** no queda ninguna lente en la que sus movimientos sigan contando
