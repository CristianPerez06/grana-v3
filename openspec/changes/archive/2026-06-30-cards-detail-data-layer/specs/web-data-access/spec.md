## MODIFIED Requirements

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
