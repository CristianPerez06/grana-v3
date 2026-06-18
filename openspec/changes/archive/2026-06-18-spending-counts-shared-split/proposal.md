## Why

"En qué se fue" cuenta el **monto completo** de los gastos compartidos y, vía la RLS cross-user del hogar (`is_shared = true AND is_household_member(...)`), incluye los compartidos **cargados por el otro miembro** — inflando el desglose con plata que no es de la usuaria. Confirmado en QA con datos reales (ver [[spending-accrual-and-lenses]]): una nafta YPF de **$101.994 cargada por la pareja** aparecía entera en Transporte, cuando a la usuaria solo le corresponden **$50.997** (50%).

El hogar funciona como una **cuenta corriente**: cada gasto compartido es de cada miembro **por su parte** (`shared_expense_split.amount_assigned`), no por el total. Es un modelo distinto al de reintegros (la usuaria lo señaló explícitamente). Bug pre-existente que el cambio devengado ([[spending-accrual-and-lenses]], `category-spending-accrual`) agranda al sumar también los compartidos en tarjeta — por eso se arregla antes de mergear.

## What Changes

- En el desglose por categoría (y en el drill por subcategoría), un gasto **compartido** cuenta solo la **parte de la usuaria** (`shared_expense_split.amount_assigned` para su `user_id`). Los movimientos **propios no compartidos** cuentan completos.
- Si la usuaria **no tiene split** en un compartido (0% / sin fila), ese movimiento **NO aparece** en su "En qué se fue" (es 100% del otro miembro).
- **Simétrico para gastos y reintegros compartidos** (un reintegro compartido también cuenta solo la parte de la usuaria), para no doble-contar con el neteo de reintegros.
- `getMonthIncomeBreakdown` no cambia: el ingreso no se comparte (`is_shared` solo aplica a gastos).

## Capabilities

### Modified Capabilities
- `spending-by-category`: el neto por categoría cuenta la **parte del miembro** para los movimientos compartidos (gastos y reintegros), no el total. Los compartidos sin parte propia no entran.

## Impact

- `packages/dashboard/src/queries.ts` — `getMonthCategoryBreakdown`: traer `id` + `is_shared` de gastos y reintegros; resolver la parte de la usuaria desde `shared_expense_split` (filtrando por su `user_id`, porque la RLS de splits expone a ambos miembros); usar la parte para compartidos.
- `apps/web/lib/transactions/queries.ts` — `getMonthSubcategoryBreakdown`: misma lógica (consistencia del drill).
- Necesita el `uid` de la usuaria (`supabase.auth.getUser()`), ya que la RLS de `shared_expense_split` (`members select household splits`) devuelve las filas de ambos.
- Sin migraciones.
