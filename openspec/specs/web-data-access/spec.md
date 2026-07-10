# web-data-access Specification

## Purpose

Define la arquitectura del read path de `apps/web`: los reads van directos browser → Supabase (PostgREST) vía TanStack Query, con query functions que reciben el client inyectado (compartibles con mobile y otros consumers); los reads compuestos/calientes se implementan como funciones RPC de Postgres; las mutaciones permanecen como server actions; RLS es la frontera de autorización de los reads; la sesión se valida localmente (claims del JWT) en el proxy; y ningún write bloquea el read path.
## Requirements
### Requirement: Los reads de las rutas web van directo del browser a Supabase

Las rutas client de `apps/web` SHALL obtener sus datos de lectura consultando Supabase (PostgREST) directamente desde el browser vía TanStack Query, usando el browser client (`lib/supabase/client.ts`, sesión compartida por cookies con el server). Las server actions NO SHALL usarse como `queryFn` de queries de lectura — quedan reservadas para mutaciones (donde la serialización de React es aceptable) y conservan `revalidatePath` + invalidación TanStack.

Las query functions de lectura SHALL ser client-agnósticas: reciben el client Supabase como primer parámetro (`(supabase, …)`) en lugar de crearlo internamente, de modo que web (browser client), mobile (client nativo) y cualquier otro consumer puedan reutilizarlas sin cambios.

Los query keys y los `staleTime` por familia centralizados en `lib/query-client.ts` SHALL conservarse al migrar una query de transporte: cambiar el mecanismo de fetch NO SHALL cambiar la identidad de cache ni su política de frescura.

Esta capability define el patrón canónico; las rutas existentes migran ruta por ruta en changes dedicados. Rutas migradas a la fecha: `/transactions`, `/accounts/[id]`, `/dashboard`, `/transactions/recurring`. Con la migración de `/transactions/recurring` no queda ningún server action de lectura usado como `queryFn` en el repo (`app/_actions/queries.ts` eliminado).

#### Scenario: El mount de /transactions fetchea en paralelo

- **WHEN** el usuario hace un cold-load de `/transactions`
- **THEN** las queries de las secciones (listado, breakdown, filter options, pending blocks, sugerencia) se disparan como requests HTTP concurrentes browser → Supabase
- **AND** ninguna espera en una cola de server actions: el tiempo de datos del mount queda gobernado por la cadena más lenta, no por la suma de todas

#### Scenario: El mount de /accounts/[id] fetchea en paralelo

- **WHEN** el usuario hace un cold-load de `/accounts/[id]`
- **THEN** las queries de las secciones (account detail, historial ascendente de movimientos, filter options, pending reimbursements, linked recurrence ids, institutions) se disparan como requests HTTP concurrentes browser → Supabase
- **AND** ninguna espera en una cola de server actions: el tiempo de datos del mount queda gobernado por la cadena más lenta, no por la suma de todas

#### Scenario: La navegación de mes en /dashboard refetchea sin cola de actions

- **WHEN** el usuario cambia el mes seleccionado en `/dashboard` y los islands "Balance del mes" y "En qué se fue" refetchean su mes
- **THEN** ambos refetches se disparan como requests HTTP concurrentes browser → Supabase
- **AND** ninguno espera en una cola de server actions: el cambio de mes queda gobernado por el refetch más lento, no por la suma de ambos
- **AND** el mes actual sigue sirviéndose del `initialData` server-rendered sin refetch

#### Scenario: El botón de creación de /transactions/recurring fetchea sus catálogos directo

- **WHEN** el usuario abre `/transactions/recurring` y el botón "Crear recurrencia" carga sus catálogos (accounts y categories)
- **THEN** ambas queries se disparan como requests HTTP browser → Supabase invocando `getAccounts`/`getAllCategories` con el browser client, no vía server actions
- **AND** conservan los query keys `accountsList` y `categoriesTree` y su política de frescura previa
- **AND** el botón permanece visible y disabled hasta que ambos catálogos resuelven (chrome-always-visible)

