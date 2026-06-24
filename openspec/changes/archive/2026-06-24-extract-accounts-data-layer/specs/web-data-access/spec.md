## ADDED Requirements

### Requirement: La capa de datos del dominio accounts vive en `@grana/accounts`

La capa de datos de cuentas —reads, mutations, tipos y el cálculo de balance— SHALL vivir en el paquete compartido `@grana/accounts`, no en `apps/web/lib/accounts/` ni `apps/web/app/_actions/accounts.ts`. El paquete SHALL exponer los reads (`getAccounts`, `getCashAndBankAccounts`, `getAccountDetail`, `getInstitutions`), las mutations de cuenta y moneda, los tipos del dominio (`Account`, `AccountWithDetails`, `AccountWithBalances`, `Institution`, …) y `computeBalance`.

Las funciones del paquete SHALL ser client-agnósticas: los reads reciben el client Supabase como primer parámetro; las mutations reciben `{ supabase, userId, input, today }` con el `userId` ya verificado por el caller. El paquete NO SHALL importar `next/*`, declarar `'use server'`, crear un client Supabase, resolver autenticación, ni invocar `revalidatePath`. `apps/web` SHALL retener el platform shell: las server actions de cuentas son wrappers thin que resuelven `userId` (`getAuthenticatedUserId()`), crean el client, invocan el orquestador del paquete, mapean a `ActionResult` y llaman `revalidateAfterAccountMutation()`.

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

#### Scenario: `computeBalance` no fuerza un acoplamiento hacia money-logic

- **WHEN** se calcula el balance de una cuenta a partir de `initial_balance + Σ transactions`
- **THEN** la función `computeBalance` vive en `@grana/accounts` y consume `calculateTransactionSums` de `@grana/money-logic`
- **AND** `@grana/money-logic` no importa el tipo `AccountWithDetails` ni ninguna entidad del dominio accounts

#### Scenario: `getAccounts` embebe los resúmenes credit vía `@grana/cards`

- **WHEN** un consumer invoca `getAccounts`
- **THEN** el resultado agrupa cash, bank y `credit: CreditCardSummary[]`, obteniendo los resúmenes de tarjeta desde `@grana/cards`
- **AND** la composición de balances no se delega al caller
