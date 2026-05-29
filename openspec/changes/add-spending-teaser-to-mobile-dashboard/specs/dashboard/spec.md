# Delta — La query de breakdown por categoría se comparte

## MODIFIED Requirements

### Requirement: Las queries y agregaciones del dashboard viven en un package compartido

Las queries de lectura del dashboard (`getDashboardHero`, `getUpcomingFortnight`, `getMonthBalanceSeries`, `hasUserMovements`, `getMonthCategoryBreakdown`) y las funciones puras de agregación (`aggregateHero`, `buildUpcomingFortnight`, `buildMonthBalanceSeries`) SHALL vivir en `packages/dashboard/` bajo el nombre `@grana/dashboard`. El package SHALL exponer su `src/index.ts` sin paso de build, siguiendo la convención del monorepo. El package SHALL ser RN-compatible: NO depende de `react`, `next`, APIs del DOM, ni APIs de Node específicas.

Todas esas queries SHALL recibir el cliente de Supabase por parámetro (client-injected), de modo que cada plataforma inyecte el suyo (server client en web, client mobile en mobile). En particular, `getMonthCategoryBreakdown(supabase, month)` SHALL netear los reintegros recibidos contra la categoría derivada de su gasto de origen y respetar el invariante "Off-ledger credit cards", reusando la matemática pura de `@grana/money-logic` (`computeCategoryNet`, `buildCategorySlices`); el package NO SHALL duplicar esa matemática.

Ambas apps (web y mobile) SHALL consumir esas queries y tipos desde `@grana/dashboard`. La app web NO SHALL retener copias locales de esos módulos: ni en `apps/web/lib/dashboard/`, ni la definición de `getMonthCategoryBreakdown` en `apps/web/lib/transactions/queries.ts` (que pasa a delegar en el package). El `getMonthSubcategoryBreakdown` (drill de subcategorías), usado solo por el desglose completo, PUEDE permanecer fuera del package hasta que el desglose completo aterrice en mobile.

#### Scenario: Web importa queries desde el package

- **WHEN** un componente del dashboard web necesita los saldos del Hero
- **THEN** el componente importa `getDashboardHero` desde `@grana/dashboard`
- **AND** NO importa desde `@/lib/dashboard/queries`

#### Scenario: Mobile importa queries desde el mismo package

- **WHEN** la pantalla del dashboard mobile necesita los saldos del Hero
- **THEN** el componente importa `getDashboardHero` desde `@grana/dashboard`
- **AND** la build de Metro resuelve el módulo sin errores

#### Scenario: El package no rompe la build de mobile por dependencias DOM

- **WHEN** se ejecuta `pnpm --filter mobile typecheck` y un build de Metro tras agregar un import desde `@grana/dashboard`
- **THEN** ningún archivo del package referencia APIs del DOM ni de Node específicas
- **AND** la build no reporta `Unable to resolve module` ni errores de tipo

#### Scenario: El breakdown por categoría se consume compartido desde ambas plataformas

- **WHEN** el teaser de categorías del dashboard necesita el breakdown del mes (web o mobile)
- **THEN** obtiene los datos vía `getMonthCategoryBreakdown(supabase, month)` desde `@grana/dashboard`
- **AND** la app web ya no define su propia copia en `apps/web/lib/transactions/queries.ts`
- **AND** ambas plataformas obtienen el mismo neto por categoría ante los mismos datos