#### Scenario: Una query function migrada es reutilizable desde mobile

- **WHEN** una query function de lectura migra al patrón de esta capability
- **THEN** su firma recibe el client Supabase como primer parámetro y no importa `@/lib/supabase/server`
- **AND** puede invocarse sin modificación con el client de `apps/mobile`

#### Scenario: Las mutaciones siguen siendo server actions

- **WHEN** el usuario registra, edita o elimina un movimiento desde una ruta migrada
- **THEN** la operación ejecuta una server action (no una llamada directa del browser)
- **AND** la action conserva su `revalidatePath` y la invalidación de queries TanStack existente

### Requirement: Los reads compuestos calientes se implementan como funciones RPC de Postgres

Cuando un read requiere lógica que PostgREST no expresa en un solo roundtrip (self-joins, filtros compuestos, paginación con lookahead), el sistema SHALL implementarlo como función SQL en una migración, invocada vía `supabase.rpc(...)`. Las funciones SHALL ser `SECURITY INVOKER` para que RLS aplique con los permisos del usuario que llama.

La página global de movimientos SHALL implementarse bajo este contrato: una función que aplica **todos** los filtros en SQL (rango de fechas/mes, categoría, subcategoría incluyendo el marker "sin subcategoría", moneda, cuenta — incluyendo parents con hijos en la cuenta y card payments vía `period_payments` —, tipo funcional, texto y rango de montos), excluye reimbursements no recibidos o cancelados, resuelve el linked expense de cada reimbursement en el mismo query, y devuelve `limit + 1` filas para derivar `hasMore` sin queries adicionales.

#### Scenario: La página de movimientos filtrada resuelve en un roundtrip

- **WHEN** el usuario aplica un filtro de texto, tipo funcional o rango de montos en `/transactions`
- **THEN** el listado resultante se obtiene con una única invocación RPC que aplica todos los filtros en SQL
- **AND** el sistema NO pagina chunks descartando filas en el cliente

#### Scenario: El linked expense del reimbursement viene embebido

- **WHEN** la página de movimientos incluye un reimbursement recibido con `linked_transaction_id`
- **THEN** la respuesta de la RPC incluye los datos del gasto vinculado (descripción, categoría, fecha, monto) sin un segundo query

#### Scenario: hasMore se deriva del lookahead

- **WHEN** la RPC se invoca con `limit = 50` y existen al menos 51 filas que matchean
- **THEN** la respuesta permite derivar `hasMore = true` sin un count adicional
- **AND** el listado muestra exactamente 50 filas

#### Scenario: RLS aplica dentro de la RPC

- **WHEN** un usuario invoca la RPC de movimientos
- **THEN** solo recibe filas que las policies de RLS le permiten leer (propias o de su household)
- **AND** la función no eleva privilegios (`SECURITY INVOKER`)

### Requirement: RLS es la frontera de autorización de los reads web

Toda tabla que una ruta web lee directamente desde el browser SHALL tener Row Level Security habilitado con policies de SELECT que limiten el acceso al owner o a su household según el dominio. Antes de migrar una ruta al patrón de lectura directa, las tablas nuevas de su read path SHALL auditarse: RLS habilitado, policy de SELECT presente y correcta, y sin aperturas mayores a las que el read server-side tenía.

#### Scenario: Migrar una ruta exige auditar sus tablas

- **WHEN** un change migra una ruta al patrón de lectura directa e introduce una tabla no auditada previamente
- **THEN** el change incluye la verificación de RLS + policy de SELECT de esa tabla
- **AND** los hallazgos se corrigen por migración dentro del mismo change

#### Scenario: Un usuario no puede leer datos ajenos por el path directo

- **WHEN** un usuario autenticado consulta desde el browser una tabla del read path con un filtro que matchearía filas de otro usuario fuera de su household
- **THEN** la respuesta no incluye ninguna fila ajena

### Requirement: La sesión se valida localmente en el camino de datos

