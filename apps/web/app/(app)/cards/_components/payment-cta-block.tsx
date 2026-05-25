import Link from 'next/link'
import type { PeriodVariant } from '@/lib/cards/types'

type Props = {
  cardId: string
  variant: PeriodVariant | 'inactiva'
  canRegisterPurchase: boolean
}

const primaryClasses =
  'inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors'

const secondaryClasses =
  'inline-flex w-full items-center justify-center rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-muted transition-colors'

export const PaymentCTABlock = ({ cardId, variant, canRegisterPurchase }: Props) => {
  if (variant === 'inactiva') return null

  if (variant === 'tarjeta_nueva') {
    return (
      <Link href={`/accounts/${cardId}/transactions/new`} className={primaryClasses}>
        Registrar primer consumo
      </Link>
    )
  }

  if (!canRegisterPurchase) return null

  return (
    <Link href={`/accounts/${cardId}/transactions/new`} className={secondaryClasses}>
      Registrar consumo
    </Link>
  )
}
