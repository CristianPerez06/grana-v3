'use client'

import { useTranslations } from 'next-intl'
import { formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { Alert } from '@/components/ui/alert'

type Props = {
  usdAmount: number
}

export const USDSubordinatedNote = ({ usdAmount }: Props) => {
  const showCents = useShowCents()
  const t = useTranslations('cards')
  return (
    <Alert variant="info" title={`${t('payment.usd_note_prefix')} ${formatUSD(usdAmount, showCents)}`}>
      <p className="text-xs">{t('payment.usd_note_description')}</p>
    </Alert>
  )
}
