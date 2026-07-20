# Exploration brief — mobile cards lifecycle & pay-statement

_Status: not started. A thinking brief for `/openspec-explore`, not a task list._
_Guide item: §2 "Cards write flows" — the top of the recommended parity sequence. Self-contained, high value; the last big read-only surface on mobile that has no write affordances._

## Context

Mobile Cards is **read-only past creation**. Today mobile has: the card **list** (`cards/index`), **create** (`cards/new`), and a **read-only detail** (`cards/[id]`). The detail's own docblock says it plainly: _"no pay, no edit, no register-purchase. The per-period movements pane and the nested routes (/periods, statement detail) are deferred."_

Web has the full lifecycle: edit the card, archive/reactivate it, browse its periods, open a statement, and **pay a statement** — the app's single most intricate form (debit account + amount + optional stamp tax + FX rate + confirming next-period dates, all atomic).

## Current state — the punchline: **zero shared-layer work**

Every prior mobile gap (reimbursement, recurring, movement form) needed an *extraction* first — a web-local mutator pulled into `@grana/*`. **Cards needs none.** The entire data + logic layer is already shared, because the web card actions are themselves already thin wrappers over `@grana/*`. This is a **pure thin-consumer + native-UI** change.

**Mutators — all shared, all bound the same way `lib/cards/mutations.ts` already binds `createCreditCard`:**

| Mutator | Shared in | On mobile? |
|---|---|---|
| `createCreditCard` | `@grana/cards` | ✅ bound (`cards/new`) |
| `updateCreditCard` | `@grana/cards` | ❌ not bound |
| `payCardPeriod` | `@grana/cards` (`pay-card-period.ts`) | ❌ not bound |
| `updatePeriodDates` | `@grana/cards` | ❌ not bound |
| archive / reactivate | `@grana/accounts` (`archiveAccount`/`reactivateAccount`) | ✅ **already bound** in `lib/accounts/mutations.ts` — a card IS an account |
| `registerCardPurchase` / `registerInstallments` | `@grana/transactions-mutations` | ✅ **already on mobile** via the movement-form credit family |
| `updateInstallmentParent` / `deleteInstallmentParent` | `@grana/cards` | ✅ already on mobile (movement edit) |

**Reads — all shared** (`getCreditCardDetail`, `getCardPeriods`, `getCardPeriodDetail`, `getActiveInstallments`, `getCardNetworks`, `resolveCardDetailState`) and the mobile detail already consumes several. The pay form's extra reads are shared too: `getAccounts` (`@grana/accounts`) and the next-period projection `suggestNextPeriodDates` (`@grana/money-logic`).

