# Design — mobile-recurring-form (③.2)

## Contexto

③.1 dejó el hub de recurrencias nativo **manage-only** y la capa de datos de escritura **ya extraída** a `@grana/recurrences`:

- `createRecurrence(supabase, userId, input, household)` — crea la regla y **materializa perezosamente la primera instancia vencida** (start_date hoy/pasado) como **pendiente** (no un movimiento confirmado). Valida con `createIncome/Expense/TransferRecurrenceSchema`.
- `updateRecurrence(supabase, userId, id, patch)` — valida con `updateRecurrenceSchema`.

Los primitivos de UI que un form necesita **ya existen** como componentes reusables en `apps/mobile/components/ui/`: `SelectField` + `SelectSheet` (pickers), `MoneyAmountInput`, `Segmented`, `Switch`, `DateField`, `AccountAvatar`, `Drawer`. `MovementForm` los **compone** — no define pickers inline.

## Decisión 1 — Form dedicado (Option C), no reuso de `MovementForm` (Option B)

**Se elige C: un `RecurrenceForm` nativo dedicado.**

Se evaluó reusar `MovementForm` en un `mode="recurrence"` (B). El submit del alta de movimiento es *crear-movimiento-primero, luego adjuntar*:

```
submitCreate:  createIncome/Expense/Transfer(...) → createdId
               └─ if isRecurrent: createRecurrenceFromMovement({ transaction_id: createdId, ... })
```

La creación de regla-sólo es una forma distinta: sin movimiento, `createRecurrence(payload)` directo. Reusar `MovementForm` exigiría un **submit path paralelo** forkeado a través de un componente de 1120 líneas + el hook compartido, un **mutator nuevo** que el hook no tiene, **gating** de tabs/campos (ocultar ajuste/cambio/cuotas/reintegro, forzar "Repetir"), un **campo nuevo** (`max_occurrences`) y re-semantizar `date`→`start_date` — todo **sobre el hot path del alta**, la pantalla más usada.

El único ahorro de B sería "no reconstruir los pickers", pero **los pickers ya son primitivos compartidos** — `MovementForm` no tiene un stack de pickers propio que duplicar. C compone los mismos primitivos, sin acoplar la creación de regla al alta de movimiento.

| | B — mode en MovementForm | **C — RecurrenceForm dedicado** |
|---|---|---|
| Código de pickers | reusa | **también reusa** (mismos primitivos) |
| Riesgo hot-path alta | sí (forkea la pantalla más usada) | ninguno (aislado) |
| Mutator nuevo + gating | en hook + comp de 1120 líneas | en su propio form chico |
| Set de campos | superset del alta (hay que ocultar) | exactamente el de recurrencia |
| Espejo de la web | no | **sí** (web es C: modal ⟂ Repetir) |

La web valida C: tiene el `CreateRecurrenceModal` **separado** del "Repetir" del form de movimiento, a propósito.

## Decisión 2 — Create y Edit son forms separados

Espejo de la web (modal de creación vs drawer de edición) y del modelo de datos:

- **Create** (`RecurrenceForm`): set completo. La instancia se genera como snapshot de la regla, así que la creación fija cuenta/categoría/tipo.
- **Edit** (`RecurrenceEditForm`): sólo el **subconjunto mutable** — `amount`, `frequency`, `end_date`, `description`. Cuenta/categoría/tipo **no** se editan (cambiarlos rompería la semántica de snapshot de las instancias ya generadas). `frequency` en edición ofrece sólo los **presets** (weekly/biweekly/monthly/annual), sin `custom` — paridad exacta con el drawer web.

No se comparte un componente entre ambos: sets de campos distintos, mantener cada uno simple > DRY forzado.

## Decisión 3 — Superficies de entrada

- **Create**: icon-button "+" en el header del **hub** (`recurring/index.tsx`) → `router.push('/transactions/recurring/new')` (pantalla pushed, patrón de `transactions/new.tsx`).
- **Edit**: icon-button Editar (pencil) en el header del **detalle** (`recurring/[id].tsx`) → abre `RecurrenceEditForm` en un **`Drawer`** (bottom sheet), montado en la misma pantalla; al guardar refetchea el detalle (espejo del drawer web, más liviano que una ruta pushed para 4 campos).

