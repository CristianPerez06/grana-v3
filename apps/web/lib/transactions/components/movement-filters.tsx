'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getTodayAR } from '@/lib/date'
import {
  MOVEMENT_TYPE_KEYS,
  monthOf,
  shiftMonth,
  type MovementFilters as MovementFiltersState,
} from '../filters'

type MovementFiltersProps = {
  filters: MovementFiltersState
  accounts: Array<{ id: string; name: string; type: 'cash' | 'bank' | 'credit' }>
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' | 'both' }>
  /** Expert mode shows the account filter; novato hides it. */
  isExpert: boolean
  /** Account detail view hides the account filter (already scoped to one account). */
  showAccountFilter?: boolean
}

/** Filters that narrow content (the count shown on the "Filtros" button). */
const activeContentCount = (f: MovementFiltersState) =>
  [f.type, f.categoryId, f.accountId, f.currency, f.amountMin, f.amountMax].filter(
    (v) => v != null,
  ).length

export const MovementFilters = ({
  filters,
  accounts,
  categories,
  isExpert,
  showAccountFilter = true,
}: MovementFiltersProps) => {
  const t = useTranslations('transactions')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(filters.query ?? '')

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

  // Fallback only hit in custom-range mode (the server parser always sets
  // `filters.month` otherwise). Use the financial timezone, never browser-local.
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
  if (filters.query) chips.push({ key: 'q', label: `"${filters.query}"`, clear: () => { setSearch(''); setParams({ q: null }) } })
  if (filters.type) chips.push({ key: 'type', label: t(`movement_kinds.${filters.type}`), clear: () => setParams({ type: null }) })
  if (filters.categoryId) {
    const c = categories.find((x) => x.id === filters.categoryId)
    chips.push({ key: 'category', label: c?.name ?? t('filters.category'), clear: () => setParams({ category: null }) })
  }
  if (filters.accountId) {
    const a = accounts.find((x) => x.id === filters.accountId)
    chips.push({ key: 'account', label: a?.name ?? t('filters.account'), clear: () => setParams({ account: null }) })
  }
  if (filters.currency) chips.push({ key: 'currency', label: filters.currency, clear: () => setParams({ currency: null }) })
  if (filters.amountMin != null) chips.push({ key: 'amount_min', label: `≥ ${filters.amountMin}`, clear: () => setParams({ amount_min: null }) })
  if (filters.amountMax != null) chips.push({ key: 'amount_max', label: `≤ ${filters.amountMax}`, clear: () => setParams({ amount_max: null }) })

  const clearAll = () => {
    setSearch('')
    router.replace(pathname)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Compact bar: search + month navigation + Filters button */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={16}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('filters.search_placeholder')}
            aria-label={t('filters.search')}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border px-1">
          <button
            type="button"
            aria-label={t('filters.prev_month')}
            onClick={() => goToMonth(shiftMonth(month, -1))}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} />
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
            <ChevronRight size={16} />
          </button>
        </div>

        <Button type="button" variant="secondary" onClick={() => setOpen((v) => !v)}>
          <SlidersHorizontal size={16} />
          {t('filters.filters_button')}
          {count > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </div>

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

      {/* Filters panel */}
      {open && (
        <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="f-type">{t('filters.type')}</Label>
            <select
              id="f-type"
              value={filters.type ?? ''}
              onChange={(e) => setParams({ type: e.target.value || null })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('filters.all_masc')}</option>
              {MOVEMENT_TYPE_KEYS.map((value) => (
                <option key={value} value={value}>
                  {t(`movement_kinds.${value}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="f-category">{t('filters.category')}</Label>
            <select
              id="f-category"
              value={filters.categoryId ?? ''}
              onChange={(e) => setParams({ category: e.target.value || null })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('filters.all_fem')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {isExpert && showAccountFilter && (
            <div className="space-y-2">
              <Label htmlFor="f-account">{t('filters.account')}</Label>
              <select
                id="f-account"
                value={filters.accountId ?? ''}
                onChange={(e) => setParams({ account: e.target.value || null })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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

          <div className="space-y-2">
            <Label htmlFor="f-currency">{t('filters.currency')}</Label>
            <select
              id="f-currency"
              value={filters.currency ?? ''}
              onChange={(e) => setParams({ currency: e.target.value || null })}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('filters.all_fem')}</option>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="f-amount-min">{t('filters.amount_min')}</Label>
            <Input
              id="f-amount-min"
              type="number"
              inputMode="decimal"
              defaultValue={filters.amountMin ?? ''}
              onBlur={(e) => setParams({ amount_min: e.target.value || null })}
            />
          </div>

          <div className="space-y-2">
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
      )}
    </div>
  )
}
