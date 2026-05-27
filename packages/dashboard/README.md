# @grana/dashboard

Queries del dashboard + agregaciones puras. Provee los datos de las tres secciones del landing post-login: Hero "Para gastar", "Lo que viene" (próxima quincena) y "Balance del mes".

## Por qué este package existe

A diferencia del resto de packages, este **sí incluye queries de Supabase**: el dashboard es lectura agregada y multi-fuente (cuentas, períodos de tarjeta, recurrencias), y mantener esa orquestación en un solo lugar evita que web y mobile la reimplementen distinto. La factory tipada de `@grana/supabase` permite que las queries vivan acá sin acoplarse al wrapper de auth de cada app: reciben un `GranaSupabaseClient` ya construido.

Las agregaciones (`aggregate*`/`build*`) son **puras** y testeables sin DB; las queries solo cargan filas y delegan el cálculo en ellas y en `@grana/money-logic`.

## Qué exporta

| Capa | Exports |
|---|---|
| Queries (reciben un client) | `getDashboardHero`, `getUpcomingFortnight`, `getMonthBalanceSeries`, `hasUserMovements`. |
| Agregaciones puras | `aggregateHero`, `buildUpcomingFortnight`, `buildMonthBalanceSeries`, `calculateTransactionSums`. |
| Tipos | `DashboardHero`, `UpcomingFortnight`, `UpcomingItem`, `MonthBalanceSeries`, `MonthBalanceDay`, … |

## Reglas

- **Las queries reciben el client por parámetro**, no crean uno. Cada app le pasa su `GranaSupabaseClient`.
- **El cálculo va en las funciones puras**, no en las queries — así se testea sin DB y se reusa entre plataformas. La aritmética monetaria pasa por `@grana/money-logic`.
- **Tarjetas no vive en el dashboard:** el resumen de tarjetas vive en `/cards` (ver módulo `dashboard` en `CLAUDE.md`).

## Cómo se consume

```ts
import { getMonthBalanceSeries } from '@grana/dashboard'
const series = await getMonthBalanceSeries(supabase, year, month)
```
