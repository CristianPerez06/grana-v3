## 1. Web rename (Wallet name parity)

- [x] 1.1 Rename `apps/web/app/(app)/cards/_components/wallet-grid.tsx` → `wallet.tsx` and update its export from `WalletGrid` to `Wallet`.
- [x] 1.2 Rename `apps/web/app/(app)/cards/_components/wallet-grid-section.tsx` → `wallet-section.tsx` and update its export from `WalletGridSection` to `WalletSection`.
- [x] 1.3 Rename `apps/web/app/(app)/cards/_components/wallet-grid-container.tsx` → `wallet-container.tsx` and update its export from `WalletGridContainer` to `WalletContainer`. Update the internal references to the renamed `Wallet` and `WalletSection`.
- [x] 1.4 Update imports in `apps/web/app/(app)/cards/page.tsx` from `WalletGridContainer` to `WalletContainer`.
- [x] 1.5 Run `pnpm --filter @grana/web lint` and `pnpm --filter @grana/web typecheck`; confirm zero remaining references to `WalletGrid`/`wallet-grid` via `grep -r "WalletGrid\|wallet-grid" apps/web`.

## 2. Mobile queries layer

- [x] 2.1 In `apps/mobile/lib/cards/queries.ts`, accept `archivedOnly` as a new optional field of the options object of `getCreditCards` (mirroring the web), so the archived section can pull only archived cards in a single call.
- [x] 2.2 In `apps/mobile/lib/cards/queries.ts`, add the type `CardsMonthSummary` and the function `getCardsMonthSummary()` mirroring the shape of the web equivalent in `apps/web/lib/cards/queries.ts`: returns `{ toPayARS, toPayUSD, hasUSD, hasToPay, nextDue, upcoming[] }`. Use the mobile Supabase client and `getTodayAR()`. Include a leading comment pointing to the web mirror.
- [x] 2.3 Verify the i18n keys needed by the mobile screen exist in the mobile locale bundle (`cards.list.title`, `cards.list.subtitle`, `cards.list.subtitle_loading`, `cards.list.add_label`, `cards.list.month_hero_eyebrow`, `cards.list.month_hero_empty`, `cards.list.next_due_label`, `cards.list.next_due_value`, `cards.list.upcoming_title`, `cards.list.upcoming_empty`, `cards.list.upcoming_due`, `cards.list.upcoming_open`, `cards.list.section_title`, `cards.list.section_hint`, `cards.list.empty_title`, `cards.list.empty_body`, `cards.list.archived_section_title`, `cards.list.hero_loading`, `cards.list.hero_error`, `cards.list.wallet_loading`, `cards.list.wallet_error`, `cards.list.archived_error`). Add missing keys.

## 3. Mobile components — rename Wallet

- [x] 3.1 Rename `apps/mobile/components/cards/CreditCardCarousel.tsx` → `Wallet.tsx`, update the export from `CreditCardCarousel` to `Wallet`, and keep the same props (`{ cards }`). Internally still uses `FlatList` horizontal — the carousel is the mobile implementation of `Wallet`.
- [x] 3.2 Update imports in `apps/mobile/app/(app)/cards.tsx` and any other consumers (`grep -r "CreditCardCarousel" apps/mobile` to find them) to `Wallet`.

## 4. Mobile components — new sections

- [x] 4.1 Create `apps/mobile/components/cards/CardsMonthHero.tsx`. Accept `summary: CardsMonthSummary` and `showCents?: boolean` (mirror web). Single-column layout: eyebrow, ARS primary, USD subordinate (only when `hasUSD && toPayUSD > 0`), next-due pill, separator, upcoming title, list of upcoming rows. Each row: day/month pill (left) + card name (center) + ARS amount (right). When `!summary.hasToPay`, render the empty-state copy. When `summary.upcoming.length === 0`, render the empty-state copy for upcoming.
- [x] 4.2 Create `apps/mobile/components/cards/ArchivedCardsSection.tsx`. Accept `cards: CreditCardSummary[]`. If `cards.length === 0`, return `null`. Otherwise render a `Pressable` header ("Archivadas (N)") + `useState`-controlled `expanded` boolean. When expanded, render a list of rows (each row: monogram chip + card name); tap on a row uses `router.push(`/cards/${id}`)`.
- [x] 4.3 Create `apps/mobile/components/cards/CardsHeader.tsx`. Wraps `PageHeader` with title "Tarjetas". Runs `useQuery({ queryKey: ['cards', 'count'], queryFn: () => supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('type', 'credit').eq('is_active', true) })`. Builds the subtitle: count loading or error → `"- tarjetas de crédito · resúmenes de {mes}"`; count resolved → `"{count} tarjetas de crédito · resúmenes de {mes}"`. Mes derived from `getTodayAR()` and localized. Right-slot action: a `Button` (or `Pressable` matching the design system primary button) labeled "Agregar tarjeta" with the plus icon, `disabled` always `true` in this change, no `onPress`.

