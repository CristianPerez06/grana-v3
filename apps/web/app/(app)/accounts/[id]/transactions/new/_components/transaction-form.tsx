'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getTodayAR } from '@/lib/date'
import { createIncome, createExpense } from '@/app/_actions/transactions'
import type { CategoryWithSubcategories } from '@/lib/categories/types'

const todayStr = () => {
  const d = getTodayAR()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type Tab = 'income' | 'expense'

type Props = {
  accountId: string
  activeCurrencies: ('ARS' | 'USD')[]
  categories: CategoryWithSubcategories[]
}

export const TransactionForm = ({ accountId, activeCurrencies, categories }: Props) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>('income')
  const [formError, setFormError] = useState<string | null>(null)

  const [currencyCode, setCurrencyCode] = useState<'ARS' | 'USD'>(activeCurrencies[0] ?? 'ARS')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [description, setDescription] = useState('')

  const expenseCategories = categories.filter(
    (c) => c.type === 'expense' || c.type === 'both',
  )
  const selectedCategory = expenseCategories.find((c) => c.id === categoryId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const payload = {
      account_id: accountId,
      currency_code: currencyCode,
      amount: parseFloat(amount),
      date,
      category_id: categoryId || undefined,
      subcategory_id: subcategoryId || undefined,
      description: description || undefined,
    }

    startTransition(async () => {
      const result = tab === 'income'
        ? await createIncome(payload)
        : await createExpense(payload)

      if (!result.ok) {
        setFormError(result.formError ?? 'Error al guardar el movimiento.')
        return
      }

      router.push(`/accounts/${accountId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Tabs */}
      <div className="flex rounded-md border border-border p-0.5 w-fit">
        {(['income', 'expense'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setTab(t); setCategoryId(''); setSubcategoryId('') }}
            className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
              tab === t
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'income' ? 'Ingreso' : 'Gasto'}
          </button>
        ))}
      </div>

      {/* Currency selector (only when multiple active) */}
      {activeCurrencies.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Moneda</label>
          <div className="flex gap-2">
            {activeCurrencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrencyCode(c)}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  currencyCode === c
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:border-foreground'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Amount */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="amount" className="text-sm font-medium">Monto</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {currencyCode === 'ARS' ? '$' : 'U$D'}
          </span>
          <input
            id="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="date" className="text-sm font-medium">Fecha</label>
        <input
          id="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Category (expense only, required) */}
      {tab === 'expense' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-medium">
            Categoría <span className="text-destructive">*</span>
          </label>
          <select
            id="category"
            required
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId('') }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Seleccioná una categoría</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Category (income, optional) */}
      {tab === 'income' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-medium">
            Categoría <span className="text-muted-foreground text-xs">(opcional)</span>
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId('') }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Sin categoría</option>
            {categories
              .filter((c) => c.type === 'income' || c.type === 'both')
              .map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>
        </div>
      )}

      {/* Subcategory (optional, shown when category has subcategories) */}
      {selectedCategory && selectedCategory.subcategories.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="subcategory" className="text-sm font-medium">
            Subcategoría <span className="text-muted-foreground text-xs">(opcional)</span>
          </label>
          <select
            id="subcategory"
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Sin subcategoría</option>
            {selectedCategory.subcategories.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Descripción <span className="text-muted-foreground text-xs">(opcional)</span>
        </label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción opcional"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {formError && (
        <p className="text-sm text-destructive">{formError}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
