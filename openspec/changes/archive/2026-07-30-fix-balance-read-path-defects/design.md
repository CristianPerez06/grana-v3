## Context

Los saldos de la app se calculan hoy con el mismo patrón en todos lados: traer las filas de `transactions` con PostgREST y sumarlas en JS con `calculateTransactionSums`. El patrón está implementado dos veces casi idéntico —`packages/accounts/src/queries.ts:33-53` y `packages/dashboard/src/queries.ts:71-98`— y cada call site reconstruye a mano el predicado de "cuenta propia".

Los tres defectos que este change corrige (ver `proposal.md`) son consecuencias de eso:

| # | Defecto | Estado hoy | Efecto |
|---|---|---|---|
| 1 | `getMonthBalanceSeries` no filtra `is_active` | Alcanzable si el usuario archiva una cuenta con historia | El neto del mes deja de reconciliar con el Disponible |
| 2 | Agregación sobre `.select()` sin cota | Latente (484 filas on-ledger contra un `max-rows` de 1000) | Al cruzar el techo, saldos silenciosamente incorrectos y no determinísticos |
| 3 | `transfer` descartado siempre en `classifyCashContribution` | Latente, **lo destapa arreglar el #1** | Una transferencia de una sola pata mueve el Disponible sin mover el neto del mes |

El #2 no está mordiendo hoy y el #1 solo muerde con cuentas archivadas — pero los dos son el mismo tipo de falla: un número de plata que sale plausible y mal, sin error, sin log, sin señal. Ese modo de falla es el que justifica tratarlos juntos en vez de parchar el `is_active` y seguir.

**Restricción dura del monorepo.** El grafo es `@grana/accounts → @grana/cards → @grana/transactions → @grana/dashboard`. Por lo tanto `@grana/dashboard` **no puede** importar `@grana/accounts`. Cualquier diseño que quiera "un helper compartido de cuentas propias en el paquete accounts" está descartado de entrada: sería un ciclo.

## Goals / Non-Goals

**Goals:**

- El neto del mes reconcilia con el cambio del Disponible también cuando hay cuentas archivadas y transferencias de una sola pata.
- La corrección de un saldo deja de depender del tamaño del ledger.
- El criterio "cuenta propia" y las reglas de signo por tipo tienen cada uno **una** definición normativa, no N copias sincronizadas a mano.
- Cero cambio de comportamiento observable para el caso sano (sin cuentas archivadas, ledger chico): los números de hoy no se mueven.

**Non-Goals:**

- Renombrar la card "Balance del mes" / el label "Balance", ni agregarle el signo `−` a la fila "Pago de tarjeta". Es un problema de copy real (el número se lee como stock siendo flujo) pero es otro change.
- Introducir carry-over de saldo entre meses. La sección es flujo por diseño y sigue arrancando en cero cada mes.
- Tocar `initial_balance_date` (hoy decorativo: `computeBalance` suma `initial_balance` a **todas** las transacciones sin importar la fecha). Es una tercera deuda, independiente y no alcanzada por este change.
- Cambiar el contrato de retorno de los reads. Ningún componente de `apps/web` ni de `apps/mobile` se toca.

## Decisions

### D1 — La agregación de saldo se mueve a Postgres vía RPC `SECURITY INVOKER`

Una función SQL devuelve el neto **por cuenta y moneda** en vez de embarcar el ledger al cliente.

*Por qué.* Resuelve el #2 de raíz en vez de mitigarlo: el tamaño de la respuesta pasa a ser función de la cantidad de cuentas (decenas) y no de la cantidad de movimientos (ilimitada), así que el `max-rows` deja de ser alcanzable en vez de quedar "lejos por ahora". Además le da al criterio de cuenta propia un hogar que **los dos** paquetes pueden consumir sin violar el grafo de dependencias (D2). Es el contrato que la spec `web-data-access` ya establece para reads compuestos calientes, y el repo ya lo usa para la página de movimientos, así que no inventa un patrón.

*Alternativa considerada: paginación exhaustiva con `.range()` en JS.* Más barata (sin migración, sin SQL nuevo) y suficiente para el #2 en sentido estricto. Descartada como solución principal porque deja la agregación en el cliente —N roundtrips en vez de uno, y el ledger entero cruzando la red para producir un puñado de números— y sobre todo porque no ofrece dónde poner la definición compartida de cuenta propia sin el ciclo de paquetes. Se conserva igual para un caso puntual (D4).

*Trade-off aceptado.* Aparece una segunda implementación de las reglas de signo (SQL) que puede desincronizarse de la TS. Se ancla con D3.

### D2 — El criterio "cuenta propia" vive en SQL, no en un paquete TS

`type IN ('cash','bank') AND is_active = true` queda dentro de la función RPC.

*Por qué.* Es la única ubicación que sirve a `@grana/accounts` y a `@grana/dashboard` sin invertir la jerarquía ni crear el ciclo. Como beneficio secundario, corre bajo RLS del lado del servidor, que es donde el criterio de "qué cuentas son del usuario" pertenece conceptualmente.

