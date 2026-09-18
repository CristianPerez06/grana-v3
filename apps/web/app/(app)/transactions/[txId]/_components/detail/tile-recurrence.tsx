import Link from 'next/link'
import { Clock, Repeat } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Tile, TileHead, DetailRow } from './glance'
import { formatLongDate, formatMonthShort, formatMonthYear } from './helpers'
import type { RecurrenceSummaryVM } from './recurrence-summary'

/**
 * Tile "Recurrencia": de qué regla viene este movimiento · próximo cobro ·
 * activa desde · nº de cobros.
 *
 * LA RELACIÓN VA ACÁ Y NO ARRIBA DE TODO. Antes era una línea que la página
 * dibujaba ANTES del detalle, así que caía encima del «‹ Movimientos» y fuera de
 * la grilla, flotando; y decía, en otras palabras, lo mismo que esta tarjeta.
 * Una sola vez, en el lugar donde el usuario ya viene a preguntar de qué regla
 * se trata.
 */
export const TileRecurrence = ({
  summary,
  relation,
}: {
  summary: RecurrenceSummaryVM
  /** Cómo quedó atado a la regla, y adónde ir para verla. */
  relation?: { href: string; text: string } | null
}) => {
  const t = useTranslations('transactions.detail')
  const tLink = useTranslations('recurrences.link')

  return (
    <Tile>
      <TileHead eyebrow={t('recurrence.eyebrow')} />
      {relation ? (
        <DetailRow
          first
          icon={<Repeat size={16} strokeWidth={2} aria-hidden />}
          label={tLink('relation_row_label')}
          value={
            <Link href={relation.href} className="underline decoration-border underline-offset-4 hover:decoration-text">
              {relation.text}
            </Link>
          }
        />
      ) : null}
      <DetailRow
        first={!relation}
        icon={<Clock size={16} strokeWidth={2} aria-hidden />}
        label={t('recurrence.next_charge')}
        value={summary.nextDate ? formatLongDate(summary.nextDate) : '—'}
      />
      <DetailRow
        icon={<Repeat size={16} strokeWidth={2} aria-hidden />}
        label={t('recurrence.active_since')}
        value={t('recurrence.since_count', {
          since: formatMonthYear(summary.startDate),
          count: summary.confirmedCount,
        })}
      />
    </Tile>
  )
}

// Tile "Historial de cobros": barras de los últimos 6 cobros.
export const TileRecurrenceHistory = ({ summary }: { summary: RecurrenceSummaryVM }) => {
  const t = useTranslations('transactions.detail')
  if (!summary.history.length) return null

  const max = Math.max(...summary.history.map((b) => b.amount), 1)

  return (
    <Tile span2>
      <TileHead eyebrow={t('recurrence.history')} aside={t('recurrence.last_6')} asideMuted />
      <div className="mt-1 flex h-[84px] items-end gap-2">
        {summary.history.map((bar) => (
          <div key={bar.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[10.5px] font-bold tabular-nums text-text">
              {Math.round(bar.amount).toLocaleString('es-AR')}
            </span>
            <div
              className="w-full max-w-[30px] rounded-t-[6px]"
              style={{
                height: `${Math.max(8, (bar.amount / max) * 100)}%`,
                background: bar.isCurrent ? 'var(--tone)' : 'var(--tone-soft)',
              }}
            />
            <span className="text-[11px] font-bold capitalize text-text-muted">
              {formatMonthShort(bar.date)}
            </span>
          </div>
        ))}
      </div>
    </Tile>
  )
}
