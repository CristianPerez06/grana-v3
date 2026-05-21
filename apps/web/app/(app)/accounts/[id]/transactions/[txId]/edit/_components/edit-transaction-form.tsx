'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { TransactionWithDetails } from '@/lib/transactions/types'
import type { CategoryWithSubcategories } from '@/lib/categories/types'
import { updateTransaction, updateTransfer, updateAdjustment } from '@/app/_actions/transactions'
import { parseMoneyInput } from '@grana/validation'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'

const TYPE_LABELS = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
  adjustment: 'Ajuste',
}

type Props = {
  transaction: TransactionWithDetails
  accountId: string
  categories: CategoryWithSubcategories[]
}

export const EditTransactionForm = ({ transaction, accountId, categories }: Props) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const { type } = transaction

  // For income/expense, amount is always positive in DB
  // For adjustment, amount is signed — we show absolute value + direction radio
  const absAmount = Math.abs(transaction.amount)
  const initialDirection: 'increase' | 'decrease' =
    type === 'adjustment' && transaction.amount < 0 ? 'decrease' : 'increase'

  const [amount, setAmount] = useState(String(absAmount))
  const [date, setDate] = useState(transaction.date)
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? '')
  const [subcategoryId, setSubcategoryId] = useState(transaction.subcategory_id ?? '')
  const [description, setDescription] = useState(transaction.description ?? '')
  const [adjustmentDirection, setAdjustmentDirection] = useState<'increase' | 'decrease'>(
    initialDirection,
  )

  const isExpense = type === 'expense'
  const isCardPayment =
    Array.isArray(transaction.period_payments) && transaction.period_payments.length > 0
  const filteredCategories = categories.filter(
    (c) =>
      isExpense
        ? c.type === 'expense' || c.type === 'both'
        : c.type === 'income' || c.type === 'both',
  )
  const selectedCategory = filteredCategories.find((c) => c.id === categoryId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) {
      setFormError('El monto debe ser mayor a cero.')
      return
    }

    startTransition(async () => {
      let result

      if (type === 'transfer') {
        result = await updateTransfer(
          transaction.id,
          accountId,
          transaction.transfer_destination_account_id ?? '',
          {
            amount: parsedAmount,
            date,
            description: description || null,
          },
        )
      } else if (type === 'adjustment') {
        const signedAmount =
          adjustmentDirection === 'decrease'
            ? -Math.abs(parsedAmount)
            : Math.abs(parsedAmount)
        result = await updateAdjustment(transaction.id, accountId, {
          amount: signedAmount,
          date,
          description: description || null,
        })
      } else {
        result = await updateTransaction(transaction.id, accountId, {
          amount: parsedAmount,
          date,
          category_id: categoryId || null,
          subcategory_id: subcategoryId || null,
          description: description || null,
        })
      }

      if (!result.ok) {
        setFormError(result.formError ?? 'Error al guardar.')
        return
      }

      router.push(`/accounts/${accountId}/transactions/${transaction.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Read-only fields */}
      <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tipo</span>
          <span>
            {TYPE_LABELS[type]}
            <span className="ml-2 text-xs text-muted-foreground">— no editable</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Moneda</span>
          <span>
            {transaction.currency_code}
            <span className="ml-2 text-xs text-muted-foreground">— no editable</span>
          </span>
        </div>
        {type === 'transfer' && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cuenta origen</span>
              <span>
                {transaction.source_account?.name ?? accountId}
                <span className="ml-2 text-xs text-muted-foreground">— no editable</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cuenta destino</span>
              <span>
                {transaction.destination_account?.name ?? '—'}
                <span className="ml-2 text-xs text-muted-foreground">— no editable</span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* Adjustment direction */}
      {type === 'adjustment' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Dirección</label>
          <div className="flex gap-3">
            {(['increase', 'decrease'] as const).map((dir) => (
              <label key={dir} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="direction"
                  value={dir}
                  checked={adjustmentDirection === dir}
                  onChange={() => setAdjustmentDirection(dir)}
                  className="accent-primary"
                />
                <span className="text-sm">{dir === 'increase' ? 'Suma' : 'Resta'}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Amount */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="amount" className="text-sm font-medium">Monto</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {transaction.currency_code === 'ARS' ? '$' : 'U$D'}
          </span>
          <MoneyAmountInput
            id="amount"
            required
            value={amount}
            onChange={setAmount}
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

      {/* Category (income/expense only). Card payment expenses have no
          category — payCardPeriod inserts them with category_id=null on
          purpose, so hide the field entirely for them. */}
      {(type === 'income' || type === 'expense') && !isCardPayment && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-medium">
            Categoría {isExpense && <span className="text-destructive">*</span>}
            {!isExpense && <span className="text-muted-foreground text-xs ml-1">(opcional)</span>}
          </label>
          <select
            id="category"
            required={isExpense}
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId('') }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Sin categoría</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Subcategory */}
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

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  )
}
