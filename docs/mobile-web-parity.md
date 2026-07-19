# Mobile ↔ Web Parity Guide

_Snapshot: 2026-07-19. Source: automated web-vs-mobile feature sweep across all domains._

This is the working map of **what the web app does that the mobile app doesn't yet**. Use it to
plan mobile changes. It is organised **by route, then by feature**.

## How to read it

- **Status** of each feature on mobile: `MISSING` (no equivalent) · `PARTIAL` (exists but
  incomplete) · `DONE` (at parity — omitted from gap lists).
- **Type** of gap: `write` (an action/mutation you can't do on mobile) · `read` (info you can't
  see) · `nav` (a screen/entry point that doesn't exist).
- **Write gaps are the ones that matter most** — they're missing *capabilities*, not just polish.
  `read`/`nav`/PARTIAL items are usually convenience or presentation.

### Not gaps (missing on BOTH platforms — ignore)

Global search, notifications/inbox, data export/reporting, theme toggle, in-app help/docs. Neither
app has these; they're out of scope for parity.

### Cross-platform divergences (not feature gaps, but real debt — verify before shipping parity)

These aren't "web has a screen mobile lacks" — both platforms have the feature, but they behave or
are built differently. Surfaced by a second-pass review; easy to miss in a route-by-route sweep.

- **Mobile auth is not localized.** `apps/mobile/app/(auth)/*` (login, signup, signup-verify,
  recovery-verify, new-password) use **hardcoded Spanish literals — zero `useT()` calls** — whereas
  web auth goes through the i18n catalog (`useTranslations`). So mobile auth can't render in English
  and its copy isn't in `@grana/i18n-messages`. Localization debt, not a missing screen.
- **Preferences don't sync across platforms.** Mobile stores `show_cents` (`lib/preferences.ts`) and
  `locale` (`lib/locale.ts`) in **`expo-secure-store` (device-local)**; web uses cookies
  (`NEXT_LOCALE` etc.). A user who flips a preference on one platform won't see it on the other. The
  toggles exist on both — this is a storage/sync divergence, by design for now.

### Where mobile is already ahead / at parity

- **Auth** and **Onboarding** — at parity (only missing: OTP **resend cooldown**, minor).
- **Accounts** — effectively at parity (only minor UX polish gaps, see §5).
- **Settings home** (cents toggle, language, categories link) — at parity.
- **Cards list** — at parity (filters, grouping, archived section, month hero all present).
- Mobile has a dedicated `/accounts/[id]/currency` route and an eye-mask balance toggle that web
  folds elsewhere — structural differences, not gaps.

---

## At a glance

| Domain | Mobile status | Headline gap |
|---|---|---|
| **Hogar / Shared** | ❌ Entire module missing | No `/shared` at all; tab is a disabled placeholder |
| **Cards — lifecycle & pay** | ⚠️ Read-only | No edit, archive/reactivate, periods, or **pay statement** |
| **Transactions — recurring** | ❌ Missing | No `/transactions/recurring` hub (create/pause/edit/delete rules) |
| **Transactions — feed extras** | ⚠️ Partial | No filters, category breakdown, or pending blocks |
| **Transactions — detail tiles** | ⚠️ Partial | No month-weight / recurrence context tiles |
| **Dashboard** | ⚠️ Partial | No "Compartido" household strip (depends on Hogar) |
| **Settings — category form** | ⚠️ Partial | No emoji/color pickers (plain text inputs) |
| **Accounts** | ✅ ~Parity | Minor: discard-confirm, edit live-preview/locked styling |
| **Auth / Onboarding** | ✅ Parity | Minor: OTP resend cooldown |

**Two dependency chains to note:** the dashboard "Compartido" strip, the transactions
*pending-reimbursements* block, and shared-expense management all lean on the **Hogar module** and
its **reimbursement confirm/settlement** write flows. Sequencing Hogar unlocks several downstream
items.

---

## 1. Hogar / Shared — _entire module missing_

Mobile has **no `/shared` route**. The "Hogar" tab in the bottom bar is a disabled placeholder
(`coming_soon` badge). The only existing reuse is thin household/split **reads** in
`apps/mobile/lib/shared/queries.ts`, used solely by the movement form's "Compartir" toggle.

### Shared home / overview (`/shared`)
- [ ] Month navigator to browse shared spending by month · `nav`
- [ ] Household net-spend hero (gross + reimbursements = net, with USD badge) · `read`
- [ ] Shared spending breakdown (category donut) · `read`
- [ ] Debt tile: dual-currency balance + who-owes-whom direction · `read`
- [ ] Settle drawer trigger from the debt tile · `write`
- [ ] Projection tile (forecast balance over upcoming months) · `read`
- [ ] Recent shared expenses list (who paid, category, your share) · `read`
- [ ] Pending shared-recurrence teaser → recurring hub · `nav`

### Cuenta corriente / debt ledger (`/shared/cuenta-corriente`)
- [ ] Dual-currency balance cards with settlement status · `read`
- [ ] Current-account equation (4-box ledger, each drillable) · `read`
- [ ] Extracto: full ledger history, filterable by currency/person/settlements · `read`
- [ ] Upcoming impacts (projected changes, flip-month highlight) · `read`
- [ ] Settlement revert (contraasiento) inline action · `write`
- [ ] Equation-box drill-down to composing entries · `read`

### Settle a debt (`/shared/settle`)
- [ ] Amount input + calculator popover · `write`
- [ ] Quick chips (full / 50%) · `write`
- [ ] Account picker with per-currency balances · `write`
- [ ] What-happens preview (before→after balances + remaining debt) · `read`
- [ ] Negative-balance warning · `read`
- [ ] Send settlement (payer: "esperando confirmación") · `write`
- [ ] Receiver confirmation flow (accept + assign receiving account) · `write`

### Setup (`/shared/setup`)
- [ ] Create household (name it, become creator) · `write`
- [ ] Join household via invite code · `write`
- [ ] Create/join mode toggle · `nav`

### Shared settings (`/shared/settings`)
- [ ] Household name display + edit · `write`
- [ ] Members list (avatars, names, creator badge) · `read`
- [ ] Default split editor (percentage slider) · `write`
- [ ] Invite card (generate code, copy, share via native sheet/WhatsApp) · `write`
- [ ] Leave household (destructive; blocked with live debt) · `write`

---

## 2. Cards — _read-only; lifecycle & payment missing_

The cards **screens** exist (list, detail, create) and read views are at parity. What's missing is
everything that mutates a card or its statements.

### Card detail (`/cards/[id]`)
> The mobile card-detail **header has no action affordances at all** — it's pure read display. Every
> item below is absent, not merely disabled.
- [ ] Edit card (name, institution, credit limit, billing-cycle dates) · `write`
- [ ] Archive / delete card (header actions) · `write`
- [ ] Reactivate archived card (banner + button) · `write`
- [ ] Register first purchase CTA (empty state) · `write`
- [ ] "Pagar / Registrar pago" CTA on the pay-hero (currently display-only) · `nav`
- [ ] Edit-limit CTA on the credit-limit panel (currently read-only) · `write`
- [ ] "View all periods" link → periods list · `nav`
- [ ] Inactive-card banner when archived · `read`

### Card edit (`/cards/[id]/edit`)
- [ ] Edit form (name, institution, credit limit) · `write`
- [ ] Billing-cycle date editing (paid periods blocked) · `write`

### Periods / statements (`/cards/[id]/periods`, period overview) — _no route_
> Note: the card detail **already shows period *movements*** (`PeriodMovementsPane` in the detail's
> movements tab) — that's not the gap. What's missing is the **dedicated periods/statement route
> surface**: a list of past/upcoming statements and a per-period overview.
- [ ] Periods list (paginated, status badges, estimated-date badges) · `nav`
- [ ] Period detail / overview page · `nav`
- [ ] Period amount summary (ARS + USD, paid vs pending) · `read`
- [ ] Payment status indicator ("Pagado en…") · `read`
- [ ] Edit period dates (validated; blocked when paid) · `write`

### Pay statement (`/cards/[id]/periods/[periodId]/pay`) — _no route; biggest single flow_
- [ ] Pay form page + statement context header · `write`
- [ ] Pending amount display (ARS big, USD subordinate) · `read`
- [ ] Stamp tax (impuesto de sellos) auto-suggest / manual · `write`
- [ ] USD FX-rate input (fx_rate_to_ars) when USD pending · `write`
- [ ] Debit account selector (defaults to card's own bank) · `write`
- [ ] Payment date picker · `write`
- [ ] Running-period date confirmation (next end/due, editable) · `write`
- [ ] Negative-balance warning · `read`
- [ ] Submit payment · `write`

---

## 3. Transactions — recurring management _missing_

The create form can toggle "repetir" at creation, but there is **no management surface** for
existing rules.

### Recurring hub (`/transactions/recurring`) — _no route_
- [ ] Recurring hub entry point · `nav`
- [ ] Create a recurrence directly (frequency, amount, category, account, sharing) · `write`
- [ ] Status tabs (active / paused / finished) · `read`
- [ ] Recurrence detail page (`/transactions/recurring/[id]`) · `nav`
- [ ] Edit a recurrence · `write`
- [ ] Pause / resume · `write`
- [ ] Delete (with confirmation) · `write`
- [ ] Instances list (all occurrences, drillable) · `nav`
- [ ] Upcoming-occurrences projection card · `read`

---

## 4. Transactions — feed & detail extras

Core loop (feed → create → detail → edit → delete) is **done**. These are the deferred extras.

### Feed / list page (`/transactions`)
- [ ] Filters: type, category, subcategory, account, currency, amount range · `read`
- [ ] Text search by description · `read`
- [ ] Toggle "show shared movements" — web persists the choice (localStorage `grana:tx:showShared`, default on) · `read`
- [ ] Monthly spending overview (donut) with income/expense mode toggle · `read`
- [ ] Category spending ranking + drill-down · `read`
- [ ] Recurrence-suggestion banner · `nav`
- [ ] Pending recurrence instances block (confirm auto-generated tx) · `read`/`write`
- [ ] Pending **reimbursements** block (confirm/cancel a reintegro) · `write`

### Movement detail (`/transactions/[txId]`)
- [ ] "Peso en el mes" (month-weight) ring · `read`
- [ ] Recurrence tile (next charge, active-since, count) · `read`
- [ ] Recurrence history (last-6 bar chart) · `read`
- [ ] Link to parent recurrence rule · `nav`

> Note: `confirm/cancel a reimbursement` is the one genuine **write** capability hiding in the feed
> extras — it's the mobile counterpart to declaring a reintegro (which mobile can already do).

---

## 5. Dashboard, Settings, Accounts — smaller gaps

### Dashboard (`/dashboard`)
- [ ] "Compartido" household strip (net + member avatars + direction) · `read` — _depends on Hogar_
- [ ] "Add movement" quick action in the header (mobile relies on the FAB) · `write`
- [ ] Month-navigator disables the **next** arrow at the future boundary (web: the next handler is
  undefined at the latest month, per `dashboard-month-context.tsx`); mobile arrows are always enabled · `nav`
- [ ] _Charts (spent-this-month bars, spending donut) render differently on mobile — treat as
  intentional platform idiom unless a specific datum is missing, not as a gap._

### Settings — category form (`/settings/categories/*`)
- [ ] Icon picker (emoji grid) — mobile uses a plain text input · `write`
- [ ] Color picker (preset palette + custom) — mobile uses a plain text input · `write`
- [ ] System-category visual distinction (badge + read-only) · `read`
- [ ] Inline row actions on wide layout (mobile is kebab-only) — minor · `nav`

### Accounts — minor polish (otherwise at parity)
- [ ] **Account-scoped "add movement" CTA/FAB from the account detail** — confirmed absent on mobile
  (no `QuickAddFab` / `/transactions/new` entry from `accounts/[id]`); web has it · `write`
- [ ] Discard-changes confirmation on create/edit (unsaved-changes prompt) · `nav`
- [ ] Edit screen: live preview + locked-field styling for type/initial balance · `read`
- [ ] Confirm custom-institution creation works inline on mobile (unverified) · `write`

---

## Suggested sequencing (for discussion, not decided)

1. **Cards lifecycle & pay** (§2) — self-contained, high value, builds on shipped read-only cards;
   the pay-statement flow is the single biggest missing capability.
2. **Reimbursement confirm/cancel** (§4 feed) — small, unlocks the pending-reimbursements block and
   completes the reintegro round-trip mobile already half-supports.
3. **Recurring management** (§3) — a cohesive standalone feature.
4. **Hogar / Shared** (§1) — the largest domain; also unblocks the dashboard Compartido strip.
5. **Feed filters + breakdown** and **detail context tiles** (§4) — display polish, lowest urgency.

Accounts/settings/dashboard/auth polish items (§5) are opportunistic — fold them in when touching
those screens.
