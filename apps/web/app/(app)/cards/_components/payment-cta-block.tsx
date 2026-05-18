import Link from 'next/link'
import type { PeriodVariant } from '@/lib/cards/types'

type Props = {
  cardId: string
  periodId: string | null
  variant: PeriodVariant | 'inactiva'
}

export const PaymentCTABlock = ({ cardId, periodId, variant }: Props) => {
  if (variant === 'inactiva') return null

  if (variant === 'tarjeta_nueva') {
    return (
      <Link
        href={`/accounts/${cardId}/transactions/new`}
        className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Registrar primer consumo
      </Link>
    )
  }

  if (variant === 'cerrado_esperando_pago' || variant === 'vencido') {
    if (!periodId) return null
    return (
      <Link
        href={`/cards/${cardId}/periods/${periodId}/pay`}
        className={`inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
          variant === 'vencido'
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        }`}
      >
        {variant === 'vencido' ? 'Pagar ahora' : 'Pagar resumen'}
      </Link>
    )
  }

  // actual, futuro, pagado → QuickActions handles the actions
  return null
}
