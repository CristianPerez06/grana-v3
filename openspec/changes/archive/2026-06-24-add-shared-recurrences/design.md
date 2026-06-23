## Context

Recurrencias (`0011_recurring_movements.sql`) y Compartido (`0023_shared.sql`) se
construyeron como módulos independientes. La tabla `recurrences` y `recurrence_instances`
no tienen ningún campo de hogar/split, y la cadena de generación + confirmación copia solo
campos unipersonales. El caso guía —alquiler 50/50 mensual— no se puede dejar recurrente.

Punto clave que reduce el alcance: **el alta de un gasto compartido ya está resuelta y es
reutilizable tal cual**. `createExpense` (`apps/web/app/_actions/transactions.ts`) acepta un
campo opcional `shared: { household_id, splits }` y llama a `applySharedSplits`
(`packages/transactions-mutations/src/internal/shared-splits.ts`), que marca la transacción
`is_shared` + `household_id` e inserta las filas de `shared_expense_split`. La deuda del
hogar se **deriva** de esas filas por moneda (`getHouseholdDebt`); no se persiste. No hay
contraasiento ni reintegro en el alta —eso es solo para revertir liquidaciones (mig `0044`).

La confirmación de una instancia recurrente ya pasa por `createExpense` vía
`mapInstanceToConfirmPlan` (`apps/web/lib/recurrences/mapper.ts`) +
`confirmRecurrenceInstance` (`apps/web/app/_actions/recurrences.ts`). El destino ya soporta
`shared`; lo que falta es que el dato llegue.

## Goals / Non-Goals

**Goals:**
- Una regla recurrente de gasto puede pertenecer a un hogar y llevar un split.
- El hogar y el split viajan regla → instancia → transacción, reutilizando el alta de gasto
  compartido existente sin tocar `applySharedSplits`.
- Base caja: la instancia pendiente no genera deuda ni impacta el gasto hasta confirmar.
- El modelo de datos soporta override de split por instancia desde el día uno.

**Non-Goals:**
- UI para editar el split de una instancia pendiente antes de confirmar (paso 2; el modelo
  ya lo soporta).
- Recurrencias compartidas de income o de compras con tarjeta.
- Deuda devengada/proyectada de instancias pendientes (change futuro, ver
  `[[spending-accrual-and-lenses]]`).
- Editar el estado compartido de una regla ya creada (es estructural).

## Decisions

### D1 — Split en dos niveles (template en la regla, snapshot en la instancia)

`recurrences.default_split` es el template; al generar, se copia a
`recurrence_instances.split`. Al confirmar, el split efectivo es `instance.split`.

**Por qué:** es exactamente el patrón que ya usa `amount` (la instancia copia
`rule.amount` al generar y es editable por instancia). Da tres niveles de flexibilidad sin
inventar mecánica nueva:
- regla fija 50/50 → `default_split` fluye sin tocar;
- "este mes 70/30" → editar `instance.split` antes de confirmar (modelo listo, UI = paso 2);
- ajuste en un movimiento puntual → editar la tx confirmada (ya soportado hoy).

**Alternativa descartada:** split solo en la regla. No permite override por mes, y el
usuario pidió explícitamente que el % pueda variar por mes y por movimiento.

### D2 — Almacenamiento jsonb, sin tabla nueva

`default_split` y `split` son columnas `jsonb` con forma `[{ user_id, percentage }]`.

**Por qué:** `household.default_split` ya es jsonb sin tabla ni FK; es el precedente
consagrado del repo. Para un hogar de dos (y aun de 3+ a futuro), el array escala. Una
tabla `recurrence_splits` con RLS y cascada propias es sobre-ingeniería para este alcance.

**Alternativa descartada:** tabla `recurrence_splits` espejo de `shared_expense_split`. Más
relacional pero sin beneficio real acá; agrega superficie de RLS y migración.

### D3 — Caja, no devengado

