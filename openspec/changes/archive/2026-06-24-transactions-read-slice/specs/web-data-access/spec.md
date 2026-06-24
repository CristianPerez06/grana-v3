## ADDED Requirements

### Requirement: El read slice account-scoped de transactions vive en `@grana/transactions`

Las query functions de lectura de transactions que el detalle de cuenta consume —la lista de movimientos por cuenta y los reintegros pendientes— SHALL vivir en el paquete compartido `@grana/transactions`, no en `apps/web/lib/`. El paquete SHALL exponer al menos `getAccountMovementsAscending` (historial ascendente en orden de cálculo) y `getPendingReimbursements` (reintegros sin recibir, opcionalmente filtrados por cuenta), más los tipos de su retorno (`Transaction`, `TransactionWithDetails`, `PendingReimbursementVM`).

Estas funciones SHALL ser client-agnósticas: reciben el client Supabase como primer parámetro, de modo que web (browser/server client) y mobile (client nativo) puedan reutilizarlas sin cambios. Por ser reads de historial, NO SHALL requerir un parámetro `today`. El paquete NO SHALL importar `next/*`, declarar `'use server'`, crear un client Supabase, ni invocar `revalidatePath`.

El cálculo de saldo corriente (`computeRunningBalances`) SHALL seguir viviendo en `@grana/money-logic` (opera sobre rows anónimas en orden de cálculo); `@grana/transactions` provee el read y NO SHALL duplicar ese cálculo — el caller compone read + `computeRunningBalances` + saldos iniciales de la cuenta.

El alcance de esta extracción es **el slice account-scoped** que el detalle de cuenta consume, no el dominio transactions completo: el feed global de movimientos (listado de `/transactions`, filtros, breakdown, filter options, pending blocks, sugerencia de categoría) PUEDE permanecer en `apps/web/lib/transactions/` hasta que un segundo consumer (la tab Movimientos de mobile) lo requiera. `apps/web` SHALL consumir el slice extraído vía re-exports thin, conservando la firma pública web y los query keys previos (`accountMovementsAscending`, `accountPendingReimbursements`).

#### Scenario: `getAccountMovementsAscending` es reutilizable desde mobile

- **WHEN** un consumer (web o mobile) necesita la lista de movimientos de una cuenta para mostrar saldo corriente
- **THEN** invoca `getAccountMovementsAscending` desde `@grana/transactions` pasando su propio client Supabase y el `accountId`
- **AND** compone el resultado con `computeRunningBalances` de `@grana/money-logic` y los saldos iniciales de la cuenta
- **AND** no importa nada de `apps/web/lib/` ni crea un client server-side

#### Scenario: `getPendingReimbursements` es reutilizable desde mobile

- **WHEN** un consumer necesita los reintegros pendientes de una cuenta
- **THEN** invoca `getPendingReimbursements(supabase, accountId)` desde `@grana/transactions`
- **AND** obtiene los reintegros sin recibir ni cancelar, con la metadata del gasto vinculado stitched

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

- **WHEN** se completa la extracción del slice
- **THEN** el listado de `/transactions`, los filtros, el breakdown, los filter options y los pending blocks siguen en `apps/web/lib/transactions/`
- **AND** la extracción no rompe ni cambia el comportamiento de la ruta `/transactions`
