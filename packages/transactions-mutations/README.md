# @grana/transactions-mutations

Orquestadores de mutaciones de transactions que requieren **rollback de varias fases** o **fan-out de filas derivadas con invariantes cruzadas**, compartidos entre `apps/web` y `apps/mobile`.

## Qué entra acá

Solo las mutaciones que duelen si se desincronizan:

- **`registerInstallments`** — split de monto, N períodos via `getOrCreatePeriodForDate`, guard de backdating, insert PARENT off-ledger, insert N CHILDREN con rollback, `applySharedSplits` con rollback adicional.
- **`registerCardPurchase`** — versión 1-cuota con la misma topología (parent + 1 child).
- **`createRecurrenceFromMovement`** — alta de recurrencia derivada de un movimiento existente.

Las mutaciones "thin" (createIncome/Expense/Transfer/Adjustment/Exchange, updateX, etc.) **NO viven acá**: son shells de ~30–50 líneas que cada plataforma escribe sobre `@grana/supabase` directamente.

## Qué NO entra

- **Auth / `userId` lookup.** Los orquestadores reciben el `userId` ya verificado por el caller (web server actions o mobile auth context).
- **Cache invalidation.** `revalidatePath` (Next) es web-only; mobile usa TanStack Query invalidation. El caller lo aporta después de la mutación.
- **React, Next, fetch.** Solo `@supabase/supabase-js` + `@grana/money-logic` + `@grana/validation`.

## Patrón de uso

```ts
// Web server action (shell)
'use server'
import { registerInstallments } from '@grana/transactions-mutations'

export async function registerInstallmentsAction(input: unknown) {
  const validation = await validateActionInput(registerInstallmentsSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const result = await registerInstallments({ supabase, userId, input: validation.data })

  if (result.ok) {
    revalidatePath('/cards')
    revalidatePath('/transactions')
    revalidatePath('/shared')
  }
  return result
}
```

```ts
// Mobile (client)
import { registerInstallments } from '@grana/transactions-mutations'
import { supabase } from '@/lib/supabase'

const result = await registerInstallments({ supabase, userId, input })
if (result.ok) queryClient.invalidateQueries(...)
```

## Por qué este package existe

Las mutaciones thin pueden duplicarse sin riesgo (30 LoC, una sola tabla). Estas no: cada una tiene 2–3 fases con rollback y orquesta varias filas o varias tablas. Re-implementarlas en mobile es deuda silenciosa que se desincroniza con la primera regla de negocio nueva.

Ver `openspec/changes/redesign-movement-form-as-drawer/design.md` § "Por qué dos niveles de mutaciones, no uno".