El proxy de `apps/web` SHALL validar la sesión verificando las claims del JWT localmente (firma asimétrica), sin un roundtrip de red al Auth server por request. El helper de autenticación de las server actions SHALL resolver el `user_id` por el mismo mecanismo. El refresh del token expirado sigue siendo responsabilidad del proxy (único punto que sí contacta al Auth server, solo cuando hace falta).

Trade-off aceptado y documentado: una sesión revocada permanece válida hasta la expiración del access token.

#### Scenario: Una request autenticada no contacta al Auth server

- **WHEN** un usuario con sesión válida y token no expirado navega o dispara una request de datos
- **THEN** la validación de sesión se resuelve localmente (verificación de firma del JWT)
- **AND** no se emite ningún request a `auth/v1/user` en ese camino

#### Scenario: Una sesión ausente o inválida sigue redirigiendo a login

- **WHEN** un usuario sin sesión válida intenta acceder a una ruta autenticada
- **THEN** el proxy lo redirige a login, igual que antes de este cambio

### Requirement: Ningún write bloquea el read path

Las operaciones de escritura lazy que hoy acompañan una carga de página (materialización de instancias recurrentes debidas) SHALL dispararse fuera del camino crítico de las queries de lectura: fire-and-forget al montar la ruta, sin que ninguna query de lectura espere su resultado. Cuando la operación reporta cambios (`created > 0`), el sistema SHALL invalidar las queries afectadas (pending recurrences, listado de movimientos) — o, en rutas server-rendered, refrescar la ruta (`router.refresh()`) — para que el dato nuevo aparezca sin reload.

#### Scenario: El listado no espera la generación de instancias

- **WHEN** el usuario hace un cold-load de `/transactions` con una recurrencia que tiene una instancia debida sin materializar
- **THEN** la query del listado de movimientos se dispara sin esperar a la generación
- **AND** la generación corre en paralelo como mutación independiente

#### Scenario: La instancia recién generada aparece sin reload

- **WHEN** la generación fire-and-forget materializa al menos una instancia nueva
- **THEN** las queries de pending recurrences (y las afectadas) se invalidan
- **AND** el bloque "A confirmar" muestra la instancia nueva sin que el usuario recargue

#### Scenario: El mount de /transactions/recurring no espera la generación de instancias

- **WHEN** el usuario hace un cold-load de `/transactions/recurring` con una recurrencia que tiene una instancia debida sin materializar
- **THEN** el `Promise.all` de lecturas del server component (recurrences, pending instances, accounts) se resuelve sin esperar a `generateDueRecurrenceInstances`
- **AND** la generación se dispara fire-and-forget al montar (client-side), como mutación independiente

#### Scenario: La instancia generada en /transactions/recurring aparece sin reload

- **WHEN** la generación fire-and-forget de `/transactions/recurring` materializa al menos una instancia nueva (`created > 0`)
- **THEN** la ruta se refresca (`router.refresh()`) y el bloque de pendientes muestra la instancia nueva sin que el usuario recargue
- **AND** cuando no se materializó nada (`created === 0`) no se dispara ningún refresh

### Requirement: Los reads costosos no críticos se difieren con cache de sesión

Los reads que computan resultados estables dentro de una sesión y no pertenecen al camino crítico del mount (la sugerencia de recurrencia, que escanea 6 meses de movimientos) SHALL configurarse con `staleTime` largo (≥ 30 minutos) para no recomputarse en cada navegación.

#### Scenario: La sugerencia no se recomputa al navegar

- **WHEN** el usuario navega fuera de `/transactions` y vuelve dentro de la ventana de frescura
- **THEN** la sugerencia de recurrencia se sirve desde el cache de TanStack sin re-ejecutar la detección

### Requirement: El read slice cross-dominio de cards vive en `@grana/cards`

Las query functions de lectura de tarjetas que otros consumers necesitan —tanto el slice cross-dominio (`@grana/accounts` vía `getAccounts` que embebe los resúmenes `credit`, y el guard de archivo de cuentas) como el **read layer de detalle** que la ruta de detalle de tarjeta consume en web y mobile— SHALL vivir en el paquete compartido `@grana/cards`, no en `apps/web/lib/`. El paquete SHALL exponer al menos:

