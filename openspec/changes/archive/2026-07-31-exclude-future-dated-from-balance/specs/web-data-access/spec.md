# web-data-access — delta

## MODIFIED Requirements

### Requirement: Los reads que alimentan un saldo o un agregado monetario son completos por construcción

Un read cuyo resultado alimenta un saldo, un neto o cualquier agregado monetario SHALL ser **completo por construcción**: su corrección NO SHALL depender de que la cantidad de filas quede por debajo de un techo implícito del servidor.

PostgREST aplica un `max-rows` configurado del lado del servidor (1000 por defecto en Supabase). Un `.select()` sin cota explícita que supere ese techo se **trunca en silencio**: devuelve `error === null` y menos filas de las que matchean, sin señal alguna para el caller. Un agregado calculado sobre ese resultado es un número plausible pero incorrecto, y el modo de falla es especialmente hostil porque aparece de golpe al cruzar un umbral invisible y sin `ORDER BY` es no determinístico qué filas se pierden.

Por lo tanto, el sistema NO SHALL derivar un saldo de un `.select()` que traiga filas de detalle sin una cota explícita. Un read de este tipo SHALL adoptar una de estas dos formas:

1. **Agregación en Postgres (preferido).** El neto se calcula en SQL vía función RPC `SECURITY INVOKER` y viaja ya agregado (p. ej. neto por cuenta y moneda). El volumen de la respuesta pasa a ser función de la cantidad de cuentas, no de la cantidad de movimientos, y el techo deja de ser alcanzable. Es el mismo contrato que el requirement "Los reads compuestos calientes se implementan como funciones RPC de Postgres".
2. **Paginación explícita y exhaustiva.** Si la agregación debe ocurrir en el cliente, el read SHALL iterar con `.range()` hasta agotar el conjunto y SHALL fijar un `.order()` determinístico, de modo que la completitud sea una propiedad del código y no del tamaño del dataset.

**Corte temporal del saldo.** Los reads que alimentan un saldo actual (`get_account_balance_sums` y equivalentes) SHALL aplicar además el corte `date <= hoy_AR` definido por los specs `accounts` y `transactions`. En SQL, "hoy" SHALL computarse con el timezone financiero explícito — `(now() at time zone 'America/Argentina/Buenos_Aires')::date` — nunca `current_date` a secas (el timezone del servidor de Supabase es UTC y adelantaría el corte hasta 3 horas). En los espejos TS, `hoy` SHALL inyectarse como parámetro (`todayISO`) por el caller — misma convención "today inyectado" que rige los packages client-agnósticos — sin invocar relojes internamente.

Las funciones puras de agregación (`calculateTransactionSums`, `computeRunningBalances`, `buildMonthBalanceSeries`) SHALL permanecer como fuente de verdad de las reglas de signo por tipo de movimiento. Cuando la agregación se implemente en SQL, la migración SHALL replicar esas reglas y un **test de paridad** SHALL alimentar el mismo set de movimientos a la implementación SQL y a la TS verificando que devuelven idéntico resultado, para que las dos no se desincronicen en el tiempo. El set de paridad SHALL incluir filas con `date` futura, verificando que ambas implementaciones las excluyen del neto. `computeRunningBalances` queda **fuera** del corte temporal: el saldo corriente es una proyección cronológica por fila y las filas futuras muestran su saldo proyectado.

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

- **WHEN** se corre el test de paridad con un set de movimientos que cubre todos los tipos (`income`, `expense`, `transfer` de una y de dos patas, `adjustment` signado, `exchange` cross-moneda, `reimbursement` recibido/pendiente/cancelado/en resumen, `settlement` in/out) e incluye filas con `date` futura
- **THEN** la función RPC y `calculateTransactionSums` devuelven el mismo neto por cuenta y moneda
- **AND** las filas con `date` futura no aportan al neto en ninguna de las dos implementaciones
- **AND** el test falla si una de las dos implementaciones cambia sus reglas de signo o su corte temporal sin la otra

#### Scenario: El corte temporal usa el timezone financiero, no el del servidor

- **WHEN** el servidor de base de datos corre en UTC y en `America/Argentina/Buenos_Aires` todavía no cambió el día
- **THEN** el "hoy" del corte en SQL sigue siendo la fecha calendario AR
- **AND** una transacción fechada en el día UTC entrante no entra al saldo antes de tiempo

#### Scenario: El truncado silencioso no vuelve a pasar inadvertido

- **WHEN** un read de saldo recibe exactamente `max-rows` filas
- **THEN** el sistema no asume que el conjunto está completo
- **AND** o bien continúa paginando hasta agotarlo, o bien el número nunca vino de filas de detalle
