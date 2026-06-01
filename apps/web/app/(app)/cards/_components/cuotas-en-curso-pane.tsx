import { useTranslations } from 'next-intl'
import { CreditCard } from 'lucide-react'
import { formatARS } from '@grana/i18n-messages'
import { Card } from '@/components/ui/card'
import type { ActiveInstallment } from '@/lib/cards/queries'
import { CuotaProgressDots } from './cuota-progress-dots'
import { formatDayMonth } from './card-presentation'

type Props = {
  items: ActiveInstallment[]
  totalRemaining: number
  accent: string
  showCents?: boolean
}

/**
 * "Cuotas en curso" pane: an intro card with the total remaining, then a card
 * per installment purchase with progress dots and a footer (per installment /
 * remaining / next due). Empty state when there are no active installments.
 */
export const CuotasEnCursoPane = ({ items, totalRemaining, accent, showCents = false }: Props) => {
  const t = useTranslations('cards')

  if (items.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-border p-12 text-center">
        <p className="text-sm font-semibold text-text">{t('detail.cuotas_empty_title')}</p>
        <p className="mt-1 text-sm text-text-muted">{t('detail.cuotas_empty_body')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between gap-4 p-5">
        <p className="min-w-0 text-sm text-text-muted">
          {t.rich('detail.cuotas_intro', {
            meta: t('detail.cuotas_meta', { count: items.length }),
            b: (chunks) => <b className="font-semibold text-text">{chunks}</b>,
          })}
        </p>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {t('detail.cuotas_total_remaining')}
          </p>
          <p className="text-lg font-extrabold tabular-nums">{formatARS(totalRemaining, showCents)}</p>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {items.map((q) => (
          <Card key={q.parentId} className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: accent }}
                aria-hidden
              >
                <CreditCard size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{q.name}</p>
                <p className="truncate text-xs text-text-muted">
                  {t('detail.cuotas_purchased', { date: formatDayMonth(q.purchaseDate) })}
                  {q.categoryName ? ` · ${q.categoryName}` : ''}
                </p>
              </div>
              <p className="shrink-0 text-sm font-extrabold tabular-nums">
                {q.paidCount}
                <span className="text-text-soft">/{q.total}</span>
              </p>
            </div>

            <CuotaProgressDots paid={q.paidCount} total={q.total} accent={accent} />

            <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
              <FooterStat label={t('detail.cuotas_per_installment')} value={formatARS(q.perInstallment, showCents)} />
              <FooterStat
                label={t('detail.cuotas_remaining')}
                value={formatARS(q.remaining, showCents)}
                accent
                accentColor={accent}
              />
              <FooterStat label={t('detail.cuotas_next_due')} value={formatDayMonth(q.nextDueDate)} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

const FooterStat = ({
  label,
  value,
  accent = false,
  accentColor,
}: {
  label: string
  value: string
  accent?: boolean
  accentColor?: string
}) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-soft">{label}</p>
    <p
      className="mt-0.5 text-sm font-bold tabular-nums"
      style={accent && accentColor ? { color: accentColor } : undefined}
    >
      {value}
    </p>
  </div>
)