- `getCreditCards` (agregador de resúmenes de tarjeta) y `getCreditCardDebtCheck` (guard de deuda), más los tipos de su retorno (`CreditCardSummary`, `CardPeriodWithPayment`, `PeriodVariant`, `CardPeriodAlert`).
- El read layer de detalle: `getCreditCardDetail`, `getCardPeriods`, `getCardPeriodDetail`, `getActiveInstallments`, `getCardNetworks` y `getCardPeriodTransactionCount`, más sus tipos de retorno (`CreditCardDetail`, `CardPeriodDetail`, `ActiveInstallment`, `ActiveInstallmentsResult`, `CardNetwork`).
- El builder puro del view-model de detalle (`resolveCardDetailState` y el tipo `CardDetailViewModel`), que deriva el ciclo de vida `apagar`/`curso`/`prox`, los días de ciclo/cierre/vencimiento, `committedARS` y las ramas de empty-state a partir de los reads anteriores, sin I/O.

Estas funciones de lectura SHALL ser client-agnósticas: reciben el client Supabase como primer parámetro y reciben `today: Date` inyectado por el caller (no invocan `getTodayAR()` internamente), de modo que web (browser/server client) y mobile (client nativo) puedan reutilizarlas sin cambios. El paquete NO SHALL importar `next/*`, declarar `'use server'`, crear un client Supabase, ni invocar `revalidatePath`.

La lógica pura subyacente (derivación de estado de período, variantes, aritmética monetaria, fecha AR, `classifyPeriodsLifecycle`) SHALL seguir viviendo en `@grana/money-logic` y los period helpers en `@grana/transactions-mutations`; `@grana/cards` los compone, no los duplica. El builder del view-model SHALL ser una función pura testeable sin DB.

El alcance ya NO se limita al slice cross-dominio: el read layer de detalle se mueve porque el segundo consumer (la ruta mobile de detalle de tarjeta) lo requiere. Lo que PUEDE permanecer en `apps/web/lib/cards/` es el **glue de read acoplado a plataforma** (wrappers thin que inyectan `getTodayAR()` y conservan la firma pública web + los query keys; orquestación de reads del Server Component) y las superficies aún sin segundo consumer. `apps/web` SHALL consumir el read layer extraído vía esos wrappers thin, conservando firma y query keys previos. El pane de movimientos del resumen (que proyecta a `FinancialMovement`, hoy web-only en transactions) queda fuera de este slice hasta que el view-model de movements se extraiga.

#### Scenario: `getCreditCards` es reutilizable desde mobile

- **WHEN** un consumer (web o mobile) necesita los resúmenes de tarjeta de crédito del usuario
- **THEN** invoca `getCreditCards` desde `@grana/cards` pasando su propio client Supabase y su `today`
- **AND** no importa nada de `apps/web/lib/` ni crea un client server-side

#### Scenario: El read layer de detalle es reutilizable desde mobile

- **WHEN** la ruta de detalle de tarjeta (web o mobile) necesita el detalle de la cuenta, sus períodos, el detalle de un período, las cuotas en curso o las networks
- **THEN** invoca `getCreditCardDetail` / `getCardPeriods` / `getCardPeriodDetail` / `getActiveInstallments` / `getCardNetworks` desde `@grana/cards` pasando su propio client y su `today`
- **AND** no re-implementa esos reads ni sus shapes en `apps/<app>/lib/`

#### Scenario: El view-model de detalle se deriva con una función pura compartida

- **WHEN** una ruta de detalle (web o mobile) ya cargó `cardDetail` + `periods` + `installments`
- **THEN** obtiene el estado de la pantalla invocando `resolveCardDetailState({ cardDetail, periods, installments, todayISO })` de `@grana/cards`
- **AND** recibe un discriminated union (`new-card` / `archived-empty` / `active` con su `CardDetailViewModel`) que ambas plataformas renderizan con su propia JSX
- **AND** ninguna plataforma re-deriva el ciclo `apagar`/`curso`/`prox` ni los días de ciclo/cierre/vencimiento a mano

