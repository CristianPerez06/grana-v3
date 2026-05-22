import Link from 'next/link'
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
  if (creditLimit === null || creditLimit <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Cargá el límite para ver cuánto te queda.{' '}
        <Link href={editHref} className="text-primary hover:underline">
          Cargar
        </Link>
      </p>
    )
  }

  if (totalCommittedARS > creditLimit) {
    const over = subtractMoneyValues(totalCommittedARS, creditLimit)
    return (
      <p className="text-sm font-medium text-red-700">
        Comprometido {formatARS(totalCommittedARS, showCents)} —{' '}
        {formatARS(over, showCents)} por encima del límite
      </p>
    )
  }

  const available = subtractMoneyValues(creditLimit, totalCommittedARS)
  return (
    <p className="text-sm text-foreground">
      <span className="font-medium">Disponible {formatARS(available, showCents)}</span>
      <span className="text-muted-foreground"> de {formatARS(creditLimit, showCents)}</span>
    </p>
  )
}
