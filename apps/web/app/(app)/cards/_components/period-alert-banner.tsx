import Link from 'next/link'

type Props = {
  cardId: string
  periodId: string
  variant: 'vencido' | 'cerrado_esperando_pago'
  dueDate: string
}

const formatDate = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export const PeriodAlertBanner = ({ cardId, periodId, variant, dueDate }: Props) => {
  const isOverdue = variant === 'vencido'

  const containerClasses = isOverdue
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-amber-50 border-amber-200 text-amber-800'

  const buttonClasses = isOverdue
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-amber-500 hover:bg-amber-600 text-white'

  const text = isOverdue
    ? 'Resumen vencido — evitá cargos por mora'
    : `Resumen cerrado — vence el ${formatDate(dueDate)}`

  const buttonText = isOverdue ? 'Pagar ahora' : 'Pagar resumen'

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${containerClasses}`}
    >
      <p className="text-sm font-medium">{text}</p>
      <Link
        href={`/cards/${cardId}/periods/${periodId}/pay`}
        className={`shrink-0 inline-flex items-center rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${buttonClasses}`}
      >
        {buttonText}
      </Link>
    </div>
  )
}