#### Scenario: El wrapper web preserva la firma y los query keys

- **WHEN** una ruta web que hoy llama un read de tarjeta corre tras la extracción
- **THEN** consume un wrapper en `apps/web/lib/cards/queries.ts` que re-exporta desde `@grana/cards` inyectando `getTodayAR()`
- **AND** la firma pública web no cambia (no aparece `today` en el call site web)
- **AND** los query keys y su política de frescura se conservan

#### Scenario: La lógica pura no se duplica al extraer el slice

- **WHEN** `@grana/cards` deriva el estado de un período, clasifica el ciclo de vida o suma montos
- **THEN** importa esa lógica de `@grana/money-logic` / `@grana/transactions-mutations`
- **AND** no reimplementa `derivePeriodStatus`, `classifyPeriodsLifecycle`, variantes ni aritmética monetaria

#### Scenario: El glue de read acoplado a plataforma queda en la app

- **WHEN** se completa la extracción del read layer de detalle
- **THEN** los wrappers thin que inyectan `getTodayAR()`, la orquestación de reads del Server Component, la revalidación y la JSX siguen en `apps/web/`
- **AND** la extracción no rompe ni cambia el comportamiento de las vistas de `/cards` ni de `/cards/[id]`

### Requirement: La capa de datos del dominio accounts vive en `@grana/accounts`

La capa de datos de cuentas —reads, mutations, tipos y el cálculo de balance— SHALL vivir en el paquete compartido `@grana/accounts`, no en `apps/web/lib/accounts/` ni `apps/web/app/_actions/accounts.ts`. El paquete SHALL exponer los reads (`getAccounts`, `getCashAndBankAccounts`, `getAccountDetail`, `getInstitutions`), las mutations de cuenta y moneda, los tipos del dominio (`Account`, `AccountWithDetails`, `AccountWithBalances`, `Institution`, …) y `computeBalance`.

Las funciones del paquete SHALL ser client-agnósticas: los reads reciben el client Supabase como primer parámetro; las mutations reciben `{ supabase, userId, input, today }` con el `userId` ya verificado por el caller. El paquete NO SHALL importar `next/*`, declarar `'use server'`, crear un client Supabase, resolver autenticación, ni invocar `revalidatePath`. `apps/web` SHALL retener el platform shell: las server actions de cuentas son wrappers thin que resuelven `userId` (`getAuthenticatedUserId()`), crean el client, invocan el orquestador del paquete, mapean a `ActionResult` y llaman `revalidateAfterAccountMutation()`.

El resultado de las mutations (`AccountMutationResult`) SHALL ser neutro de plataforma: en caso de error expone `fieldErrors?`, `messageKey?`, `errorCode?` y `reason?`. Los mensajes de error de dominio SHALL viajar como `messageKey` — un path completo del catálogo `@grana/i18n-messages` (p. ej. `accounts.errors.deactivate_last_currency`) — y NO SHALL ser literales pre-traducidos ni el `error.message` crudo de Postgres. `errorCode` SHALL portar el código PG crudo (para mapeos como `23505 → duplicate`) y `reason` SHALL portar un slug estructurado que dispara UX (p. ej. `pending_debt`), independiente del texto. Cada plataforma SHALL resolver el `messageKey` y el `errorCode` con su propio motor de i18n (web vía `next-intl`, mobile vía su helper `useT`) contra el mismo catálogo compartido; el paquete NO SHALL asumir un motor ni un namespace de traducción.

`computeBalance` SHALL vivir en `@grana/accounts`, no en `@grana/money-logic`: está modelado alrededor del tipo `AccountWithDetails`, y money-logic permanece agnóstico de entidades de dominio (opera sobre rows anónimas). `@grana/accounts` compone el piso genérico de money-logic (`calculateTransactionSums`) con data account-shaped encima.

