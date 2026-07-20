# Tasks — mobile credit-card write flows

## 1. Mutator bindings + invalidation (`apps/mobile/lib/cards/`)

- [x] 1.1 Add `updateCreditCard(queryClient, id, input)` to
      `lib/cards/mutations.ts` — delegate to `@grana/cards` `updateCreditCard`
      (`{ name?, institution_id?, credit_limit? }`), `mapResult`, invalidate.
- [x] 1.2 Add `updatePeriodDates(queryClient, periodId, input)` — delegate to
      `@grana/cards` `updatePeriodDates` (`{ end_date, due_date }`).
- [x] 1.3 Add `payCardPeriod(queryClient, input)` — delegate to `@grana/cards`
      `payCardPeriod` (full `PayCardPeriodInput` + `today`); on success invalidate
      `cards` + `transactions` + `accounts` + `dashboard`.
- [x] 1.4 Add `archiveCard(queryClient, id)` / `reactivateCard(queryClient, id)` /
      `deleteCard(queryClient, id)` — delegate to the shared `archiveAccount` /
      `reactivateAccount` / `deleteAccount` (already used by
      `lib/accounts/mutations.ts`). `archiveCard` MUST surface the typed
      `pending_debt` reason distinctly so the detail can show the block dialog.
- [x] 1.5 Extend `lib/cards/invalidation.ts` if needed so a pay/period-date change
      refreshes the feed + balances + dashboard, not just card queries.

## 2. Route restructure + detail becomes write hub

- [x] 2.1 Convert `app/(app)/cards/[id].tsx` → `app/(app)/cards/[id]/index.tsx`
      (no behavior change), so nested routes can mount (mirror of the C.2 movement
      detail restructure).
- [x] 2.2 In the detail: add the header **Editar** action → `cards/[id]/edit`;
      turn the "a pagar" component into a **Pay CTA** → the statement's `pay`
      route; add a link into the **periods list**; make the period-pane rows
      **navigable** to `/transactions/[txId]` (native detail exists since C.1).
- [x] 2.3 `new-card` state: add the **register-first-purchase** CTA →
      `/transactions/new` with the card preselected. `archived-empty`: add
      **reactivate**.

## 3. Edit card screen (`cards/[id]/edit.tsx`)

- [x] 3.1 Build the pushed edit screen: live preview + fields in web order —
      **Nombre**, **Banco** (institution picker), **Red** (read-only chip w/ lock),
      **Ciclo** (current + next close/due, each gated on the period existing,
      "estimada" mark), **Límite** (optional, > 0, live % bar).
- [x] 3.2 Submit: `updateCreditCard` for name/bank/limit, then `updatePeriodDates`
      **current-then-next, only changed dates**; validation mirrors web
      (name 1–50, limit > 0, due > close, next close > current close, next due >
      next close). Save disabled until dirty; discard-confirm on back with changes.
- [x] 3.3 Footer actions: **Archivar** (→ `archiveCard`; on `pending_debt` show the
      block dialog with `cards.deactivate_block.*`) + **Eliminar** (→ `deleteCard`,
      disabled with explanatory copy when the card has movements).

## 4. Periods list + statement detail

- [x] 4.1 `cards/[id]/periods/index.tsx` — list rows from `getCardPeriods`: date
      range · status pill (`futuro`/`actual`/`cerrado_esperando_pago`/`vencido`/
      `pagado`) · "estimada" badge · due line · ARS amount (+ USD when present).
- [x] 4.2 `cards/[id]/periods/[periodId]/index.tsx` — statement detail from
      `getCardPeriodDetail`: header (range, due, "Editar fechas" when unpaid),
      amount summary (paid/pending, USD, "Pagado el …"), the period's movements
      grouped by date (native `MovementList` + `cardPeriodTransactionToMovement`,
      rows navigable), and a **Pay CTA** when `!has_payment && (closed|overdue)`.
- [x] 4.3 Edit-dates native sheet over `updatePeriodDates` (close + due, chronology
      validation, blocked when the next period is paid).

## 5. Pay statement screen (`cards/[id]/periods/[periodId]/pay.tsx`) — the crux

- [x] 5.1 Assemble the reads: `getCreditCardDetail`, `getCardPeriodDetail`,
      `getAccounts`, `suggestNextPeriodDates`. Single scrollable form, 2 sections,
      irreversibility warning + confirm CTA. **Assemble the payload only — no
      tax/FX/period logic in the screen.**
- [x] 5.2 Section 1 — **FX** (only when `pendingAmountUSD > 0`; 6-dec, required,
      recomputes amount, `USD × TC = $ARS`), **stamp tax** (chips + "Sin sello" +
      learned/first-time hint, recomputes amount), **amount** (default
      pending+stamp / USD total, editable, breakdown box when USD), **debit
      account** (`AccountSelectField`, same-bank default, cash/bank only, soft
      negative warning), **payment date** (default today).
- [x] 5.3 Section 2 — **next_end_date** / **next_due_date** prefilled from the
      running period (min = paid close / next close), with the anchor context copy
      + "estimada" badge.
- [x] 5.4 Client validation mirrors web exactly; submit → `payCardPeriod`; on
      success invalidate and navigate back to the card detail.

## 6. i18n

- [x] 6.1 Verify the `cards.payment.*` / `cards.labels.*` / `cards.actions.*` /
      `cards.errors.*` / `cards.period.*` / `cards.edit.*` /
      `cards.deactivate_block.*` keys the screens use all resolve on mobile; add
      only genuine gaps (es + en).

## 7. Validate

- [x] 7.1 `openspec validate mobile-cards-write --strict`.
- [x] 7.2 Mobile: typecheck + lint green.
- [x] 7.3 Manual smoke of the pay flow (ARS-only, USD-with-FX, with/without stamp)
      — no web test net covers this; confirm the payload matches `payCardPeriod`'s
      contract and nothing is re-derived client-side.
