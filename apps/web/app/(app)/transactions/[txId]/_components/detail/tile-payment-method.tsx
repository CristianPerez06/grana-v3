import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { TransactionAccount } from '@/lib/transactions/types'
import { Tile, TileHead } from './glance'
import { paymentMethodDescriptor } from './helpers'

// Tile "Pagado con": badge de color por tipo + nombre de la cuenta + etiqueta
// de tipo. NUNCA un número de tarjeta (app de gestión). `meta` es la fila
// inferior opcional (ya devolvieron, acumulado, etc.).

type Props = {
  account: TransactionAccount | null | undefined
  eyebrow?: string
  /** Override the type sublabel (e.g. "Pagaste el total", "Débito automático"). */
  subOverride?: ReactNode
  /** Optional bottom meta row (icon + text), shown with a top divider. */
  meta?: ReactNode
  span2?: boolean
}

export const TilePaymentMethod = ({ account, eyebrow, subOverride, meta, span2 }: Props) => {
  const t = useTranslations('transactions.detail')
  const d = paymentMethodDescriptor(account)
  if (!d) return null
  const Icon = d.icon

  return (
    <Tile span2={span2}>
      <TileHead eyebrow={eyebrow ?? t('groups.paid_with')} />
      <div className="flex items-center gap-3.5">
        <span className={`grid size-[52px] shrink-0 place-items-center rounded-[14px] text-white ${d.badgeClass}`}>
          <Icon size={24} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-[16.5px] font-extrabold tracking-[-0.02em] text-text">{d.name}</div>
          <div className="mt-0.5 text-[13px] font-semibold text-text-muted">
            {subOverride ?? t(`payment_sub.${d.subKey}`)}
          </div>
        </div>
      </div>
      {meta != null && (
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3.5 text-[13.5px] font-semibold text-text-muted [&_b]:font-bold [&_b]:text-text [&_svg]:size-[15px] [&_svg]:shrink-0 [&_svg]:text-slate">
          {meta}
        </div>
      )}
    </Tile>
  )
}
