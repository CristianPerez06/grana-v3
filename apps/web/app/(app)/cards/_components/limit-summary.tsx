import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { formatARS } from '@grana/i18n-messages'
import { subtractMoneyValues } from '@/lib/cards/utils'

type Props = {
  creditLimit: number | null
  totalCommittedARS: number
  editHref: string
  showCents?: boolean
}

export const LimitSummary = ({
  creditLimit,
  totalCommittedARS,
  editHref,
  showCents = false,
}: Props) => {
  const t = useTranslations('cards')
  if (creditLimit === null || creditLimit <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('limit_summary.empty_prompt')}{' '}
        <Link href={editHref} className="text-primary hover:underline">
          {t('limit_summary.empty_cta')}
        </Link>
      </p>
    )
  }

  if (totalCommittedARS > creditLimit) {
    const over = subtractMoneyValues(totalCommittedARS, creditLimit)
    return (
      <p className="text-sm font-medium text-red-700">
        {t('limit_summary.committed')} {formatARS(totalCommittedARS, showCents)} —{' '}
        {formatARS(over, showCents)} {t('limit_summary.over_limit')}
      </p>
    )
  }

  const available = subtractMoneyValues(creditLimit, totalCommittedARS)
  return (
    <p className="text-sm text-foreground">
      <span className="font-medium">{t('limit_summary.available')} {formatARS(available, showCents)}</span>
      <span className="text-muted-foreground"> {t('limit_summary.of_connector')} {formatARS(creditLimit, showCents)}</span>
    </p>
  )
}