`@grana/accounts` SHALL depender hacia abajo de `@grana/cards` para los resúmenes de tarjeta que `getAccounts` embebe y para el guard de deuda de `archiveAccount` (opción A del análisis de boundary); la composición de balances NO SHALL empujarse al caller.

#### Scenario: Los reads y mutations de accounts son reutilizables desde mobile

- **WHEN** un consumer (web o mobile) necesita listar cuentas, leer el detalle de una, o crear/editar/archivar una cuenta
- **THEN** invoca las funciones de `@grana/accounts` pasando su propio client Supabase (y, en mutations, el `userId` verificado + `today`)
- **AND** no importa nada de `apps/web/lib/` ni `apps/web/app/_actions/`

#### Scenario: La server action web es un wrapper thin sobre el paquete

- **WHEN** el usuario crea, edita, archiva o elimina una cuenta desde web
- **THEN** la operación ejecuta una server action `'use server'` que resuelve `userId`, crea el client, invoca el orquestador de `@grana/accounts`, mapea a `ActionResult`, y conserva `revalidateAfterAccountMutation()`
- **AND** el comportamiento, los query keys y la invalidación de cache no cambian respecto de antes de la extracción

#### Scenario: Un error de dominio viaja como messageKey neutro

- **WHEN** una mutation de `@grana/accounts` falla por una regla de dominio (p. ej. desactivar la última moneda activa, o eliminar una cuenta con movimientos)
- **THEN** el resultado expone `messageKey` con un path completo del catálogo (`accounts.errors.deactivate_last_currency`, `accounts.errors.delete_has_transactions`)
- **AND** no expone un literal en español ni el `error.message` crudo de Postgres

#### Scenario: Cada plataforma traduce el mismo messageKey con su propio motor

- **WHEN** web y mobile reciben el mismo `AccountMutationResult` con `messageKey: 'accounts.errors.deactivate_non_zero_balance'`
- **THEN** web lo resuelve vía `next-intl` y mobile vía `useT`, ambos contra `@grana/i18n-messages`
- **AND** el texto renderizado en el locale activo es el mismo en ambas plataformas, sin que el paquete traduzca nada

#### Scenario: El texto de error y la semántica de UX viajan por canales distintos

- **WHEN** `archiveAccount` falla porque la tarjeta tiene deuda pendiente
- **THEN** el resultado expone `reason: 'pending_debt'` (slug estructurado que dispara UX) y `messageKey: 'accounts.errors.pending_debt'` (texto a traducir) por separado
- **AND** el consumer puede ramificar comportamiento por `reason` sin parsear el texto

#### Scenario: El refactor del contrato no cambia el output web

- **WHEN** el usuario dispara cualquiera de los flujos de error de cuentas en web después de la migración a `messageKey`
- **THEN** el mensaje mostrado en español es idéntico al que mostraba cuando el paquete devolvía el literal hardcodeado
- **AND** los `reason` slugs, los query keys y la invalidación de cache no cambian

#### Scenario: `computeBalance` no fuerza un acoplamiento hacia money-logic

- **WHEN** se calcula el balance de una cuenta a partir de `initial_balance + Σ transactions`
- **THEN** la función `computeBalance` vive en `@grana/accounts` y consume `calculateTransactionSums` de `@grana/money-logic`
- **AND** `@grana/money-logic` no importa el tipo `AccountWithDetails` ni ninguna entidad del dominio accounts

#### Scenario: `getAccounts` embebe los resúmenes credit vía `@grana/cards`

- **WHEN** un consumer invoca `getAccounts`
- **THEN** el resultado agrupa cash, bank y `credit: CreditCardSummary[]`, obteniendo los resúmenes de tarjeta desde `@grana/cards`
- **AND** la composición de balances no se delega al caller

### Requirement: El read slice account-scoped de transactions vive en `@grana/transactions`

