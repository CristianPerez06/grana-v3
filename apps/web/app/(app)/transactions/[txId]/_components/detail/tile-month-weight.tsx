import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Tile, TileHead } from './glance'

// Tile "Peso en el mes": anillo de un solo valor (misma técnica SVG que el
// donut del dashboard, dark-mode safe) + titular y nota. El % y la nota los
// arma el orquestador (gasto: peso de la categoría; ingreso: % de ingresos).

type Props = {
  /** Ring fill 0–100. */
  pct: number
  /** Small uppercase caption inside the ring (category name or "Ingresos"). */
  cap: string
  headline: string
  note: ReactNode
}

export const TileMonthWeight = ({ pct, cap, headline, note }: Props) => {
  const t = useTranslations('transactions.detail')
  const clamped = Math.max(0, Math.min(100, pct))
  const rounded = Math.round(clamped)

  return (
    <Tile span2>
      <TileHead eyebrow={t('groups.month_weight')} />
      <div className="flex items-center gap-4 sm:gap-[22px]">
        <div className="relative size-24 shrink-0 sm:size-[110px]">
          <svg viewBox="0 0 36 36" className="size-full" role="img" aria-hidden>
            <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border-soft)" strokeWidth="4" />
            <circle
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke="var(--tone)"
              strokeWidth="4"
              strokeDasharray={`${clamped} ${100 - clamped}`}
              strokeDashoffset="0"
              transform="rotate(-90 18 18)"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[24px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-text">
              {rounded}%
            </span>
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-text-muted">
              {cap}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[17px] font-extrabold tracking-[-0.02em] text-text">{headline}</div>
          <p className="mt-1.5 text-[13.5px] font-medium leading-[1.5] text-text-muted [&_b]:font-bold [&_b]:text-text">
            {note}
          </p>
        </div>
      </div>
    </Tile>
  )
}
