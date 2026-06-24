## ADDED Requirements

### Requirement: El read slice cross-dominio de cards vive en `@grana/cards`

Las query functions de lectura de tarjetas que otros dominios consumen (hoy: `@grana/accounts`, vía `getAccounts` que embebe los resúmenes `credit`, y el guard de archivo de cuentas) SHALL vivir en el paquete compartido `@grana/cards`, no en `apps/web/lib/`. El paquete SHALL exponer al menos `getCreditCards` (agregador de resúmenes de tarjeta) y `getCreditCardDebtCheck` (guard de deuda), más los tipos de su retorno (`CreditCardSummary`, `CardPeriodWithPayment`, `PeriodVariant`, `CardPeriodAlert`).

Estas funciones SHALL ser client-agnósticas: reciben el client Supabase como primer parámetro y reciben `today: Date` inyectado por el caller (no invocan `getTodayAR()` internamente), de modo que web (browser/server client) y mobile (client nativo) puedan reutilizarlas sin cambios. El paquete NO SHALL importar `next/*`, declarar `'use server'`, crear un client Supabase, ni invocar `revalidatePath`.

La lógica pura subyacente (derivación de estado de período, variantes, aritmética monetaria, fecha AR) SHALL seguir viviendo en `@grana/money-logic` y los period helpers en `@grana/transactions-mutations`; `@grana/cards` los compone, no los duplica.

El alcance de esta extracción es **el slice consumido cross-dominio**, no el dominio cards completo: el resto del read layer de tarjetas (detalle de período, wallet hero mensual, pagos, cuotas en curso, vistas de `/cards`) PUEDE permanecer en `apps/web/lib/cards/` hasta que un segundo consumer (mobile) lo requiera. `apps/web` SHALL consumir el slice extraído vía wrappers thin que inyectan `getTodayAR()`, conservando la firma pública web y los query keys previos.

#### Scenario: `getCreditCards` es reutilizable desde mobile

- **WHEN** un consumer (web o mobile) necesita los resúmenes de tarjeta de crédito del usuario
- **THEN** invoca `getCreditCards` desde `@grana/cards` pasando su propio client Supabase y su `today`
- **AND** no importa nada de `apps/web/lib/` ni crea un client server-side

#### Scenario: El wrapper web preserva la firma y los query keys

- **WHEN** una ruta web que hoy llama `getCreditCards`/`getCreditCardDebtCheck` corre tras la extracción
- **THEN** consume un wrapper en `apps/web/lib/cards/queries.ts` que re-exporta desde `@grana/cards` inyectando `getTodayAR()`
- **AND** la firma pública web no cambia (no aparece `today` en el call site web)
- **AND** el query key `accountsList` y su política de frescura se conservan

#### Scenario: La lógica pura no se duplica al extraer el slice

- **WHEN** `@grana/cards` deriva el estado de un período o suma montos
- **THEN** importa esa lógica de `@grana/money-logic` / `@grana/transactions-mutations`
- **AND** no reimplementa `derivePeriodStatus`, variantes ni aritmética monetaria

#### Scenario: El resto del read layer de cards no se mueve todavía

- **WHEN** se completa la extracción del slice
- **THEN** el detalle de período, el wallet hero mensual, los pagos y las cuotas en curso siguen en `apps/web/lib/cards/`
- **AND** la extracción no rompe ni cambia el comportamiento de las vistas de `/cards`
