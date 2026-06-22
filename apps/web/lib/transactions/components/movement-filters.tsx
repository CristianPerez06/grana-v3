'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Repeat, Search, SlidersHorizontal, Users, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { Label } from '@/components/ui/label'
import { getTodayAR } from '@/lib/date'
import { translateCategoryLabel, translateSubcategoryLabel } from '@/lib/categories/display'
import {
  MOVEMENT_TYPE_KEYS,
  monthOf,
  shiftMonth,
  SUBCATEGORY_NONE_MARKER,
  type MovementCurrencyFilter,
  type MovementFilters as MovementFiltersState,
  type MovementTypeFilter,
} from '../filters'

/**
 * Controller delegates every filter mutation to the caller. Required: the
 * /transactions and /accounts/[id] shells both pass one, plugging filter
 * mutations into their reducer.
 */
export type MovementFiltersController = {
  onSetQuery: (query: string) => void
  onSetType: (type: MovementTypeFilter | null) => void
  onSetAccount: (accountId: string | null) => void
  onSetCategory: (categoryId: string | null) => void
  onSetSubcategory: (subcategoryId: string | null) => void
  onSetCurrency: (currency: MovementCurrencyFilter | null) => void
  onSetAmountMin: (min: number | null) => void
  onSetAmountMax: (max: number | null) => void
  onSetMonth: (month: string) => void
  onClearAll: () => void
}

type MovementFiltersProps = {
  filters: MovementFiltersState
  accounts: Array<{ id: string; name: string; type: 'cash' | 'bank' | 'credit' }>
  categories: Array<{
    id: string
    name: string
    type: 'income' | 'expense' | 'both'
    canonical_name: string
    user_id: string | null
  }>
  /** Subcategories of the active category (empty when no category is filtered, or when the host view chooses not to support this filter). */
  subcategories?: Array<{
    id: string
    name: string
    category_id: string
    canonical_name: string
    user_id: string | null
  }>
  /** Show the account filter only when there are multiple accounts to disambiguate. */
  showAccount: boolean
  /** Account detail view hides the account filter (already scoped to one account). */
  showAccountFilter?: boolean
  /** Hide the month navigator when another control (the spending overview) owns it. */
  showMonthNav?: boolean
  /** Required controller — every filter mutation dispatches through it. */
  controller: MovementFiltersController
  /**
   * Optional "show shared movements" toggle, rendered as a toolbar button. Only
   * the global module passes it (the account detail view omits it). `active`
   * means shared movements are currently shown; `onToggle` flips the persisted
   * preference. It is intentionally NOT a chip filter and does not affect the
   * "Filtros (N)" count.
   */
  sharedToggle?: { active: boolean; onToggle: () => void }
  /**
   * When true the toolbar (search / filter sheet / chip clears / clear-all)
   * renders visually disabled and stops accepting clicks. The shell uses this
   * while the movement list query is pending so the user gets clear feedback
   * that the list is loading. Active chips still render so the current filter
   * state stays legible.
   */
  disabled?: boolean
}

/** Filters that narrow content (the count shown on the "Filtros" button badge). */
const activeContentCount = (f: MovementFiltersState) =>
  [f.type, f.categoryId, f.subcategoryId, f.accountId, f.currency, f.amountMin, f.amountMax].filter(
    (v) => v != null,
  ).length

/**
 * MovementFilters — three discreet icon buttons sit at the top-right of the
 * list zone: Search (expands to a full-width input), Recurrences (link), and
 * Filters (opens a sheet from the right). Active filters render as removable
 * chips below; the sheet shape mirrors the rest of the v3 form vocabulary.
 *
 * The pattern follows v2's `MovimientosTopBar` but ungrouped from the page
 * header: the header stays editorial-minimal and these affordances live next
 * to the content they act on.
 */
