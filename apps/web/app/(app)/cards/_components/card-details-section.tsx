import { formatARS } from '@/lib/format'

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

type Props = {
  creditLimit: number | null
  pendingAmountARS: number
  createdAt: string
  archivedAt?: string | null
  showCents?: boolean
}

export const CardDetailsSection = ({
  creditLimit,
  pendingAmountARS,
  createdAt,
  archivedAt,
  showCents = false,
}: Props) => {
  const usedPercent =
    creditLimit && creditLimit > 0
      ? Math.min(100, Math.round((pendingAmountARS / creditLimit) * 100))
      : null

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Detalles
      </h2>

      {creditLimit !== null && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Límite de crédito</span>
            <span className="font-medium">{formatARS(creditLimit, showCents)}</span>
          </div>
          {usedPercent !== null && (
            <>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    usedPercent >= 90 ? 'bg-red-500' : usedPercent >= 70 ? 'bg-amber-400' : 'bg-primary'
                  }`}
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{usedPercent}% utilizado</span>
                <span>{formatARS(creditLimit - pendingAmountARS, showCents)} disponible</span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Fecha de alta</span>
          <span>{formatDate(createdAt.slice(0, 10))}</span>
        </div>
        {archivedAt && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Archivada</span>
            <span>{formatDate(archivedAt.slice(0, 10))}</span>
          </div>
        )}
      </div>
    </section>
  )
}