*Alternativa considerada: helper en `@grana/money-logic`.* Es el paquete más bajo del grafo, así que no habría ciclo. Descartada porque `money-logic` está definido como lógica pura entity-agnostic sin cliente Supabase (AGENTS.md), y meterle un read lo convierte en otra cosa. *Alternativa considerada: helper en `@grana/dashboard` importado desde `accounts`.* Técnicamente válido (esa dirección sí existe) pero pone el criterio de cuentas en el paquete del dashboard, que es exactamente al revés de donde se lo busca.

### D3 — Las funciones puras TS siguen siendo la fuente de verdad, ancladas por un test de paridad

`calculateTransactionSums`, `computeRunningBalances` y `buildMonthBalanceSeries` no se modifican. La RPC replica sus reglas y un test alimenta el mismo set de movimientos a las dos implementaciones exigiendo idéntico resultado.

*Por qué.* Sin ese test, D1 cambia un bug latente por uno peor: dos definiciones de las reglas de signo divergiendo en silencio con el tiempo. El set del test cubre explícitamente los tipos que ya se descartaron alguna vez por omisión (`reimbursement` en sus cuatro estados, `settlement` in/out, `exchange` cross-moneda) más el `transfer` de una y de dos patas del #3.

### D4 — `getAccountMovementsAscending` se pagina, no se agrega

Este read necesita las **filas** (el running balance per-row del detalle de cuenta), así que no puede agregarse en SQL. Se le agrega un loop de `.range()` hasta agotar el conjunto. Ya tiene `.order()` determinístico por `date, created_at, id`.

*Por qué.* Es el único read de esta familia cuyo producto son filas y no un número, y su comentario actual ("No pagination... the running balance needs the full history to be correct") es cierto solo por debajo del `max-rows`. Está scopeado a una cuenta, así que el techo está más lejos, pero la afirmación del comentario tiene que volverse verdadera.

### D5 — `classifyCashContribution` evalúa las dos patas del transfer por separado

La rama `transfer` deja de devolver `null` incondicionalmente: resta si el origen es propio, suma si el destino lo es, cada condición independiente — la misma forma que ya tiene `calculateTransactionSums`.

*Por qué.* Con las dos patas propias el neto sigue dando cero, así que el comportamiento visible de hoy se preserva. Solo cambia el caso de una pata, que es justamente el que #1 vuelve alcanzable. Arreglarlo en el mismo change es obligatorio: arreglar el `is_active` sin esto deja la reconciliación rota en el escenario que el change viene a corregir.

## Risks / Trade-offs

- **Toca el cálculo de todos los saldos de la app** → Las funciones puras no se modifican (D3) y el test de paridad ancla la equivalencia. El caso sano no debe mover un peso: se verifica contra el ledger real del usuario (484 filas, saldos conocidos) antes y después.
- **Dos implementaciones de las reglas de signo (SQL + TS)** → Es el costo de D1. Mitigado por el test de paridad (D3), que falla si una cambia sin la otra. Sin ese test, no hacer D1.
- **`SECURITY INVOKER` mal escrito filtra datos entre usuarios** → La función no eleva privilegios y RLS aplica con los permisos del caller, igual que la RPC de movimientos ya en producción. Se agrega el escenario de RLS al set de tests, que es el mismo que la spec `web-data-access` ya exige.
- **El fix de `is_active` cambia números ya vistos por el usuario** → Es el punto: si tiene cuentas archivadas con movimientos, el neto del mes de meses pasados va a cambiar (a correcto). Vale confirmar con Q5 del diagnóstico si el caso existe hoy, para saber si el cambio es visible o puramente preventivo.
- **Scope creep hacia `initial_balance_date`** → Declarado Non-Goal explícito. Es deuda real pero ortogonal.

## Migration Plan

1. Migración con la(s) función(es) RPC. Aditiva: no toca tablas, no borra nada, no rompe callers existentes.
2. Cambiar los reads para consumir la RPC, un call site por vez, con el test de paridad en verde.
3. Verificar contra el ledger real: saldos por cuenta y neto de junio/julio idénticos a los valores ya reconciliados a mano (MP: `initial_balance 2.850.000 − 2.534.848,75 = 315.151,25`; julio ARS: `−2.684.140`).

*Rollback.* Los pasos 1 y 2 son independientes: revertir el código deja la función SQL huérfana pero inofensiva. No hay cambio de datos que deshacer.

## Open Questions

- ¿Una sola RPC que devuelva neto por cuenta+moneda para todas las cuentas propias, o dos (una global para Hero/listado, una scopeada por `account_id` para el detalle)? Con una sola alcanza si el filtrado por cuenta se hace en el cliente sobre un resultado ya chico; conviene medir antes de partirla.
- ¿`getAccountIdsWithTransactions` (mismo patrón sin cota, usado solo para el affordance "archivar vs eliminar") se pliega dentro de la misma RPC o se resuelve aparte con un `EXISTS`? No alimenta un saldo, así que no lo alcanza el requirement, pero comparte el defecto y está al lado.
- ¿El `max-rows` real del proyecto Supabase es 1000 (default) o está configurado a otro valor? No cambia el diseño —la corrección deja de depender de ese número— pero sí cuánto margen hay hoy.
