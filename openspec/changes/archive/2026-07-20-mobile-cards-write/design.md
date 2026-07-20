# Design — mobile credit-card write flows

## Shape: bind shared mutators → build native screens. No extraction.

Every mutator and read already lives in `@grana/*`; the web actions are thin
wrappers over them. So this change adds **thin bindings** in
`apps/mobile/lib/cards/mutations.ts` (the `createCreditCard` binding there is the
template) plus **native screens**. Nothing is extracted; no package or web file
changes.

```
  @grana/cards        updateCreditCard · updatePeriodDates · payCardPeriod
  @grana/accounts     archiveAccount · reactivateAccount · deleteAccount
  @grana/transactions-mutations  registerCardPurchase/Installments (already on mobile)
        │  (all shared, all already used by web thin wrappers)
        ▼
  apps/mobile/lib/cards/mutations.ts   ← add thin bindings (auth + map + invalidate)
        ▼
  apps/mobile/app/(app)/cards/…        ← new native screens (pushed, custom PageHeader)
```

## Route restructure (Expo Router)

Mobile's `cards/[id].tsx` is a leaf file; nested routes need it to become a
directory — the same restructure the movement detail did in C.2
(`[txId].tsx` → `[txId]/index.tsx`).

```
  cards/
  ├── index.tsx                         list          (exists)
  ├── new.tsx                           create        (exists)
  └── [id]/
      ├── index.tsx                     detail        (was [id].tsx — now write-enabled)
      ├── edit.tsx                      edit card
      └── periods/
          ├── index.tsx                 periods list
          └── [periodId]/
              ├── index.tsx             statement (period) detail
              └── pay.tsx               ★ pay statement
```

Cards is not a tab — every screen is pushed (from Menú → card → …), each with a
custom `PageHeader` (no native stack header), chrome visible from first paint.

## Detail becomes the write hub (was read-only)

The existing read-only detail gains the write entry points its docblock deferred:

- **`active` overview** — the "a pagar" component becomes a **Pay CTA** →
  `pay.tsx`; the header gains an **Editar** action → `edit.tsx`; a link into the
  **periods list**. Period-pane rows become **navigable** to the native movement
  detail (which now exists — the read-only requirement's "not navigable" clause
  is stale).
- **`new-card`** — gains the **register-first-purchase** CTA (was suppressed in
  v1), deep-linking to `/transactions/new` with the card preselected.
- **`archived-empty`** — gains **reactivate**.

## Mutator bindings (`lib/cards/mutations.ts`)

Follow the existing `createCreditCard` shell (auth → shared mutation → `mapResult`
→ invalidate). Add:

- `updateCreditCard(qc, id, input)` → `@grana/cards`. Payload
  `{ name?, institution_id?, credit_limit? }` (network/type immutable — enforced
  by the package schema, mirror web).
- `updatePeriodDates(qc, periodId, input)` → `@grana/cards`. Payload
  `{ end_date, due_date }`. Used by BOTH the edit-card cycle-dates section and the
  statement-detail edit-dates sheet.
- `payCardPeriod(qc, input)` → `@grana/cards`. The full `PayCardPeriodInput`.
- `archiveCard(qc, id)` / `reactivateCard(qc, id)` → delegate to the shared
  `archiveAccount` / `reactivateAccount` (a card is an account; already bound for
  regular accounts in `lib/accounts/mutations.ts`). `archiveCard` must surface the
  typed **`pending_debt`** reason so the detail shows a block dialog (mirror web's
  card-scoped `deactivateCreditCardAccount`, which wraps the account archive).
- `deleteCard(qc, id)` → shared `deleteAccount`; only offered when the card never
  had movements.

Invalidation: extend `invalidateAfterCardMutation` usage — a pay also shifts
`transactions`, `accounts`, `dashboard` (the payment expense + debit balance), so
pay invalidates those prefixes too.

## Edit card — pushed screen (not a drawer)

Web uses a right-drawer + `/edit` route fallback. Mobile uses the **pushed
`edit.tsx` screen** (consistent with `cards/new.tsx` and the movement `edit.tsx`).
Fields in order, mirroring web:

1. Live preview (monogram, name, bank+network, limit bar, cycle mini-diagram)
2. **Nombre** (1–50 chars) · **Banco** (institution picker, optional)
3. **Red** — read-only chip with lock (immutable)
4. **Ciclo** — current close/due + next close/due (each shown only if the period
   exists; "estimada" mark on an estimated next period). Saved via
   `updatePeriodDates` **current-then-next, only changed dates**.
5. **Límite** (optional, > 0) with live % utilization bar

Footer: archive (debt-guarded → block dialog) + delete (disabled with copy when
the card has movements) + Guardar (disabled until dirty; discard-confirm on close).

## Periods list + statement detail

- **Periods list** — one row per period: date range · status pill
  (`futuro`/`actual`/`cerrado_esperando_pago`/`vencido`/`pagado`) · "estimada"
  badge · due line · ARS amount (+ USD when present). Reads `getCardPeriods`.
- **Statement detail** — header (range, due, "Editar fechas" when unpaid) · amount
  summary (paid/pending, USD, "Pagado el …") · **Pay CTA** when
  `!has_payment && (closed|overdue)` · the period's movements grouped by date
  (reuse the native `MovementList`/`MovementRow` + `cardPeriodTransactionToMovement`
  already used by the read-only detail's pane, rows now navigable). Reads
  `getCardPeriodDetail`. Edit-dates is a native sheet over `updatePeriodDates`.

## Pay statement — the crux (single scrollable form, 2 sections)

All intricate logic (tax alícuota derivation, FX persistence, next-period
confirmation + eager P(n+2), atomicity) is **server-side in `payCardPeriod`**.
Mobile only assembles the payload + reproduces the client-side field defaults and
validation. Reads: `getCreditCardDetail`, `getCardPeriodDetail`, `getAccounts`,
and `suggestNextPeriodDates` (`@grana/money-logic`) for the next-period defaults.

**Section 1 — Datos del pago** (in order):
1. **FX rate** — *only when `pendingAmountUSD > 0`*. 6-decimal, no grouping;
   required (`fx_required`). Recomputes the amount. Shows `USD × TC = $ARS`.
2. **Stamp tax (sellos)** — chip suggestions (dedup) + "Sin sello" (0); a learned
   alert with the suggested amount when the card already has an alícuota, else a
   first-time hint. Recomputes the amount.
3. **Amount** — default `pendingAmountARS + stamp` (or the USD-inclusive total);
   editable (partial pay allowed); a bordered breakdown box when USD is present
   (ARS · USD×TC · sello · total).
4. **Debit account** — the shared `AccountSelectField`; default = an active ARS
   account of the **card's own bank**, else the first eligible; cash/bank only.
   Soft negative-balance warning when the balance < amount.
5. **Payment date** — default today (`getTodayAR`).

**Section 2 — Próximo resumen** (confirm the running period's dates):
- **next_end_date** (default = running period's persisted/projected close;
  min = paid period's close; error `next_end_before_known`) and **next_due_date**
  (default = running due; min = next close; error `due_after_close`).
- Context copy naming the paid period's close as the anchor; "estimada" badge when
  the running period is estimated.

Footer: irreversibility warning (`cards.payment.warning`) + confirm CTA.
Client validation mirrors web exactly (amount > 0; FX required iff USD debt;
account/date/next-dates required; next_end > paid close; next_due > next_end).

## i18n

All copy is under `cards.*` (`cards.payment.*`, `cards.labels.*`,
`cards.actions.*`, `cards.errors.*`, `cards.period.*`, `cards.edit.*`,
`cards.deactivate_block.*`) — web already ships it. Expect **near-zero new keys**;
verify each screen's keys resolve on mobile and add only genuine gaps (es + en).

## Risk note — no test net

Nothing is extracted, so the web suite doesn't guard this. Pay-statement
correctness rests entirely on the shared `payCardPeriod`; the mobile screen must
**assemble the payload only** and never re-derive tax/FX/period logic. This is the
single most important constraint of the change.
