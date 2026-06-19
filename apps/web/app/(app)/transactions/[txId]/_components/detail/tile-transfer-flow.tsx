import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { TransactionAccount } from '@/lib/transactions/types'
import { Alert } from '@/components/ui/alert'
import { Tile, TileHead } from './glance'
import { paymentMethodDescriptor } from './helpers'

// Tile "Movimiento de dinero": origen → destino. En mobile se apila con la
// flecha rotada. Debajo, un callout aclara que no afecta el balance del mes.

const Node = ({
  account,
  badgeClass,
  kindLabel,
  subLabel,
}: {
  account: TransactionAccount | null | undefined
  badgeClass: string
  kindLabel: string
  subLabel: string
}) => {
  const d = paymentMethodDescriptor(account)
  const Icon = d?.icon ?? ArrowRight
  return (
    <div className="flex flex-1 items-center gap-3 rounded-[16px] border border-border p-4">
      <span className={`grid size-11 shrink-0 place-items-center rounded-[12px] text-white ${badgeClass}`}>
        <Icon size={21} strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-text-muted">{kindLabel}</div>
        <div className="mt-0.5 truncate text-[14px] font-extrabold tracking-[-0.02em] text-text sm:text-[15px]">
          {account?.name ?? '—'}
        </div>
        <div className="mt-px text-[12px] font-semibold text-text-muted">{subLabel}</div>
      </div>
    </div>
  )
}

type Props = {
  source: TransactionAccount | null | undefined
  destination: TransactionAccount | null | undefined
}

export const TileTransferFlow = ({ source, destination }: Props) => {
  const t = useTranslations('transactions.detail')
  const subFor = (a: TransactionAccount | null | undefined) => {
    const d = paymentMethodDescriptor(a)
    return d ? t(`payment_sub.${d.subKey}`) : ''
  }

  return (
    <Tile span2>
      <TileHead eyebrow={t('transfer.flow')} />
      <div className="flex flex-col items-center gap-2.5 sm:flex-row sm:gap-3.5">
        <Node
          account={source}
          badgeClass="bg-slate"
          kindLabel={t('transfer.from')}
          subLabel={subFor(source)}
        />
        <span className="grid size-10 shrink-0 rotate-90 place-items-center rounded-full bg-slate-soft text-slate sm:rotate-0">
          <ArrowRight size={20} strokeWidth={2.4} aria-hidden />
        </span>
        <Node
          account={destination}
          badgeClass="bg-emerald"
          kindLabel={t('transfer.to')}
          subLabel={subFor(destination)}
        />
      </div>
    </Tile>
  )
}

export const TileTransferCallout = () => {
  const t = useTranslations('transactions.detail')
  return (
    <Tile span2>
      <Alert variant="info" title={t('transfer.callout_title')}>
        {t('transfer.callout_body')}
      </Alert>
    </Tile>
  )
}
