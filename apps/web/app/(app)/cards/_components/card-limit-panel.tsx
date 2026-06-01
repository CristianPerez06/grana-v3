import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { BarChart3 } from 'lucide-react'
import { formatARS } from '@grana/i18n-messages'
import { Card } from '@/components/ui/card'
import { subtractMoneyValues } from '@/lib/cards/utils'
import { CardLimitBar } from './card-limit-bar'

type Props = {
  cardId: string
  creditLimit: number | null
  /** Committed ARS across the visible statements (ARS-only, Bimoneda + I-CRED-9). */
  committedARS: number
  accent: string
  showCents?: boolean
}

/**
 * Optional credit-limit panel. When the limit is loaded, shows used/total/%
 * and the available remainder. When it is null, shows the "Cargar límite" CTA
 * linking to the card editor — the limit is not always known.
 */
export const CardLimitPanel = ({ cardId, creditLimit, committedARS, accent, showCents = false }: Props) => {
  const t = useTranslations('cards')

  if (creditLimit === null || creditLimit <= 0) {
    return (
      <Card className="flex items-center gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-border-soft text-text-muted">
          <BarChart3 size={20} />
        </span>
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{t('detail.limit_cta_title')}</span>{' '}
          <span className="text-text-muted">{t('detail.limit_cta_body')}</span>
        </p>
        <Link
          href={`/cards/${cardId}/edit`}
          className="shrink-0 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-bold transition-colors hover:bg-border-soft"
        >
          {t('detail.limit_cta_button')}
        </Link>
      </Card>
    )
  }

  const used = Math.max(0, committedARS)
  const pct = Math.min(100, Math.round((used / creditLimit) * 100))
  const available = subtractMoneyValues(creditLimit, used)

  return (
    <Card className="flex flex-col gap-2.5 p-6">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-text-muted">
          {t.rich('detail.limit_used', {
            used: formatARS(used, showCents),
            total: formatARS(creditLimit, showCents),
            b: (chunks) => <b className="font-bold tabular-nums text-text">{chunks}</b>,
          })}
        </p>
        <p className="text-sm font-bold tabular-nums">{pct}%</p>
      </div>
      <CardLimitBar percent={pct} accent={accent} className="h-2.5" />
      <p className="text-sm text-text-muted">
        {t.rich('detail.limit_available', {
          available: formatARS(available, showCents),
          b: (chunks) => <b className="font-bold tabular-nums text-text">{chunks}</b>,
        })}
      </p>
    </Card>
  )
}
