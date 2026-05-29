'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Repeat, Search, SlidersHorizontal, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getTodayAR } from '@/lib/date'
import {
  MOVEMENT_TYPE_KEYS,
  monthOf,
  shiftMonth,
  SUBCATEGORY_NONE_MARKER,
  type MovementFilters as MovementFiltersState,
} from '../filters'

type MovementFiltersProps = {
  filters: MovementFiltersState
  accounts: Array<{ id: string; name: string; type: 'cash' | 'bank' | 'credit' }>
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' | 'both' }>
  /** Subcategories of the active category (empty when no category is filtered, or when the host view chooses not to support this filter). */
  subcategories?: Array<{ id: string; name: string; category_id: string }>
  /** Show the account filter only when there are multiple accounts to disambiguate. */
  showAccount: boolean
  /** Account detail view hides the account filter (already scoped to one account). */
  showAccountFilter?: boolean
  /** Hide the month navigator when another control (the spending overview) owns it. */
  showMonthNav?: boolean
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
}: MovementFiltersProps) => {
  const t = useTranslations('transactions')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [searchMode, setSearchMode] = useState((filters.query ?? '').length > 0)
  const [search, setSearch] = useState(filters.query ?? '')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Sync local draft with URL when external navigation happens (e.g. the
  // user clears a chip, the URL changes, we need to mirror it locally).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSearch(filters.query ?? '')
    setSearchMode((filters.query ?? '').length > 0)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [filters.query])

  // Update one or more params in the URL (resets pagination). null/'' clears.
  const setParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    params.delete('limit')
    router.replace(`${pathname}?${params.toString()}`)
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
      label: c?.name ?? t('filters.category'),
      clear: () => setParams({ category: null, subcategory: null }),
    })
  }
  if (filters.subcategoryId) {
    const name =
      filters.subcategoryId === SUBCATEGORY_NONE_MARKER
        ? t('filters.no_subcategory')
        : subcategories.find((s) => s.id === filters.subcategoryId)?.name ??
          t('filters.subcategory')
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
    router.replace(pathname)
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
              className={iconButtonCls}
              aria-label={t('filters.search')}
            >
              <Search size={16} />
            </button>
            <Link
              href="/transactions/recurring"
              className={iconButtonCls}
              aria-label={t('header.see_recurrences')}
            >
              <Repeat size={16} />
            </Link>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className={`${iconButtonCls} relative`}
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
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs hover:bg-muted transition-colors"
            >
              {chip.label}
              <X size={12} />
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
                      {category.name}
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
                        {subcategory.name}
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
                  <Input
                    id="f-amount-min"
                    type="number"
                    inputMode="decimal"
                    defaultValue={filters.amountMin ?? ''}
                    onBlur={(e) => setParams({ amount_min: e.target.value || null })}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="f-amount-max">{t('filters.amount_max')}</Label>
                  <Input
                    id="f-amount-max"
                    type="number"
                    inputMode="decimal"
                    defaultValue={filters.amountMax ?? ''}
                    onBlur={(e) => setParams({ amount_max: e.target.value || null })}
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