Las query functions de lectura de transactions que el detalle de cuenta consume —la lista de movimientos por cuenta y los reintegros pendientes— SHALL vivir en el paquete compartido `@grana/transactions`, no en `apps/web/lib/`. El paquete SHALL exponer al menos `getAccountMovementsAscending` (historial ascendente en orden de cálculo) y `getPendingReimbursements` (reintegros sin recibir, opcionalmente filtrados por cuenta), más los tipos de su retorno (`Transaction`, `TransactionWithDetails`, `PendingReimbursementVM`).

Además del read slice, el paquete SHALL hospedar la **capa display-VM** de movimientos: el tipo `FinancialMovement` (la unión discriminada que representa una fila de movimiento para render — con sus sub-uniones e ítems `MovementReviewFlag`/`ReimbursementState`/`ReimbursementTarget`), el bridge puro `toMovementViewInput` (que adapta un `FinancialMovement` al `MovementViewInput` de `@grana/money-logic`), y `resolveTone` + el tipo `Tone` (kind + signo → tono). El mapeo a clases Tailwind (`toneToClass`) NO SHALL moverse: es render web y se queda en `apps/web/`; cada plataforma mapea `Tone` a su propio sistema de estilos.

El paquete SHALL además hospedar el **read del feed global de movimientos**, porque el segundo consumer que lo requería —la tab Movimientos de mobile— ya existe. Concretamente SHALL exponer: `getGlobalMovementsPage` y `getGlobalMovements` (lectura paginada del feed vía el RPC `get_movements_page`, con el patrón limit+1 lookahead y el mapeo a `FinancialMovement`), el mapper puro `toFinancialMovement` (`TransactionWithDetails` de 8 kinds → `FinancialMovement`) junto con `toInitialBalanceMovement`/`isInitialBalanceMovement`/`INITIAL_BALANCE_ID_PREFIX`, el contrato de filtros `MovementFilters` (más `DEFAULT_MOVEMENTS_LIMIT`/`MAX_MOVEMENTS_LIMIT`/`MOVEMENTS_LIMIT_STEP`, `monthOf`, `shiftMonth`, `movementMatchesText`, `MOVEMENT_TYPE_KEYS` y el re-export de `resolveMonthRange` de `@grana/dashboard`), y `hasAnyTransaction` (para distinguir el empty-state de bienvenida del de mes-vacío). Estos SHALL ser puros (mappers/contrato) o isomórficos (reads que reciben `supabase`), sin `next/*` ni `'use server'`.

Estas funciones SHALL ser client-agnósticas: reciben el client Supabase como primer parámetro, de modo que web (browser/server client) y mobile (client nativo) puedan reutilizarlas sin cambios. Por ser reads de historial, NO SHALL requerir un parámetro `today`. El paquete NO SHALL importar `next/*`, declarar `'use server'`, crear un client Supabase, ni invocar `revalidatePath`. La capa display-VM SHALL ser pura (sin I/O, sin JSX) y componer `resolveMovementView` de `@grana/money-logic`, sin duplicarlo.

El cálculo de saldo corriente (`computeRunningBalances`) SHALL seguir viviendo en `@grana/money-logic` (opera sobre rows anónimas en orden de cálculo); `@grana/transactions` provee el read y NO SHALL duplicar ese cálculo — el caller compone read + `computeRunningBalances` + saldos iniciales de la cuenta.

El alcance de esta extracción es **el slice account-scoped** (reads) + el **tipo `FinancialMovement` + sus bridges puros de vista** + el **read del feed global** (feed paginado, mapper de 8 kinds, contrato de filtros). Lo que PUEDE permanecer en `apps/web/lib/transactions/` son las superficies del feed **aún sin segundo consumer**: los reads del breakdown por categoría (`getMonthCategoryBreakdown`, `getMonth{Income,Subcategory}Breakdown`, `hasUsdAccount`), los filter options (`getMovementFilterOptions`), la máquina de estado de filtros acoplada a React web (`filters-state.ts`, `filters-context.tsx`), los pending blocks y la sugerencia de categoría — hasta que un consumer compartido (la barra de filtros / el breakdown de la tab Movimientos de mobile) los requiera. El mapper específico de tarjeta (`cardPeriodTransactionToMovement`, `installmentChip`) vive en `@grana/cards` (co-locado con `CardPeriodDetail`), importando `FinancialMovement` del package. `apps/web` SHALL consumir el slice + el feed extraídos vía re-exports thin, conservando la firma pública web y los query keys previos (`accountMovementsAscending`, `accountPendingReimbursements`, y los del feed global).

