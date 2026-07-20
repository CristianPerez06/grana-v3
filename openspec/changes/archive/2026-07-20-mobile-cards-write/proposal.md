# Mobile: credit-card write flows (edit, archive, periods, pay statement)

## Why

Mobile Cards is **read-only past creation**. The native detail (`cards/[id]`)
renders the lifecycle overview but explicitly offers "no pay, no edit, no
register-purchase", and the nested period routes don't exist. A user can create
and browse a card on mobile but cannot **edit** it, **archive/reactivate** it,
browse its **periods**, open a **statement**, or **pay** one — the core reason a
credit card exists in the app.

This is the top of the web↔mobile parity sequence and — unusually — needs **no
shared-layer work**. Every mutator and read is already in `@grana/*`, because
the web card actions are themselves thin wrappers. So this is a pure
thin-consumer change: native screens + thin bindings in
`apps/mobile/lib/cards/mutations.ts`, following the `createCreditCard` binding
that already exists there.

## What Changes

One change covering the whole card write surface, mirroring web route-for-route
(pushed native screens; Cards is not a tab — it's reached from Menú):

- **Edit card** — name, issuer bank, credit limit, and the cycle dates
  (current + next statement close/due). Network is immutable (read-only chip).
  Offers archive; delete only when the card never had movements. Delegates to
  `updateCreditCard` (+ period-date edits) in `@grana/cards`.
- **Archive / reactivate** — a card *is* an account, so these delegate to
  `archiveAccount` / `reactivateAccount` (`@grana/accounts`), already bound in
  `apps/mobile/lib/accounts/mutations.ts`. Archive surfaces the server-side
  `pending_debt` guard as a block dialog.
- **Register-first-purchase entry** — the `new-card` state gains its CTA,
  deep-linking into the existing native movement form with the card
  preselected (the credit family already ships on mobile).
- **Periods list** — all statements of a card (`getCardPeriods`).
- **Statement (period) detail** — the period's movements + payment info, with
  edit-dates for an unpaid period (`updatePeriodDates`).
- **Pay statement** — the app's most intricate form: debit account (same-bank
  preselected), amount (defaulted to the pending total), payment date, optional
  stamp tax, FX rate (required only when the period has pending USD debt), and
  confirmation of the next period's dates. Delegates to `payCardPeriod`
  (`@grana/cards`) — all the tax/FX/next-period logic stays server-side.

## Impact

- Affected specs: `cards` — MODIFY the mobile read-only detail requirement to
  lift the "v1 read-only" restriction and correct its now-stale clauses
  (per-period rows are navigable since the native movement detail shipped; the
  nested routes are no longer out of scope); ADD mobile requirements for the
  edit/archive, periods/statement, and pay screens.
- Affected code: `apps/mobile` only — new screens under `app/(app)/cards/…`,
  new bindings + invalidation in `lib/cards/`. **No `@grana/*` package changes,
  no web changes, no migration.**
- Because nothing is extracted, the usual "web test suite stays green" safety
  net does not apply — correctness of the hard flows (pay: tax/FX/next-period)
  rests entirely on the already-tested shared `payCardPeriod`; mobile only
  assembles the payload and must not re-implement any of it.

## Out of scope

- **Undo/reverse a statement payment** — paid periods are terminal
  (`ON DELETE RESTRICT` on `period_payments`); reversal is its own future change.
  The pay UI must not imply reversibility.
- Any change to card **create** (already at parity) or to the shared mutators.
- The web edit **drawer** presentation is not copied literally; mobile uses its
  idiomatic surface (pushed screen or native drawer — settled in design).