export const MovementFilters = ({
  filters,
  accounts,
  categories,
  subcategories = [],
  showAccount,
  showAccountFilter = true,
  showMonthNav = true,
  controller,
  sharedToggle,
  disabled = false,
}: MovementFiltersProps) => {
  const t = useTranslations('transactions')
  const tRoot = useTranslations()
  const locale = useLocale()

  // System categories/subcategories render localized; user-owned keep their name.
  const categoryLabel = (c: { name: string; canonical_name: string; user_id: string | null }) =>
    translateCategoryLabel(c.name, c.canonical_name, c.user_id === null, tRoot) ?? c.name
  const subcategoryLabel = (s: { name: string; canonical_name: string; user_id: string | null }) =>
    translateSubcategoryLabel(s.name, s.canonical_name, s.user_id === null, tRoot) ?? s.name

  const [sheetOpen, setSheetOpen] = useState(false)
  const [searchMode, setSearchMode] = useState((filters.query ?? '').length > 0)
  const [search, setSearch] = useState(filters.query ?? '')
  const searchInputRef = useRef<HTMLInputElement>(null)
  // Local drafts for the money-amount fields. MoneyAmountInput is controlled,
  // so we mirror the parsed filter as a canonical decimal string and commit
  // back to the reducer on blur (matches the previous defaultValue+onBlur
  // behavior, but routed through the money-safe primitive — AGENTS.md forbids
  // <input type="number"> for money amounts).
  const [amountMinDraft, setAmountMinDraft] = useState(
    filters.amountMin != null ? String(filters.amountMin) : '',
  )
  const [amountMaxDraft, setAmountMaxDraft] = useState(
    filters.amountMax != null ? String(filters.amountMax) : '',
  )

  // Sync local draft when external state changes (e.g. a chip is cleared,
  // which mutates the filters and so should mirror to the local search box).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSearch(filters.query ?? '')
    setSearchMode((filters.query ?? '').length > 0)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [filters.query])

  // Same sync for the amount drafts — chip clears / clearAll mutate the
  // filters and the local input must reflect the new state.
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setAmountMinDraft(filters.amountMin != null ? String(filters.amountMin) : '')
  }, [filters.amountMin])
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setAmountMaxDraft(filters.amountMax != null ? String(filters.amountMax) : '')
  }, [filters.amountMax])

  // Single dispatch point for filter mutations. Every patch routes through
  // the controller's callbacks (React-state filters on the host route).
  const setParams = (updates: Record<string, string | null>) => {
    if ('q' in updates) controller.onSetQuery(updates.q ?? '')
    if ('type' in updates)
      controller.onSetType((updates.type as MovementTypeFilter | null) ?? null)
    if ('account' in updates) controller.onSetAccount(updates.account ?? null)
    if ('category' in updates) {
      controller.onSetCategory(updates.category ?? null)
      // The legacy URL builder always sent `subcategory: null` alongside a
      // category clear; the reducer enforces the same invariant, so we don't
      // need to forward an explicit subcategory clear when category changes.
    }
    if ('subcategory' in updates) controller.onSetSubcategory(updates.subcategory ?? null)
    if ('currency' in updates) {
      const c = updates.currency
      controller.onSetCurrency(
        c === 'ARS' || c === 'USD' ? (c as MovementCurrencyFilter) : null,
      )
    }
    if ('amount_min' in updates) {
      const raw = updates.amount_min
      const parsed = raw == null || raw === '' ? null : Number(raw)
      controller.onSetAmountMin(Number.isFinite(parsed as number) ? (parsed as number) : null)
    }
    if ('amount_max' in updates) {
      const raw = updates.amount_max
      const parsed = raw == null || raw === '' ? null : Number(raw)
      controller.onSetAmountMax(Number.isFinite(parsed as number) ? (parsed as number) : null)
    }
    if ('month' in updates && updates.month) controller.onSetMonth(updates.month)
  }

  // Instant search: debounce the input, then push `q` to the URL.
  useEffect(() => {
    const handler = setTimeout(() => {
      if (search !== (filters.query ?? '')) setParams({ q: search || null })
    }, 300)
    return () => clearTimeout(handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Month navigation (used only when the parent asks for it; the spending
  // overview card owns the canonical nav on /transactions).
  const month = filters.month ?? monthOf(getTodayAR())
  const isCustomRange = filters.month == null
  const monthLabel = (() => {
    const [y, m] = month.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-AR', {
      month: 'long',
      year: 'numeric',
    })
  })()
  const goToMonth = (next: string) =>
    setParams({ month: next, from: null, to: null })

  const count = activeContentCount(filters)

  // Active-filter chips derived from the URL state.
  const chips: Array<{ key: string; label: string; clear: () => void }> = []
  if (filters.query)
    chips.push({
      key: 'q',
      label: `"${filters.query}"`,
      clear: () => {
        setSearch('')
        setParams({ q: null })
      },
    })
  if (filters.type)
    chips.push({
      key: 'type',
      label: t(`movement_kinds.${filters.type}`),
      clear: () => setParams({ type: null }),
    })
  if (filters.categoryId) {
    const c = categories.find((x) => x.id === filters.categoryId)
    chips.push({
      key: 'category',
      // Clearing the category also clears subcategory — a subcategory without
      // its parent category has no meaning and the parser would drop it anyway.
      label: c ? categoryLabel(c) : t('filters.category'),
      clear: () => setParams({ category: null, subcategory: null }),
    })
  }
  if (filters.subcategoryId) {
    const activeSub = subcategories.find((s) => s.id === filters.subcategoryId)
    const name =
      filters.subcategoryId === SUBCATEGORY_NONE_MARKER
        ? t('filters.no_subcategory')
        : activeSub
          ? subcategoryLabel(activeSub)
          : t('filters.subcategory')
    chips.push({
      key: 'subcategory',
      label: t('filters.active_chip_subcategory', { name }),
      clear: () => setParams({ subcategory: null }),
    })
  }
  if (filters.accountId) {
    const a = accounts.find((x) => x.id === filters.accountId)
    chips.push({
      key: 'account',
      label: a?.name ?? t('filters.account'),
      clear: () => setParams({ account: null }),
    })
  }
  if (filters.currency)
    chips.push({
      key: 'currency',
      label: filters.currency,
      clear: () => setParams({ currency: null }),
    })
  if (filters.amountMin != null)
    chips.push({
      key: 'amount_min',
      label: `≥ ${filters.amountMin}`,
      clear: () => setParams({ amount_min: null }),
    })
  if (filters.amountMax != null)
    chips.push({
      key: 'amount_max',
      label: `≤ ${filters.amountMax}`,
      clear: () => setParams({ amount_max: null }),
    })

  const clearAll = () => {
    setSearch('')
    setSearchMode(false)
    controller.onClearAll()
  }

  const enterSearch = () => {
    setSearchMode(true)
    setTimeout(() => searchInputRef.current?.focus(), 0)
  }

  const cancelSearch = () => {
    setSearchMode(false)
    if (search) {
      setSearch('')
      setParams({ q: null })
    }
  }

  // Icon button base styling: 36×36, rounded-lg, subtle border. The same
  // ratios as v2 (`w-9 h-9 rounded-[var(--radius-lg)] border-white/20`) but
  // adapted to the light page surface — border-border + hover bg-muted.
  const iconButtonCls =
    'inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-card text-text-muted hover:text-text hover:bg-muted/40 transition-colors'
  const iconButtonDisabledCls =
    'inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-card text-text-soft opacity-60 cursor-not-allowed'

  return (
    <div className="flex flex-col gap-3">
      {/* Top toolbar: search expands inline when active; otherwise three icons */}
      {searchMode ? (
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 h-10 px-3 rounded-[10px] border border-border bg-card">
            <Search size={16} className="shrink-0 text-text-soft" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('filters.search_placeholder')}
              aria-label={t('filters.search')}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-soft"
            />
            {search.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setParams({ q: null })
                  searchInputRef.current?.focus()
                }}
                className="flex items-center text-text-soft hover:text-text"
                aria-label={t('filters.clear_search')}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={cancelSearch}
            className="h-10 px-2 text-sm font-medium text-text-muted hover:text-text"
          >
            {t('filters.cancel')}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          {/* Optional month nav on the left (used when there is no breakdown card) */}
          {showMonthNav ? (
            <div className="flex items-center gap-1 rounded-md border border-border px-1">
              <button
                type="button"
                aria-label={t('filters.prev_month')}
                onClick={() => goToMonth(shiftMonth(month, -1))}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                ‹
              </button>
              <span className="min-w-28 text-center text-sm font-medium capitalize">
                {isCustomRange ? t('filters.custom_range') : monthLabel}
              </span>
              <button
                type="button"
                aria-label={t('filters.next_month')}
                onClick={() => goToMonth(shiftMonth(month, 1))}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                ›
              </button>
            </div>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={enterSearch}
              disabled={disabled}
              className={disabled ? iconButtonDisabledCls : iconButtonCls}
              aria-label={t('filters.search')}
            >
              <Search size={16} />
            </button>
            {disabled ? (
              <span className={iconButtonDisabledCls} aria-disabled aria-label={t('header.see_recurrences')}>
                <Repeat size={16} />
              </span>
            ) : (
              <Link
                href="/transactions/recurring"
                className={iconButtonCls}
                aria-label={t('header.see_recurrences')}
              >
                <Repeat size={16} />
              </Link>
            )}
            {sharedToggle && (
              <button
                type="button"
                onClick={sharedToggle.onToggle}
                disabled={disabled}
                aria-pressed={!sharedToggle.active}
                className={
                  disabled
                    ? iconButtonDisabledCls
                    : sharedToggle.active
                      ? iconButtonCls
                      : 'inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-primary bg-primary text-primary-foreground transition-colors'
                }
                aria-label={
                  sharedToggle.active ? t('filters.hide_shared') : t('filters.show_shared')
                }
                title={sharedToggle.active ? t('filters.hide_shared') : t('filters.show_shared')}
              >
                <Users size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              disabled={disabled}
              className={`${disabled ? iconButtonDisabledCls : iconButtonCls} relative`}
              aria-label={t('filters.filters_button')}
            >
              <SlidersHorizontal size={16} />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Active-filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              disabled={disabled}
              className={`inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs transition-colors ${
                disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted'
              }`}
            >
              {chip.label}
              <X size={12} />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className={`text-xs transition-colors ${
              disabled
                ? 'text-muted-foreground opacity-60 cursor-not-allowed'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('filters.clear_all')}
          </button>
        </div>
      )}

      {/* Filter sheet: dim overlay + right-side panel. Built with raw HTML on
          purpose — keeping it inside this component avoids pulling in a
          headless lib for one surface, and the sheet content shares context
          (filters draft, accounts, categories) with the toolbar above. */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-ink/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheetOpen(false)
          }}
          role="dialog"
          aria-modal="true"
          aria-label={t('filters.filters_button')}
        >
          <aside className="flex h-full w-full max-w-[440px] flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border-soft px-6 py-5">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-soft">
                  {t('filters.refine')}
                </span>
                <h2 className="text-xl font-bold tracking-tight">
                  {t('filters.filters_button')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-text-muted hover:text-text hover:bg-muted/40 transition-colors"
                aria-label={t('filters.close')}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="f-type">{t('filters.type')}</Label>
                <select
                  id="f-type"
                  value={filters.type ?? ''}
                  onChange={(e) => setParams({ type: e.target.value || null })}
                  className="h-11 w-full rounded-[12px] border border-input bg-background px-3 text-sm"
                >
                  <option value="">{t('filters.all_masc')}</option>
                  {MOVEMENT_TYPE_KEYS.map((value) => (
                    <option key={value} value={value}>
                      {t(`movement_kinds.${value}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="f-category">{t('filters.category')}</Label>
                <select
                  id="f-category"
                  value={filters.categoryId ?? ''}
                  onChange={(e) =>
                    // Changing the parent category invalidates the active
                    // subcategory: subcategories belong to a single category,
                    // so the previously selected one is no longer reachable.
                    setParams({ category: e.target.value || null, subcategory: null })
                  }
                  className="h-11 w-full rounded-[12px] border border-input bg-background px-3 text-sm"
                >
                  <option value="">{t('filters.all_fem')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {categoryLabel(category)}
                    </option>
                  ))}
                </select>
              </div>

              {filters.categoryId && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="f-subcategory">{t('filters.subcategory')}</Label>
                  <select
                    id="f-subcategory"
                    value={filters.subcategoryId ?? ''}
                    onChange={(e) => setParams({ subcategory: e.target.value || null })}
                    className="h-11 w-full rounded-[12px] border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{t('filters.all_fem')}</option>
                    {subcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategoryLabel(subcategory)}
                      </option>
                    ))}
                    <option value={SUBCATEGORY_NONE_MARKER}>{t('filters.no_subcategory')}</option>
                  </select>
                </div>
              )}

              {showAccount && showAccountFilter && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="f-account">{t('filters.account')}</Label>
                  <select
                    id="f-account"
                    value={filters.accountId ?? ''}
                    onChange={(e) => setParams({ account: e.target.value || null })}
                    className="h-11 w-full rounded-[12px] border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{t('filters.all_fem')}</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {t(`account_types.${account.type}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="f-currency">{t('filters.currency')}</Label>
                <select
                  id="f-currency"
                  value={filters.currency ?? ''}
                  onChange={(e) => setParams({ currency: e.target.value || null })}
                  className="h-11 w-full rounded-[12px] border border-input bg-background px-3 text-sm"
                >
                  <option value="">{t('filters.all_fem')}</option>
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="f-amount-min">{t('filters.amount_min')}</Label>
                  <MoneyAmountInput
                    id="f-amount-min"
                    value={amountMinDraft}
                    onChange={setAmountMinDraft}
                    onBlur={() => setParams({ amount_min: amountMinDraft || null })}
                    className="flex h-11 w-full rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-text transition-colors duration-[var(--duration-fast)] placeholder:text-text-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="f-amount-max">{t('filters.amount_max')}</Label>
                  <MoneyAmountInput
                    id="f-amount-max"
                    value={amountMaxDraft}
                    onChange={setAmountMaxDraft}
                    onBlur={() => setParams({ amount_max: amountMaxDraft || null })}
                    className="flex h-11 w-full rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-text transition-colors duration-[var(--duration-fast)] placeholder:text-text-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-border-soft px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  clearAll()
                  setSheetOpen(false)
                }}
                className="flex-1 h-11 rounded-[12px] border border-border bg-card text-sm font-medium text-text-muted hover:text-text transition-colors"
              >
                {t('filters.clear_all')}
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex-1 h-11 rounded-[12px] bg-emerald text-sm font-semibold text-white hover:bg-emerald-deep transition-colors"
              >
                {t('filters.apply')}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
