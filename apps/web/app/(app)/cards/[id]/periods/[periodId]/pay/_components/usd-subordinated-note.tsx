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
    <Alert
      variant="info"
      // Nota de contexto, no una alerta: con el padding por defecto se comía
      // demasiado alto entre el encabezado y el formulario.
      className="px-4 py-3"
      title={`${t('payment.usd_note_prefix')} ${formatUSD(usdAmount, showCents)}`}
    >
      <p className="text-xs">{t('payment.usd_note_description')}</p>
    </Alert>
  )
}
