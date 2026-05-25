import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { PeriodVariant } from '@/lib/cards/types'

type Props = {
  cardId: string
  periodId: string | null
  variant: PeriodVariant | 'inactiva'
  canRegisterPurchase: boolean
}

const primaryClasses =
  'inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors'

const dangerClasses =
  'inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-colors'

const secondaryClasses =
  'inline-flex w-full items-center justify-center rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-muted transition-colors'

export const PaymentCTABlock = ({ cardId, periodId, variant, canRegisterPurchase }: Props) => {
  const t = useTranslations('cards')
  if (variant === 'inactiva') return null

  if (variant === 'tarjeta_nueva') {
    return (
      <Link href={`/accounts/${cardId}/transactions/new`} className={primaryClasses}>
        {t('actions.register_first_purchase')}
      </Link>
    )
  }

  const registerLink = canRegisterPurchase ? (
    <Link href={`/accounts/${cardId}/transactions/new`} className={secondaryClasses}>
      {t('actions.register_purchase')}
    </Link>
  ) : null

  if ((variant === 'cerrado_esperando_pago' || variant === 'vencido') && periodId) {
    const isOverdue = variant === 'vencido'
    return (
      <div className="flex flex-col gap-2">
        <Link
          href={`/cards/${cardId}/periods/${periodId}/pay`}
          className={isOverdue ? dangerClasses : primaryClasses}
        >
          {isOverdue ? t('actions.pay_now') : t('actions.pay_statement')}
        </Link>
        {registerLink}
      </div>
    )
  }

  // actual, futuro, pagado → only register
  return registerLink
}
