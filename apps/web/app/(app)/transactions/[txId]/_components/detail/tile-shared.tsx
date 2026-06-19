'use client'

import { useTranslations } from 'next-intl'
import { useShowCents } from '@/lib/preferences-context'
import type { MovementSharedInfo } from '@/lib/shared/queries'
import { Tile, TileHead } from './glance'
import { fmtMoney } from './helpers'

// Tiles del gasto compartido. "Te toca pagar" = tu parte; "Dividido entre"
// lista a cada persona con SU parte.
//
// TODO(settlement): el modelo no guarda el estado de liquidación por
// transacción (quién ya pagó / te debe), solo la deuda agregada del hogar. Por
// eso NO mostramos el badge Te debe/Saldado del mockup — solo los montos.

const AVATAR_PALETTE = [
  'bg-account-slate',
  'bg-account-plum',
  'bg-account-teal',
  'bg-account-magenta',
  'bg-account-indigo',
  'bg-account-clay',
]

const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '—'

type DividedProps = {
  shared: MovementSharedInfo
  currency: 'ARS' | 'USD'
}

export const TileShareYours = ({ shared, total, currency }: { shared: MovementSharedInfo; total: number; currency: 'ARS' | 'USD' }) => {
  const t = useTranslations('transactions.detail')
  const showCents = useShowCents()
  return (
    <Tile>
      <TileHead eyebrow={t('shared.your_share')} />
      <div className="text-[30px] font-extrabold tracking-[-0.04em] tabular-nums sm:text-[34px]" style={{ color: 'var(--tone)' }}>
        {fmtMoney(shared.ownShare, currency, showCents)}
      </div>
      <div className="mt-1 text-[13.5px] font-semibold text-text-muted">
        {t('shared.your_share_of', { total: fmtMoney(total, currency, showCents) })}
      </div>
    </Tile>
  )
}

export const TileDividedAmong = ({ shared, currency }: DividedProps) => {
  const t = useTranslations('transactions.detail')
  const showCents = useShowCents()

  const people = [
    { name: t('shared.you'), amount: shared.ownShare, isYou: true },
    ...shared.bySplit.map((s) => ({ name: s.name || '—', amount: s.amount, isYou: false })),
  ]
  const amounts = people.map((p) => p.amount)
  const allEqual = amounts.every((a) => Math.abs(a - amounts[0]!) < 0.005)

  return (
    <Tile span2>
      <TileHead
        eyebrow={t('shared.divided_among')}
        aside={allEqual ? t('shared.each', { amount: fmtMoney(amounts[0]!, currency, showCents) }) : undefined}
        asideMuted
      />
      <div className="flex flex-col">
        {people.map((p, i) => (
          <div key={`${p.name}-${i}`} className="flex items-center gap-3.5 border-t border-border py-3 first:border-t-0">
            <span
              className={`grid size-[38px] shrink-0 place-items-center rounded-full text-[13.5px] font-extrabold text-white ${p.isYou ? '' : AVATAR_PALETTE[(i - 1) % AVATAR_PALETTE.length]}`}
              style={p.isYou ? { background: 'var(--tone)' } : undefined}
            >
              {initialsOf(p.name)}
            </span>
            <div className="min-w-0">
              <div className="text-[14.5px] font-bold tracking-[-0.01em] text-text">{p.name}</div>
            </div>
            <div className="ml-auto text-[15px] font-extrabold tabular-nums text-text">
              {fmtMoney(p.amount, currency, showCents)}
            </div>
          </div>
        ))}
      </div>
    </Tile>
  )
}