## Decisión 4 — Mutators mobile (thin)

Se agregan a `apps/mobile/lib/recurrences/mutators.ts`, en el mismo patrón que los existentes (auth vía `supabase.auth.getUser`, delegación, localización):

```ts
createRecurrence(input, t):
  userId = currentUserId()                        // authError si falta
  household = await getHousehold()                 // lib/shared/queries
  rec = household ? { id: household.id, members: household.members.map(m => ({ userId: m.userId })) } : null
  return localizeForm(await createRecurrenceImpl(supabase, userId, input, rec), t)

updateRecurrence(id, patch, t):
  userId = currentUserId()
  return localizeForm(await updateRecurrenceImpl(supabase, userId, id, patch), t)
```

- **`getHousehold` → `RecurrenceHousehold`**: el package espera `{ id; members: { userId }[] } | null`. El `Household` mobile ya trae `id` y `members[].userId` (ordenado con el usuario primero) — mapeo directo.
- **Localización de errores de form**: a diferencia de los mutators de ciclo de vida (que degradan a genérico), create/update devuelven `fieldErrors`/`formError` de validación. El form **pre-valida** los casos comunes client-side (monto > 0, categoría/destino requeridos, fin ≥ inicio) para copy locale-consistente; el mutator surface-a el `formError` del package si viene, con fallback al error genérico de recurrencia. Sin field-level highlighting en esta slice (form-level, como el resto de los forms nativos).
- **Firma**: `createRecurrence(input: unknown, t)` / `updateRecurrence(id, patch: unknown, t)` con `input`/`patch` tipados como `unknown` (el package valida), igual que `acceptRecurrenceSuggestion`.

## Decisión 5 — Invalidación de cache

- **Create**: `invalidateAfterRecurrenceMutation` (invalida `['recurrences']`) alcanza — cubre el hub y el bloque de **pendientes** del feed (`['recurrences','pending']`). No se crea movimiento ni se tocan saldos/dashboard, así que no hace falta la invalidación amplia de confirm.
- **Edit**: `invalidateAfterRecurrenceMutation` — refresca el detalle (`['recurrences','detail',id]`) y el hub.

## Set de campos del create form

| Campo | Tipo | Notas |
|---|---|---|
| movement_type | `Segmented` income/expense/transfer | sin ajuste/cambio/cuotas |
| account_id | `SelectSheet` | elegibilidad: transfer/income excluyen crédito; expense incluye |
| currency_code | cycle | sólo si la cuenta tiene 2 monedas activas |
| amount | `MoneyAmountInput` | `parseMoneyInput`, > 0 |
| category_id / subcategory_id | `SelectSheet` | income/expense; filtrado por tipo |
| transfer_destination_account_id | `SelectSheet` | transfer; ≠ origen, no crédito |
| description | `Input` | opcional |
| start_date | `DateField` | default hoy (`getTodayAR`) |
| frequency | `Segmented` | weekly/biweekly/monthly/annual/custom |
| interval_count / interval_unit | `Input` + `Segmented` | sólo si `custom` |
| end_date | `DateField` tras `Switch` | opcional; ≥ start_date |
| max_occurrences | `Input` numérico | opcional |
| shared (household_id + splits) | `Switch` + split | gasto + hogar de 2; template seed |

El payload se arma como el `handleSubmit` web (spread condicional por tipo + `shared`) y se pasa tal cual a `createRecurrence` (el package valida y castea).

## Riesgos

- **Elegibilidad de cuenta / cambio de moneda / split**: replicar la lógica ya probada de `MovementForm` (misma app, mismos helpers) reduce el riesgo; se extraen a helpers puros si conviene, sin nueva abstracción cross-platform.
- **Drift con la web**: create y edit reusan el catálogo i18n compartido y el mismo package de datos; la única superficie propia es el layout nativo.
