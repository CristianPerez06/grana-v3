import Link from 'next/link'

type Props = {
  cardId: string
}

export const QuickActions = ({ cardId }: Props) => (
  <div className="flex gap-2">
    <Link
      href={`/accounts/${cardId}/transactions/new`}
      className="flex-1 inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
    >
      Registrar consumo
    </Link>
    <button
      disabled
      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium opacity-50 cursor-not-allowed"
      title="Próximamente"
    >
      Cuotas
      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
        Próximamente
      </span>
    </button>
  </div>
)
