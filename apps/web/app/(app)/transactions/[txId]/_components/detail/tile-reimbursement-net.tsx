'use client'

import Link from 'next/link'
import { ChevronRight, FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useShowCents } from '@/lib/preferences-context'
import type { ExpenseReimbursementVM } from '@/lib/transactions/queries'
import { Tile, TileHead } from './glance'
import { fmtMoney, formatShortDate } from './helpers'

// Tile "Resultado neto": pagaste + reintegro = costo neto, con los reintegros
// vinculados clickeables hacia su propio detalle.

type Props = {
  paid: number
  currency: 'ARS' | 'USD'
  reimbursements: ExpenseReimbursementVM[]
}

export const TileReimbursementNet = ({ paid, currency, reimbursements }: Props) => {
  const t = useTranslations('transactions')
  const showCents = useShowCents()

  const received = reimbursements.filter((r) => r.state === 'received')
  const reimbursed = received.reduce((sum, r) => sum + r.amount, 0)
  const net = paid - reimbursed

  const parts = [
    { key: 'paid', label: t('detail.reimbursement_net.paid'), value: `−${fmtMoney(paid, currency, showCents)}`, cls: 'text-expense' },
    { key: 'reimbursed', label: t('detail.reimbursement_net.reimbursed'), value: `+${fmtMoney(reimbursed, currency, showCents)}`, cls: 'text-income' },
    { key: 'net', label: t('detail.reimbursement_net.net'), value: `−${fmtMoney(net, currency, showCents)}`, cls: 'text-text' },
  ]
  const ops = ['+', '=']

  return (
    <Tile span2>
      <TileHead eyebrow={t('detail.reimbursement_net.eyebrow')} aside={t('detail.reimbursement_net.caption')} asideMuted />

      {/* Mobile: apilado vertical (los montos tabulares no caben en 3 columnas) */}
      <div className="flex flex-col gap-2 sm:hidden">
        {parts.map((p, i) => (
          <div key={p.key}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-muted">{p.label}</span>
              <span className={`text-[20px] font-extrabold tabular-nums ${p.cls}`}>{p.value}</span>
            </div>
            {i < ops.length && (
              <div className="py-0.5 text-center text-[15px] font-bold leading-none text-text-soft">{ops[i]}</div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: fila de 3 columnas con operadores */}
      <div className="hidden items-stretch sm:flex">
        {parts.map((p, i) => (
          <div key={p.key} className="contents">
            <div className="flex-1 px-2 text-center">
              <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.07em] text-text-muted">{p.label}</div>
              <div className={`text-[23px] font-extrabold tracking-[-0.03em] tabular-nums ${p.cls}`}>{p.value}</div>
            </div>
            {i < ops.length && (
              <div className="grid w-[30px] shrink-0 place-items-center text-[22px] font-bold text-text-soft">{ops[i]}</div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {reimbursements.map((r) => {
          const amount = `+${fmtMoney(r.amount, r.currencyCode, showCents)}`
          return (
            <Link
              key={r.id}
              href={`/transactions/${r.id}`}
              className="flex items-center gap-3 rounded-[14px] bg-emerald-soft px-3.5 py-3 transition-[filter] hover:brightness-[0.98]"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-emerald text-white">
                <FileText size={18} strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold uppercase tracking-[0.05em] text-emerald-deep">
                  {t('detail.reimbursement_net.linked')}
                </div>
                <div className="mt-px text-[13.5px] font-semibold text-text">
                  {t(`reimbursement.state.${r.state}`)}
                </div>
                <div className="text-[12.5px] font-medium text-text-muted whitespace-nowrap">
                  {formatShortDate(r.date)}
                </div>
                {/* Mobile: el monto en su propia línea (no compite por ancho). */}
                <div className="mt-1 text-[16px] font-extrabold tabular-nums text-emerald-deep sm:hidden">
                  {amount}
                </div>
              </div>
              {/* Desktop: el monto a la derecha. */}
              <div className="hidden shrink-0 text-[16px] font-extrabold tabular-nums text-emerald-deep sm:block">
                {amount}
              </div>
              <ChevronRight size={18} strokeWidth={2.2} className="shrink-0 self-center text-emerald-deep" aria-hidden />
            </Link>
          )
        })}
      </div>
    </Tile>
  )
}
