## MODIFIED Requirements

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