La instancia pendiente compartida no genera deuda ni impacta el gasto. La deuda nace al
confirmar, cuando se escriben las filas de `shared_expense_split`.

**Por qué:** es idéntico al comportamiento unipersonal actual del hub de recurrencias
(nada impacta hasta confirmar) y no toca la derivación de deuda (`getHouseholdDebt` sigue
leyendo solo splits reales). El devengado proyectado es un salto grande que merece su
propio change.

### D4 — Estado compartido estructural (fijo al alta)

El toggle compartir + el split se definen al crear la regla y no aparecen en el edit
drawer.

**Por qué:** el edit drawer ya congela cuenta/categoría/tipo por diseño
(`recurrence-detail-rework`). Mantener compartido en ese mismo set evita reescribir splits
de instancias ya generadas y mantiene el drawer simple. Cambiar de individual a compartido
= crear una regla nueva.

### D5 — Confirmación: el mapper emite `shared`, el destino no cambia

`mapInstanceToConfirmPlan` agrega `shared: { household_id, splits }` al `CreateExpenseInput`
cuando `instance.household_id` está presente, tomando `splits` de `instance.split`.
`createExpense` y `applySharedSplits` se reutilizan sin cambios.

**Por qué:** concentra el cambio de confirmación en una sola función pura (el mapper) y deja
intacto el alta de gasto compartido ya probado.

### D6 — Guard en `leaveHousehold`

`leaveHousehold` suma un chequeo: si existe una regla recurrente activa con `household_id`,
bloquea la salida (consistente con los chequeos existentes de deuda viva y liquidaciones
pendientes), pidiendo pausar o eliminar la regla primero.

**Por qué:** no tomar decisiones silenciosas sobre plata recurrente; mismo criterio
honesto que ya aplica `leaveHousehold` a la deuda.

## Risks / Trade-offs

- **Split desincronizado del hogar** (un miembro se va, el `user_id` del split ya no es
  miembro) → mitigado por D6: no se puede salir con regla compartida viva, así que el split
  de la regla siempre referencia miembros vigentes mientras la regla exista.
- **jsonb sin FK valida poco a nivel DB** → la validación de que los `user_id` son miembros
  y los % suman 100 vive en TS (schema `sharedExpenseSchema` reutilizado), igual que hoy
  para el alta de gasto compartido manual. Aceptamos el mismo nivel de garantía que el
  módulo ya tiene.
- **Instancias ya generadas antes de la migración** → no tienen `household_id`/`split`
  (quedan individuales); las columnas son nullable, así que la migración es aditiva y no
  rompe datos existentes. Backfill no necesario.
- **Override por instancia sin UI** → el campo `split` existe pero no se puede editar desde
  la UI en esta fase; el usuario que necesite "este mes distinto" lo ajusta editando la tx
  ya confirmada. Documentado como limitación de fase 1.

## Migration Plan

1. Nueva migración aditiva: `ALTER TABLE recurrences ADD household_id uuid null references
   household(id) on delete set null, ADD default_split jsonb null`; `ALTER TABLE
   recurrence_instances ADD household_id uuid null references household(id) on delete set
   null, ADD split jsonb null`. Regenerar tipos (`supabase gen types`, proyecto
   `[[supabase-project-id]]`).
2. Validación: agregar `shared` opcional al schema de recurrencia de gasto.
3. Generación: propagar `household_id` + `default_split` → `split`.
4. Confirmación: el mapper emite `shared`.
5. UI: toggle + editor de split en el alta (solo expense, hogar de dos).
6. Guard en `leaveHousehold`.

**Rollback:** las columnas son nullable y aditivas; revertir = drop de columnas (sin datos
que migrar de vuelta porque las reglas previas nunca fueron compartidas).

## Open Questions

- ¿El guard de `leaveHousehold` debería ofrecer un atajo "pausar todas mis reglas
  compartidas y salir", o alcanza con el mensaje de bloqueo? (Propuesta: solo bloqueo en
  fase 1.)