## 5. Mobile route composition

- [x] 5.1 Rewrite `apps/mobile/app/(app)/cards.tsx` to compose: `CardsHeader` (always rendered) + `ScrollView` containing three sections.
- [x] 5.2 Section 1 inside the route file (or as a co-located component if it grows): a `MonthHeroSection` that runs `useQuery({ queryKey: ['cards', 'month-summary'], queryFn: getCardsMonthSummary })`. While `isPending`, render `<SectionFallback message="Cargando resumen del mes…" />`. On `isError`, render `<SectionFallback message="No pudimos cargar el resumen del mes" />`. On success, render `<CardsMonthHero summary={data} />`.
- [x] 5.3 Section 2: a `WalletSection` that runs `useQuery({ queryKey: ['cards'], queryFn: () => getCreditCards({ includeArchived: false }) })`. While `isPending`, render `<SectionFallback message="Cargando tarjetas…" />`. On `isError`, render `<SectionFallback message="No pudimos cargar las tarjetas" />`. On success: if `data.length === 0`, render the empty state (border-dashed container with `cards.list.empty_title` + `cards.list.empty_body`, NO CTA — the CTA lives in the header and is disabled); else render `<Wallet cards={data} />`.
- [x] 5.4 Section 3: an `ArchivedSection` that runs `useQuery({ queryKey: ['cards', 'archived'], queryFn: () => getCreditCards({ archivedOnly: true }) })`. While `isPending`, render nothing (no fallback, no space). On `isError`, render `<SectionFallback message={...} />`. On success, render `<ArchivedCardsSection cards={data} />` (which itself returns `null` when empty).
- [x] 5.5 Verify each section is independent: simulate a query failure for the hero (return a rejected promise) and confirm the header, wallet and archived still render. Same simulation for wallet and archived.

## 6. Verification & cleanup

- [x] 6.1 Run `pnpm --filter @grana/mobile lint` and `pnpm --filter @grana/mobile typecheck`. Zero errors.
- [x] 6.2 Run the Expo dev server (`pnpm --filter @grana/mobile start`) and open `/cards` from the Menú tab. Confirm: header visible immediately with `-` placeholder, then count fills in; hero, wallet and archived each load with their own fallback then resolve; CTA "Agregar tarjeta" visible but cannot be pressed.
- [x] 6.3 With network throttling / Supabase RLS off (or a deliberate broken query), verify a failed hero query keeps the header + wallet + archived visible.
- [x] 6.4 With no archived cards, confirm the archived section renders nothing (not even an empty fallback).
- [x] 6.5 With at least one archived card, tap the "Archivadas (N)" header and confirm expand/collapse works.
- [x] 6.6 `grep -r "CreditCardCarousel\|WalletGrid\|wallet-grid" apps/` returns zero matches.
- [x] 6.7 Run `pnpm --filter @grana/web lint` and `pnpm --filter @grana/web typecheck` once more after all renames are in.
- [x] 6.8 Validate the OpenSpec change: `openspec validate implement-mobile-cards-route --strict`.

## 7. Commit & branch

- [x] 7.1 Branch name: `feat/mobile-cards-route`. Commit title only, no body or trailers: `feat(mobile): /cards route con header, hero, wallet y archivadas`.
- [x] 7.2 Stop after the commit; do NOT merge to main, do NOT push unless asked.
