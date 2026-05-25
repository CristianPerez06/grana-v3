import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MOVEMENT_PERIOD_KEYS,
  MOVEMENT_TYPE_KEYS,
  type MovementFilters as MovementFiltersState,
} from '../filters'

type MovementFiltersProps = {
  filters: MovementFiltersState
  accounts: Array<{ id: string; name: string; type: 'cash' | 'bank' | 'credit' }>
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' | 'both' }>
}

const hasActiveFilters = (filters: MovementFiltersState) =>
  Boolean(
    filters.query ||
      filters.period ||
      filters.from ||
      filters.to ||
      filters.type ||
      filters.accountId ||
      filters.categoryId,
  )

export const MovementFilters = async ({ filters, accounts, categories }: MovementFiltersProps) => {
  const t = await getTranslations('transactions')

  return (
    <form action="/transactions" className="rounded-lg border border-border p-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="space-y-2">
          <Label htmlFor="q">{t('filters.search')}</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              id="q"
              name="q"
              defaultValue={filters.query}
              placeholder={t('filters.search_placeholder')}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="period">{t('filters.period')}</Label>
          <select
            id="period"
            name="period"
            defaultValue={filters.period ?? ''}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t('filters.all_masc')}</option>
            {MOVEMENT_PERIOD_KEYS.map((value) => (
              <option key={value} value={value}>
                {t(`periods.${value}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">{t('filters.type')}</Label>
          <select
            id="type"
            name="type"
            defaultValue={filters.type ?? ''}
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
          <Label htmlFor="account">{t('filters.account')}</Label>
          <select
            id="account"
            name="account"
            defaultValue={filters.accountId ?? ''}
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
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <div className="space-y-2">
          <Label htmlFor="category">{t('filters.category')}</Label>
          <select
            id="category"
            name="category"
            defaultValue={filters.categoryId ?? ''}
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

        <div className="space-y-2">
          <Label htmlFor="from">{t('filters.from')}</Label>
          <Input id="from" name="from" type="date" defaultValue={filters.from} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="to">{t('filters.to')}</Label>
          <Input id="to" name="to" type="date" defaultValue={filters.to} />
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit" className="w-full md:w-auto">
            {t('filters.apply')}
          </Button>
          {hasActiveFilters(filters) && (
            <Button asChild type="button" variant="secondary" className="w-full md:w-auto">
              <Link href="/transactions">
                <X size={16} />
                {t('filters.clear')}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
