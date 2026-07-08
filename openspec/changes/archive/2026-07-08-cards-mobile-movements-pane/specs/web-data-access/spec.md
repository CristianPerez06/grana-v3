## MODIFIED Requirements

### Requirement: El read slice account-scoped de transactions vive en `@grana/transactions`

Las query functions de lectura de transactions que el detalle de cuenta consume —la lista de movimientos por cuenta y los reintegros pendientes— SHALL vivir en el paquete compartido `@grana/transactions`, no en `apps/web/lib/`. El paquete SHALL exponer al menos `getAccountMovementsAscending` (historial ascendente en orden de cálculo) y `getPendingReimbursements` (reintegros sin recibir, opcionalmente filtrados por cuenta), más los tipos de su retorno (`Transaction`, `TransactionWithDetails`, `PendingReimbursementVM`).

Además del read slice, el paquete SHALL hospedar la **capa display-VM** de movimientos que un segundo consumer compartido requiere: el tipo `FinancialMovement` (la unión discriminada que representa una fila de movimiento para render — con sus sub-uniones e ítems `MovementReviewFlag`/`ReimbursementState`/`ReimbursementTarget`), el bridge puro `toMovementViewInput` (que adapta un `FinancialMovement` al `MovementViewInput` de `@grana/money-logic`), y `resolveTone` + el tipo `Tone` (kind + signo → tono). El mapeo a clases Tailwind (`toneToClass`) NO SHALL moverse: es render web y se queda en `apps/web/`; cada plataforma mapea `Tone` a su propio sistema de estilos.

Estas funciones SHALL ser client-agnósticas: reciben el client Supabase como primer parámetro, de modo que web (browser/server client) y mobile (client nativo) puedan reutilizarlas sin cambios. Por ser reads de historial, NO SHALL requerir un parámetro `today`. El paquete NO SHALL importar `next/*`, declarar `'use server'`, crear un client Supabase, ni invocar `revalidatePath`. La capa display-VM SHALL ser pura (sin I/O, sin JSX) y componer `resolveMovementView` de `@grana/money-logic`, sin duplicarlo.

El cálculo de saldo corriente (`computeRunningBalances`) SHALL seguir viviendo en `@grana/money-logic` (opera sobre rows anónimas en orden de cálculo); `@grana/transactions` provee el read y NO SHALL duplicar ese cálculo — el caller compone read + `computeRunningBalances` + saldos iniciales de la cuenta.

El alcance de esta extracción es **el slice account-scoped** (reads) más el **tipo `FinancialMovement` + sus bridges puros de vista**, que el detalle de cuenta y el pane de movimientos de la tarjeta nativa consumen. Lo que PUEDE permanecer en `apps/web/lib/transactions/` es el resto del feed global —los mappers de fila desde la DB (`toFinancialMovement` de 8 kinds, `toInitialBalanceMovement`), el listado de `/transactions`, filtros, breakdown, filter options, pending blocks, sugerencia de categoría— hasta que un segundo consumer (la tab Movimientos de mobile) lo requiera. Esos mappers SHALL importar el tipo `FinancialMovement` desde `@grana/transactions`. El mapper específico de tarjeta (`cardPeriodTransactionToMovement`, `installmentChip`) vive en `@grana/cards` (co-locado con `CardPeriodDetail`), importando `FinancialMovement` del package. `apps/web` SHALL consumir el slice extraído vía re-exports thin, conservando la firma pública web y los query keys previos (`accountMovementsAscending`, `accountPendingReimbursements`).

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

- **WHEN** un consumer (el pane de movimientos de la tarjeta nativa, o web) necesita renderizar filas de movimiento
- **THEN** importa el tipo `FinancialMovement` y `toMovementViewInput` / `resolveTone` desde `@grana/transactions`
- **AND** deriva la vista con `resolveMovementView(toMovementViewInput(m), perspective)` de `@grana/money-logic`
- **AND** no re-declara el tipo `FinancialMovement` ni la lógica de tono en `apps/<app>/lib/`

#### Scenario: El wrapper web preserva la firma y los query keys

- **WHEN** una ruta web que hoy llama `getAccountMovementsAscending`/`getPendingReimbursements` corre tras la extracción
- **THEN** consume un re-export en `apps/web/lib/transactions/queries.ts` desde `@grana/transactions`
- **AND** la firma pública web no cambia
- **AND** los query keys `accountMovementsAscending` y `accountPendingReimbursements` y su política de frescura se conservan

#### Scenario: El cálculo de saldo corriente no se duplica al extraer el slice

- **WHEN** el detalle de cuenta calcula el saldo después de cada movimiento
- **THEN** importa `computeRunningBalances` de `@grana/money-logic`
- **AND** `@grana/transactions` no reimplementa ese cálculo

#### Scenario: El feed global de transactions no se mueve todavía

- **WHEN** se completa la extracción del slice + la capa display-VM
- **THEN** los mappers globales (`toFinancialMovement`, `toInitialBalanceMovement`), el listado de `/transactions`, los filtros, el breakdown, los filter options y los pending blocks siguen en `apps/web/lib/transactions/`, importando el tipo `FinancialMovement` del package
- **AND** la extracción no rompe ni cambia el comportamiento de la ruta `/transactions`
