# web-data-access — delta

## MODIFIED Requirements

### Requirement: Los reads que alimentan un saldo o un agregado monetario son completos por construcción

Un read cuyo resultado alimenta un saldo, un neto o cualquier agregado monetario SHALL ser **completo por construcción**: su corrección NO SHALL depender de que la cantidad de filas quede por debajo de un techo implícito del servidor.

PostgREST aplica un `max-rows` configurado del lado del servidor (1000 por defecto en Supabase). Un `.select()` sin cota explícita que supere ese techo se **trunca en silencio**: devuelve `error === null` y menos filas de las que matchean, sin señal alguna para el caller. Un agregado calculado sobre ese resultado es un número plausible pero incorrecto, y el modo de falla es especialmente hostil porque aparece de golpe al cruzar un umbral invisible y sin `ORDER BY` es no determinístico qué filas se pierden.

Por lo tanto, el sistema NO SHALL derivar un saldo de un `.select()` que traiga filas de detalle sin una cota explícita. Un read de este tipo SHALL adoptar una de estas dos formas:

1. **Agregación en Postgres (preferido).** El neto se calcula en SQL vía función RPC `SECURITY INVOKER` y viaja ya agregado (p. ej. neto por cuenta y moneda). El volumen de la respuesta pasa a ser función de la cantidad de cuentas, no de la cantidad de movimientos, y el techo deja de ser alcanzable. Es el mismo contrato que el requirement "Los reads compuestos calientes se implementan como funciones RPC de Postgres".
2. **Paginación explícita y exhaustiva.** Si la agregación debe ocurrir en el cliente, el read SHALL iterar con `.range()` hasta agotar el conjunto y SHALL fijar un `.order()` determinístico, de modo que la completitud sea una propiedad del código y no del tamaño del dataset.

**Corte temporal del saldo.** Los reads que alimentan un saldo actual (`get_account_balance_sums` y equivalentes) SHALL aplicar además el corte `date <= hoy_AR` definido por los specs `accounts` y `transactions`. En SQL, "hoy" SHALL computarse con el timezone financiero explícito — `(now() at time zone 'America/Argentina/Buenos_Aires')::date` — nunca `current_date` a secas (el timezone del servidor de Supabase es UTC y adelantaría el corte hasta 3 horas). En los espejos TS, `hoy` SHALL inyectarse como parámetro (`todayISO`) por el caller — misma convención "today inyectado" que rige los packages client-agnósticos — sin invocar relojes internamente.

**Corte temporal de las lecturas mensuales.** Los reads que alimentan un agregado del **mes** (serie de balance mensual, desglose por categoría y sus drills, desglose de ingresos) SHALL aplicar el mismo corte, expresado como predicado de la query en vez de en SQL propio: la ventana de fechas SHALL terminar en `min(fin de mes, hoy_AR)` para los reads de caja pura, y el resto SHALL usar el predicado `(status IS NOT NULL OR date <= hoy_AR)`, que preserva la lente devengado de las filas de tarjeta (ver spec `spending-by-category`). El corte SHALL aplicarse **en el servidor** (predicado PostgREST), no filtrando en JS después de traer el mes: angostar la ventana es compatible con "completo por construcción" — truncarla no lo sería.

La regla del corte (qué es una fila de tarjeta, cuál es el predicado, cuál es el "hoy" financiero) SHALL vivir en **un único helper compartido** (`@grana/money-logic`), y cada read SHALL derivarla de ahí en vez de reescribir el predicado a mano. Es el mismo criterio que el universo de "cuenta propia": una regla monetaria replicada a mano en N queries diverge por olvido, y el síntoma es un número plausible y equivocado.

`hoy_AR` SHALL ser el mismo valor para todos los agregados de una misma pantalla: el corte del saldo y el del mes SHALL caer en el mismo día, o la reconciliación entre el Disponible y el neto del mes que exige el spec `dashboard` deja de sostenerse.

Las funciones puras de agregación (`calculateTransactionSums`, `computeRunningBalances`, `buildMonthBalanceSeries`) SHALL permanecer como fuente de verdad de las reglas de signo por tipo de movimiento. Cuando la agregación se implemente en SQL, la migración SHALL replicar esas reglas y un **test de paridad** SHALL alimentar el mismo set de movimientos a la implementación SQL y a la TS verificando que devuelven idéntico resultado, para que las dos no se desincronicen en el tiempo. El set de paridad SHALL incluir filas con `date` futura, verificando que ambas implementaciones las excluyen del neto. `computeRunningBalances` queda **fuera** del corte temporal: el saldo corriente es una proyección cronológica por fila y las filas futuras muestran su saldo proyectado.
