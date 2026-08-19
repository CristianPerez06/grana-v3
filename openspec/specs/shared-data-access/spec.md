# shared-data-access Specification

## Purpose

Define la capa de datos agnóstica de plataforma del dominio Compartido (hogar): el paquete `@grana/shared`. Concentra las lecturas (parametrizadas por un cliente de Supabase, con la matemática derivada en `@grana/money-logic`) y los núcleos de mutación (validación + RPC atómica, sin glue de plataforma) para que web y mobile consuman la MISMA lógica —web agrega `revalidatePath` en sus server actions, mobile invalida react-query— sin duplicar reads ni writes. Fija además el hogar canónico de los tipos compartidos (`Household` en `@grana/ui-contracts`) y mantiene el paquete libre de UI para no introducir una segunda versión de React en el monorepo.
## Requirements
### Requirement: El dominio Compartido expone sus lecturas desde un paquete `@grana/shared` agnóstico de plataforma

El monorepo SHALL exponer las lecturas del dominio Compartido (hogar, deuda, proyección, cuenta corriente, liquidaciones pendientes, movimientos compartidos, reparto de un movimiento) desde un paquete `@grana/shared` consumible por `apps/web` y `apps/mobile`. Cada lectura SHALL recibir el cliente de Supabase como parámetro (no crear su propio cliente ni depender de un runtime de plataforma) y SHALL derivar la matemática de deuda/proyección delegando en `@grana/money-logic`, sin recalcular en la capa de lectura.

Las funciones de lectura SHALL cubrir al menos: `getHousehold`, `getHouseholdDebt`, `getHouseholdOutlook`, `getCurrentAccount`, `getPendingSettlements`, `getSharedAccruedMovements`, `getMovementSharedInfo`, `getSharedExpenses`.

Cuando una lectura necesite el nombre de un conviviente, SHALL obtenerlo invocando el RPC de profiles de convivientes y NO SHALL leer la tabla `profiles` directamente. El paquete NO SHALL depender de enumerar columnas en el `select` para evitar exponer datos ajenos: el allowlist es responsabilidad de la base, y la capa de datos se limita a consumirlo.

#### Scenario: Una lectura recibe el cliente y no lo construye

- **WHEN** un desarrollador invoca cualquier lectura de `@grana/shared`
- **THEN** la función acepta el cliente de Supabase como argumento
- **AND** no importa ni inicializa un cliente propio de web o de mobile

#### Scenario: La deuda se deriva, no se persiste ni recalcula en la lectura

- **WHEN** `getHouseholdDebt` produce la deuda neta por moneda
- **THEN** la derivación usa `@grana/money-logic`
- **AND** el resultado no lee un saldo persistido ni reimplementa la matemática de reparto

#### Scenario: El nombre del conviviente se resuelve vía RPC

- **WHEN** una lectura de `@grana/shared` necesita el `full_name` de un conviviente
- **THEN** lo obtiene invocando el RPC de profiles de convivientes
- **AND** no existe en el paquete ninguna consulta directa a la tabla `profiles` para leer filas ajenas

#### Scenario: La lectura sigue funcionando tras mover el allowlist a la base

- **WHEN** un usuario abre el módulo Compartido teniendo un conviviente en su hogar
- **THEN** la UI muestra el nombre del conviviente igual que antes del cambio
- **AND** ningún flujo del módulo cambia de comportamiento visible

### Requirement: El dominio Compartido expone núcleos de mutación agnósticos de plataforma

`@grana/shared` SHALL exponer núcleos de mutación (validación de input + llamada a la RPC atómica correspondiente) para las operaciones de escritura del dominio: crear hogar, generar invitación, unirse con código, actualizar configuración (nombre / split por defecto), salir del hogar, registrar liquidación, asignar cuenta receptora y revertir/cancelar liquidación. Cada núcleo SHALL devolver un resultado tipado de éxito o error de campo/formulario, y NO SHALL contener acoplamiento de plataforma (ni `revalidatePath`, ni invalidación de react-query, ni redirecciones).

