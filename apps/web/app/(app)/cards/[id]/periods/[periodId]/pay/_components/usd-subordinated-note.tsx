'use client'

import { useTranslations } from 'next-intl'
import { formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'

type Props = {
  usdAmount: number
}

export const USDSubordinatedNote = ({ usdAmount }: Props) => {
  const showCents = useShowCents()
  const t = useTranslations('cards')
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <p className="font-medium">{t('payment.usd_note_prefix')} {formatUSD(usdAmount, showCents)}</p>
      <p className="text-xs text-blue-700 mt-0.5">
        {t('payment.usd_note_description')}
      </p>
    </div>
  )
}
