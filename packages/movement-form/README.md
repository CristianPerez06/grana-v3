# @grana/movement-form

The cross-platform state-and-handlers layer for the movement-creation form (the
hi-fi drawer on web and — eventually — the equivalent screen on mobile).

## What lives here

- **`useMovementForm(...)`** — React hook that owns ~28 fields of form state, the
  cascading setters (tab → eligible accounts → currency, etc.), the description-
  blur suggestion fetch, and the submit dispatcher (5 tabs × create/edit ×
  recurrence × reimbursement × shared splits).
- **`type Mutators`** — top-level exported contract listing every action the
  hook can call. Both web and mobile bind a `Mutators` object: web wires the
  Next server actions; mobile wires direct `@grana/supabase` calls + the
  shared orchestrators from `@grana/transactions-mutations`. Exported as a
  top-level type so any drift between platforms breaks compilation immediately.
- **`type MovementFormState`** — the shape `useMovementForm` returns. Stable
  surface for the JSX layer in each app.

## What does NOT live here

- **JSX / visual primitives.** The web `MovementForm` keeps its drawer chrome,
  field rows, and popovers; the mobile equivalent uses its idiomatic
  primitives. The hook returns state + handlers; the caller renders.
- **i18n.** Translation lookups stay platform-side. The hook surfaces error
  *keys* or raw error messages from the mutators; the caller translates.
- **Server actions.** Web's `_actions/*` and mobile's mutator implementations
  live in their respective apps. The hook only knows the `Mutators` interface.
- **Routing / navigation.** Success callbacks are platform side
  (`router.refresh()` on web, `router.replace()` on mobile).

## The Mutators contract

`Mutators` is **exported as a top-level type, not inferred** from a default
object — this is deliberate. If a new action enters the form's submit
dispatcher, the type grows; web and mobile both need to update their bindings
or compilation fails. That's the desired drift detector.

See `openspec/changes/redesign-movement-form-as-drawer/design.md` §
"Mutator interface drift" for the rationale.
