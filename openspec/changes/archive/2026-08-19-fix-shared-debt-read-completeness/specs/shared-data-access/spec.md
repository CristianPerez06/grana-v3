## ADDED Requirements

### Requirement: Las lecturas del hogar que alimentan un agregado monetario son completas por construcción

Toda lectura de `@grana/shared` cuyo resultado alimente un agregado monetario del hogar —la deuda neta, el saldo de la cuenta corriente, el extracto, la proyección de lo que se viene, y el devengado del mes ("Gastaron juntos", el desglose por categoría y el NETO)— SHALL ser **completa por construcción**: su corrección NO SHALL depender de que el hogar quede por debajo de un techo implícito del servidor.

PostgREST aplica un `max-rows` server-side (1000 por defecto en Supabase). Un `.select()` sin cota explícita que lo supere se **trunca en silencio**: devuelve `error === null` y menos filas de las que matchean, sin señal alguna para el caller. Un saldo derivado de ese resultado es un número plausible y equivocado. Sin `ORDER BY` es además **no determinístico** qué filas se pierden, de modo que el mismo hogar puede producir dos saldos distintos en dos requests consecutivos. Es el mismo modo de falla que el spec `web-data-access` ya gobierna para los saldos de cuenta; este requirement lo enuncia sobre el dominio Compartido para que no haya que inferirlo.

Por lo tanto, las lecturas que alimentan la deuda y el devengado del hogar SHALL iterar con `.range()` hasta agotar el conjunto y SHALL fijar un `.order()` determinístico que haga estable el paginado, de modo que la completitud sea una propiedad del código y no del tamaño del dataset. El tamaño de página SHALL ser una constante del cliente independiente del `max-rows` del servidor: un techo servidor más chico SHALL costar round-trips adicionales y NO SHALL truncar.

Angostar la ventana de una lectura mensual a su mes es compatible con este requirement —es un predicado del dominio, aplicado en el servidor—; **truncar dentro de esa ventana no lo es**. Una lectura mensual SHALL paginar exhaustivamente sobre su ventana en vez de acotarla con un `.limit()` fijo.

El conjunto de filas a traer SHALL expresarse como predicado del servidor (por ejemplo `household_id` + `is_shared`) en lugar de materializar la lista de ids en el cliente y mandarla por query string: una lista de ids larga cruza el límite de largo de URL de PostgREST y hace fallar el request, un modo de falla que la paginación por sí sola no resuelve.

Las funciones puras de `@grana/money-logic` SHALL permanecer como fuente de verdad de la fórmula de deuda y de las reglas de signo. Este requirement gobierna únicamente la completitud del dataset que se les entrega.

Una lectura destinada a **mostrar** filas —el listado de movimientos compartidos recientes o del mes— queda **fuera** de este requirement: su cota es intencional y visible para el usuario. El requirement gobierna las lecturas cuyo producto es un número. Igualmente quedan fuera las lecturas acotadas por construcción del dominio (el reparto de un movimiento y sus cuotas), donde el universo es de decenas de filas y no existe techo alcanzable.

#### Scenario: La deuda del hogar no depende de la cantidad de movimientos compartidos

- **WHEN** un hogar acumula más movimientos compartidos que el `max-rows` de PostgREST
- **THEN** la deuda neta, el saldo de la cuenta corriente y el extracto son idénticos a los que daría el mismo historial por debajo del techo
- **AND** ningún split, movimiento ni liquidación se pierde silenciosamente del cálculo

#### Scenario: Ninguna lectura de la deuda deriva su resultado de un select sin cota

- **WHEN** un desarrollador inspecciona las lecturas de `@grana/shared` que alimentan la deuda y el devengado del hogar
- **THEN** ninguna trae filas de detalle con un `.select()` sin `.range()` exhaustivo
- **AND** todas fijan un `.order()` determinístico
- **AND** ninguna arma la lista de ids en el cliente para mandarla por query string

#### Scenario: Un techo del servidor más chico cuesta round-trips, no filas

- **WHEN** el servidor devuelve menos filas por página que el tamaño de página que pide el cliente
- **THEN** la lectura continúa paginando hasta agotar el conjunto
- **AND** el resultado final contiene todas las filas que matchean el predicado

#### Scenario: La ventana mensual se angosta pero no se trunca

- **WHEN** un hogar registra en un mismo mes más movimientos compartidos que la cota de una página
- **THEN** el devengado del mes suma todos los movimientos de esa ventana
- **AND** "Gastaron juntos", el desglose por categoría y el NETO no dependen del volumen del mes

#### Scenario: El saldo es estable entre requests

- **WHEN** se pide la cuenta corriente del mismo hogar dos veces sin que cambien los datos
- **THEN** ambas respuestas producen el mismo saldo y el mismo orden de extracto

#### Scenario: El listado de movimientos conserva su cota de presentación

- **WHEN** la UI pide los movimientos compartidos recientes con un límite explícito
- **THEN** la lectura respeta ese límite sin paginar hasta agotar el conjunto
- **AND** ese límite no alimenta ningún agregado monetario
