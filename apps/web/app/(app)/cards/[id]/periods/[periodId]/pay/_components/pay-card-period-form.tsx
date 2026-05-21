'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getTodayAR } from '@/lib/date'
import { payCardPeriod } from '@/app/_actions/credit-cards'
import { parseMoneyInput } from '@grana/validation'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'

const todayStr = () => {
  const d = getTodayAR()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatARS = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

type PaymentAccount = {
  id: string
  name: string
  balanceARS: number
}

type Props = {
  periodId: string
  cardId: string
  pendingAmountARS: number
  suggestedNextEndDate: string
  suggestedNextDueDate: string
  paymentAccounts: PaymentAccount[]
}

export const PayCardPeriodForm = ({
  periodId,
  cardId,
  pendingAmountARS,
  suggestedNextEndDate,
  suggestedNextDueDate,
  paymentAccounts,
}: Props) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [amount, setAmount] = useState(String(pendingAmountARS))
  const [paymentAccountId, setPaymentAccountId] = useState(paymentAccounts[0]?.id ?? '')
  const [paymentDate, setPaymentDate] = useState(todayStr())
  const [nextEndDate, setNextEndDate] = useState(suggestedNextEndDate)
  const [nextDueDate, setNextDueDate] = useState(suggestedNextDueDate)

  const validate = () => {
    const errs: Record<string, string> = {}
    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) errs.amount = 'El monto debe ser mayor a cero.'
    if (!paymentAccountId) errs.paymentAccountId = 'Seleccioná una cuenta.'
    if (!paymentDate) errs.paymentDate = 'Requerido.'
    if (!nextEndDate) errs.nextEndDate = 'Requerido.'
    if (!nextDueDate) errs.nextDueDate = 'Requerido.'
    if (nextEndDate && nextDueDate && nextDueDate <= nextEndDate) {
      errs.nextDueDate = 'El vencimiento debe ser posterior al cierre.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setFormError(null)
    startTransition(async () => {
      const result = await payCardPeriod({
        period_id: periodId,
        amount: parseMoneyInput(amount) ?? 0,
        payment_account_id: paymentAccountId,
        payment_date: paymentDate,
        next_end_date: nextEndDate,
        next_due_date: nextDueDate,
      })

      if (!result.ok) {
        setFormError(result.formError ?? 'Error al registrar el pago.')
        return
      }

      router.push(`/cards/${cardId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* Section 1: Payment data */}
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Datos del pago
        </h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Monto a pagar</label>
          <p className="text-xs text-muted-foreground mb-1">
            Pre-llenado con el total pendiente ({formatARS(pendingAmountARS)}). Podés editarlo.
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <MoneyAmountInput
              required
              value={amount}
              onChange={setAmount}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Cuenta de débito</label>
          <select
            required
            value={paymentAccountId}
            onChange={(e) => setPaymentAccountId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {paymentAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {formatARS(a.balanceARS)}
              </option>
            ))}
          </select>
          {errors.paymentAccountId && <p className="text-xs text-destructive">{errors.paymentAccountId}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Fecha del pago</label>
          <input
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate}</p>}
        </div>
      </div>

      {/* Section 2: Next period dates */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Próximo resumen
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Confirmá las fechas del próximo ciclo (sugeridas por el historial).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Cierre</label>
            <input
              type="date"
              required
              value={nextEndDate}
              onChange={(e) => setNextEndDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.nextEndDate && <p className="text-xs text-destructive">{errors.nextEndDate}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Vencimiento</label>
            <input
              type="date"
              required
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.nextDueDate && <p className="text-xs text-destructive">{errors.nextDueDate}</p>}
          </div>
        </div>
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <p className="text-xs text-muted-foreground rounded-md bg-muted px-3 py-2">
        Una vez confirmado, el pago no se puede revertir. Si registraste un monto o cuenta incorrectos, podés corregirlo con un ajuste de saldo.
      </p>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Procesando…' : 'Confirmar pago'}
      </button>
    </form>
  )
}