**So the gap is 100% mobile UI + a handful of thin mutator bindings.** No package touched, no web test surface at risk (nice, but it also means the usual "468 tests stay green" safety net doesn't apply here — the proof is manual/native).

## The web surface to mirror

```
  /cards/[id]/edit                              edit card (drawer on web)
  /cards/[id]        · card-actions             archive / reactivate, register-first-purchase
  /cards/[id]/periods                           periods list
  /cards/[id]/periods/[periodId]                statement (period) detail / overview
  /cards/[id]/periods/[periodId]/pay            ★ PAY STATEMENT (the heavy one)
```

## The crux: the pay-statement form

`payCardPeriodSchema` payload — the most complex form in the app:

- `period_id`, `amount`, `payment_account_id` (**debit account** — cash/bank picker), `payment_date`
- `stamp_tax_amount` (ARS, optional) — 0/absent = no stamp; `>0` inserts a movement and, if the card had no alícuota, **derives & persists** it (amount ÷ base)
- `fx_rate_to_ars` (optional at schema level; **required `>0` when the period has pending USD debt** — the "USD subordinated" case)
- `next_end_date` + `next_due_date` — the statement being paid **announces** the next period's dates; the form confirms them and the action updates the (estimated) P(n+1) instead of creating P(n+2). Validated `next_due > next_end > paid-period end`.

The reassuring part: **every bit of that intricacy is server-side** in `payCardPeriod` (tax derivation, FX persistence, next-period update, atomicity). Mobile is pure form assembly — a debit-account picker (the shared `AccountSelectField`), money inputs, date fields, a conditional FX field gated on `period.pendingAmountUSD > 0`, and `suggestNextPeriodDates` to prefill the P(n+1) defaults. No new logic, no new math.

## Direction

Same thin-consumer shape as everything shipped so far — but **no extraction step**. Bind the shared mutators in `lib/cards/mutations.ts` (the `ActionResult`/`mapResult`/`errorKey` pattern is already there), then build native screens pushed from the card detail (Cards isn't a tab — it's pushed from Menú; nested screens push further, no native stack header, custom `PageHeader` per convention).

Because the surface spans 5 web routes and includes the app's hardest form, **this wants to be split** — like recurring's ③.1/③.2. A natural cut:

- **Slice A — Card lifecycle:** edit card + archive/reactivate (+ the register-first-purchase entry). Small and low-risk: archive/reactivate mutators are *already bound*, and edit-card mirrors the accounts edit form mobile already has. Mostly a form screen + two guarded actions on the detail header.
- **Slice B — Periods + pay:** periods list → statement detail → the pay form. The heavy slice; the pay form alone may justify being its own **Slice C** if B gets too big.

## Open questions

- **Slice count — 2 or 3?** A (lifecycle) + B (periods+pay), or A + B (periods read) + C (pay form) so the hardest form lands isolated. Recurring split at 2; Cards is bigger. Lean: start A, then decide B-vs-B/C once the periods read is in.
- **Route shape.** Mobile has no nested-layout tabs (unlike web's `(overview)`/`pay` segment groups). Flatten to pushed screens — `cards/[id]/edit`, `cards/[id]/periods`, `cards/[id]/periods/[periodId]`, `.../pay` — or collapse periods into the detail? Web keeps them as distinct routes; mirror unless the native detail can absorb the periods list inline.
- **Edit-card surface — drawer or pushed screen?** Web uses an `edit-card-drawer`. Mobile precedent is mixed: the recurrence edit used a `Drawer`, the movement edit used a pushed `edit.tsx` route. Pick one (drawer reads lighter for a short form).
- **Register-first-purchase entry.** Web's button deep-links into the purchase flow. On mobile the movement-form credit family already exists — so this is likely just a CTA that opens `/transactions/new` with the card **preselected**. Verify the form accepts a preselected credit account param; if not, that's a small form tweak, not a card change.
- **Per-period movements pane.** The read-only detail explicitly deferred it. Does Slice B pull it in (statement detail showing its movements), or stay deferred? Web's period overview shows them.
- **No 468-test safety net.** Unlike the extractions, nothing here is guarded by the web suite — the behavior-preservation proof doesn't apply. Call out that pay-statement correctness (tax/FX/next-period) rests entirely on the already-tested shared `payCardPeriod`; mobile must not re-implement any of it, only assemble the payload.
- **Undo payment stays deferred.** Paid statements are terminal (`ON DELETE RESTRICT` on `period_payments`); reversal is its own future change. Don't let the pay UI imply reversibility.

## Readiness summary

| Piece | State |
|---|---|
| All card mutators (`updateCreditCard`, `payCardPeriod`, `updatePeriodDates`) | ✅ shared |
| Archive / reactivate | ✅ shared **and already bound on mobile** (accounts) |
| Register purchase / installments | ✅ already on mobile (movement form) |
| Reads (`getCreditCardDetail`, `getCardPeriodDetail`, …) + `suggestNextPeriodDates` | ✅ shared |
| Mobile edit / periods / statement / **pay** screens | ❌ missing |
| Mobile mutator bindings for the above | ❌ missing (thin, follow `lib/cards/mutations.ts`) |
| i18n `cards.*` | mostly present (web uses it) — verify pay-form + periods copy |

Net: the **first pure thin-consumer gap** — no `@grana/*` extraction, no migration. Just native screens + thin bindings, best split into a lifecycle slice and a periods/pay slice (with the pay form as the one genuinely hard piece).
