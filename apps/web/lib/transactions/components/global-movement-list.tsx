'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  CreditCard,
  Repeat,
  Scale,
  Tag,
} from 'lucide-react'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import type { FinancialMovement, MovementReviewFlag } from '../movements'

const formatDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

const formatAmount = (amount: number, currency: 'ARS' | 'USD', showCents: boolean) =>
  currency === 'ARS' ? formatARS(amount, showCents) : formatUSD(amount, showCents)

const reviewLabel: Record<MovementReviewFlag, string> = {
  missing_category: 'Sin categoría',
  missing_fx_rate: 'Revisar cotización',
}

const movementIcon = {
  income: ArrowDownLeft,
  expense: Tag,
  card_payment: CreditCard,
  transfer: ArrowLeftRight,
  adjustment: Scale,
  installment_purchase: CreditCard,
} satisfies Record<FinancialMovement['kind'], React.ComponentType<{ className?: string; size?: number }>>

const movementTone = (movement: FinancialMovement) => {
  if (movement.kind === 'income') return 'text-green-600'
  if (movement.kind === 'adjustment' && movement.sign === '+') return 'text-green-600'
  return 'text-foreground'
}

const movementSubtitle = (movement: FinancialMovement) => {
  if (movement.kind === 'transfer') {
    return `${movement.account_name ?? 'Cuenta origen'} → ${movement.destination_account_name ?? 'Cuenta destino'}`
  }

  if (movement.kind === 'installment_purchase') {
    return movement.installments_total
      ? `${movement.installments_total} cuotas`
      : 'Compra en cuotas'
  }

  if (movement.kind === 'card_payment') {
    return movement.account_name ? `Desde ${movement.account_name}` : 'Pago de tarjeta'
  }

  return movement.description ?? movement.account_name ?? null
}

type Props = {
  movements: FinancialMovement[]
  recurrenceLinkedIds?: Set<string>
}

export const GlobalMovementList = ({ movements, recurrenceLinkedIds }: Props) => {
  const showCents = useShowCents()

  if (movements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-sm font-medium text-foreground">Todavía no hay movimientos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando registres ingresos, gastos, transferencias o consumos, van a aparecer acá.
        </p>
      </div>
    )
  }

  const grouped = new Map<string, FinancialMovement[]>()
  for (const movement of movements) {
    const existing = grouped.get(movement.date) ?? []
    existing.push(movement)
    grouped.set(movement.date, existing)
  }

  return (
    <div className="flex flex-col gap-5">
      {Array.from(grouped.entries()).map(([date, dayMovements]) => (
        <section key={date}>
          <p className="mb-2 text-xs font-medium text-muted-foreground capitalize">
            {formatDate(date)}
          </p>
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {dayMovements.map((movement) => {
              const Icon = movementIcon[movement.kind]
              const isRecurrent = recurrenceLinkedIds?.has(movement.id) ?? false
              const content = (
                <div className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{movement.title}</span>
                        {isRecurrent && (
                          <Repeat
                            size={12}
                            className="shrink-0 text-muted-foreground"
                            aria-label="Generado por una regla recurrente"
                          />
                        )}
                        {movement.review_flags.length > 0 && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                            <AlertTriangle size={12} />
                            Revisar
                          </span>
                        )}
                      </div>
                      {movementSubtitle(movement) && (
                        <p className="truncate text-xs text-muted-foreground">
                          {movementSubtitle(movement)}
                        </p>
                      )}
                      {movement.review_flags.length > 0 && (
                        <p className="mt-1 text-[11px] text-amber-700">
                          {movement.review_flags.map((flag) => reviewLabel[flag]).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-semibold tabular-nums ${movementTone(movement)}`}>
                      {movement.sign}
                      {formatAmount(movement.amount, movement.currency_code, showCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">{movement.currency_code}</p>
                  </div>
                </div>
              )

              if (!movement.detail_href) {
                return <div key={movement.id}>{content}</div>
              }

              return (
                <Link key={movement.id} href={`${movement.detail_href}?from=transactions`}>
                  {content}
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
