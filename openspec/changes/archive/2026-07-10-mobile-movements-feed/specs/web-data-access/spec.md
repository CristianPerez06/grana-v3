## MODIFIED Requirements

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
