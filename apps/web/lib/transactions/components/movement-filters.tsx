import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MOVEMENT_PERIOD_LABELS,
  MOVEMENT_TYPE_LABELS,
  type MovementFilters as MovementFiltersState,
} from '../filters'

type MovementFiltersProps = {
  filters: MovementFiltersState
  accounts: Array<{ id: string; name: string; type: 'cash' | 'bank' | 'credit' }>
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' | 'both' }>
}

const accountTypeLabel = {
  cash: 'Efectivo',
  bank: 'Cuenta',
  credit: 'Tarjeta',
} satisfies Record<'cash' | 'bank' | 'credit', string>

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

export const MovementFilters = ({ filters, accounts, categories }: MovementFiltersProps) => (
  <form action="/transactions" className="rounded-lg border border-border p-4">
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
      <div className="space-y-2">
        <Label htmlFor="q">Buscar</Label>
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
            placeholder="Descripción, cuenta o texto visible"
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="period">Período</Label>
        <select
          id="period"
          name="period"
          defaultValue={filters.period ?? ''}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos</option>
          {Object.entries(MOVEMENT_PERIOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Tipo</Label>
        <select
          id="type"
          name="type"
          defaultValue={filters.type ?? ''}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos</option>
          {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="account">Cuenta</Label>
        <select
          id="account"
          name="account"
          defaultValue={filters.accountId ?? ''}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todas</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {accountTypeLabel[account.type]}
            </option>
          ))}
        </select>
      </div>
    </div>

    <div className="mt-4 grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
      <div className="space-y-2">
        <Label htmlFor="category">Categoría</Label>
        <select
          id="category"
          name="category"
          defaultValue={filters.categoryId ?? ''}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="from">Desde</Label>
        <Input id="from" name="from" type="date" defaultValue={filters.from} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="to">Hasta</Label>
        <Input id="to" name="to" type="date" defaultValue={filters.to} />
      </div>

      <div className="flex items-end gap-2">
        <Button type="submit" className="w-full md:w-auto">
          Aplicar
        </Button>
        {hasActiveFilters(filters) && (
          <Button asChild type="button" variant="secondary" className="w-full md:w-auto">
            <Link href="/transactions">
              <X size={16} />
              Limpiar
            </Link>
          </Button>
        )}
      </div>
    </div>
  </form>
)