#### Scenario: `getAccountMovementsAscending` es reutilizable desde mobile

- **WHEN** un consumer (web o mobile) necesita la lista de movimientos de una cuenta para mostrar saldo corriente
- **THEN** invoca `getAccountMovementsAscending` desde `@grana/transactions` pasando su propio client Supabase y el `accountId`
- **AND** compone el resultado con `computeRunningBalances` de `@grana/money-logic` y los saldos iniciales de la cuenta
- **AND** no importa nada de `apps/web/lib/` ni crea un client server-side

#### Scenario: `getPendingReimbursements` es reutilizable desde mobile

- **WHEN** un consumer necesita los reintegros pendientes de una cuenta
- **THEN** invoca `getPendingReimbursements(supabase, accountId)` desde `@grana/transactions`
- **AND** obtiene los reintegros sin recibir ni cancelar, con la metadata del gasto vinculado stitched

#### Scenario: El tipo `FinancialMovement` y los bridges de vista son reutilizables desde mobile

- **WHEN** un consumer (el pane de movimientos de la tarjeta nativa, la tab Movimientos, o web) necesita renderizar filas de movimiento
- **THEN** importa el tipo `FinancialMovement` y `toMovementViewInput` / `resolveTone` desde `@grana/transactions`
- **AND** deriva la vista con `resolveMovementView(toMovementViewInput(m), perspective)` de `@grana/money-logic`
- **AND** no re-declara el tipo `FinancialMovement` ni la lógica de tono en `apps/<app>/lib/`

#### Scenario: El read del feed global es reutilizable desde mobile

- **WHEN** la tab Movimientos de mobile necesita el feed paginado de un mes
- **THEN** invoca `getGlobalMovementsPage(supabase, { limit, filters: { month } })` desde `@grana/transactions` pasando su propio client Supabase
- **AND** obtiene `{ movements, hasMore, nextLimit }` con las filas ya mapeadas a `FinancialMovement` vía `toFinancialMovement`
- **AND** navega el mes con `shiftMonth`/`monthOf` y distingue el empty-state con `hasAnyTransaction`, todos importados del package
- **AND** no importa nada de `apps/web/lib/` ni redeclara el mapper de 8 kinds ni el contrato `MovementFilters`

#### Scenario: El wrapper web preserva la firma y los query keys

- **WHEN** una ruta web que hoy llama `getAccountMovementsAscending`/`getPendingReimbursements`/`getGlobalMovementsPage` corre tras la extracción
- **THEN** consume un re-export en `apps/web/lib/transactions/{queries,movements,filters}.ts` desde `@grana/transactions`
- **AND** la firma pública web no cambia
- **AND** los query keys previos y su política de frescura se conservan
- **AND** el comportamiento de `/transactions` es idéntico (mismo RPC, mismo mapper, misma paginación)

#### Scenario: El cálculo de saldo corriente no se duplica al extraer el slice

- **WHEN** el detalle de cuenta calcula el saldo después de cada movimiento
- **THEN** importa `computeRunningBalances` de `@grana/money-logic`
- **AND** `@grana/transactions` no reimplementa ese cálculo

#### Scenario: Las superficies del feed sin segundo consumer siguen web-only

- **WHEN** se completa la extracción del read del feed global
- **THEN** el breakdown por categoría, los filter options, la máquina de estado de filtros (`filters-state.ts`), los pending blocks y la sugerencia de categoría siguen en `apps/web/lib/transactions/`, importando el contrato `MovementFilters` y el tipo `FinancialMovement` del package
- **AND** la extracción no rompe ni cambia el comportamiento de la ruta `/transactions`