La glue de plataforma SHALL vivir en el consumidor: las server actions de web (`'use server'`) envuelven el núcleo y agregan `revalidatePath`; los handlers de mobile envuelven el núcleo e invalidan las queries de react-query.

#### Scenario: El núcleo valida y llama la RPC sin glue de plataforma

- **WHEN** un consumidor invoca un núcleo de mutación (p. ej. registrar liquidación)
- **THEN** el núcleo valida el input y llama la RPC atómica (`register_settlement`, `confirm_settlement`, `reverse_settlement`, `join_household_by_code`, según corresponda)
- **AND** devuelve un resultado tipado sin ejecutar `revalidatePath` ni tocar react-query

#### Scenario: La web mantiene el borde `'use server'` delegando al núcleo

- **WHEN** una server action de `apps/web/app/_actions/shared.ts` procesa una escritura
- **THEN** delega la validación y la RPC al núcleo de `@grana/shared`
- **AND** conserva su `revalidatePath` propio como glue de plataforma

### Requirement: Los tipos compartidos del hogar tienen un único hogar canónico

El tipo `Household` (y `HouseholdMember`) SHALL definirse una sola vez, en `@grana/ui-contracts`, y ser consumido desde ahí por `@grana/shared`, `@grana/movement-form`, `apps/web` y `apps/mobile`. NO SHALL existir una segunda definición del tipo en `apps/web/lib/shared/types.ts` ni en `packages/movement-form/src/types.ts`.

#### Scenario: No hay definiciones duplicadas del tipo Household

- **WHEN** un desarrollador busca la definición de `type Household` en el monorepo
- **THEN** existe exactamente una, en `@grana/ui-contracts`
- **AND** el resto de los paquetes/apps la importan desde ahí

### Requirement: Los consumidores usan el paquete sin duplicar la capa de datos

`apps/web` SHALL consumir las lecturas de `@grana/shared` directamente desde sus server components, sin dejar un shim intermedio: `apps/web/lib/shared/queries.ts` SHALL ser eliminado (consistente con el rollout de direct reads que borró `app/_actions/queries.ts`). En `apps/mobile`, la **implementación duplicada** del stub (`apps/mobile/lib/shared/queries.ts`, con los cuerpos propios de `getHousehold` + `getMovementSharedInfo`) SHALL ser reemplazada por un wrapper delgado que inyecta el cliente nativo en las lecturas de `@grana/shared` y conserva las firmas de la app (mismo patrón que `lib/cards/queries.ts` y `lib/transactions/queries.ts`); NO SHALL quedar ninguna reimplementación de esas lecturas en `apps/mobile`.

`@grana/shared` SHALL permanecer libre de UI (solo tipos + lógica) para no introducir una segunda versión de React en el monorepo (RN 0.81 fija React a 19.1.0).

#### Scenario: La web ya no tiene la capa de lectura local

- **WHEN** un desarrollador busca `apps/web/lib/shared/queries.ts`
- **THEN** el archivo no existe
- **AND** los server components importan las lecturas desde `@grana/shared`

#### Scenario: Mobile ya no duplica las lecturas del hogar

- **WHEN** un desarrollador inspecciona `apps/mobile/lib/shared/queries.ts`
- **THEN** no contiene cuerpos propios de `getHousehold`/`getMovementSharedInfo`, solo wrappers que inyectan el cliente en las lecturas de `@grana/shared`
- **AND** el movement form y el módulo Hogar obtienen esas lecturas de `@grana/shared` (vía el wrapper delgado)

#### Scenario: El paquete no arrastra React

- **WHEN** un desarrollador inspecciona las dependencias de `@grana/shared`
- **THEN** no depende de `react` ni de componentes de UI
- **AND** ambas apps pueden importarlo sin duplicar la versión de React

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

