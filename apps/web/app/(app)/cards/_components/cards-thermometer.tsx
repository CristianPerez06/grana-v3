import { formatARS, formatUSD } from '@grana/i18n-messages'

const formatDate = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export type ThermometerColumnLabel =
  | 'EN CURSO'
  | 'POR PAGAR'
  | 'VENCIDO'
  | 'PAGADO'
  | 'PRÓXIMO'
  | 'SIGUIENTE'

export type ThermometerColumn = {
  label: ThermometerColumnLabel
  tone: 'neutral' | 'amber' | 'red' | 'paid'
  closeDate: string
  dueDate: string
  pendingARS: number
  pendingUSD: number
}

type Props = {
  columns: [ThermometerColumn, ThermometerColumn, ThermometerColumn]
  creditLimit: number | null
  showCents?: boolean
}

const labelToneClasses: Record<ThermometerColumn['tone'], string> = {
  neutral: 'text-muted-foreground',
  amber: 'text-amber-700',
  red: 'text-red-700',
  paid: 'text-emerald-700',
}

const barColor = (percent: number) => {
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 70) return 'bg-amber-400'
  return 'bg-primary'
}

export const CardsThermometer = ({ columns, creditLimit, showCents = false }: Props) => {
  const hasLimit = creditLimit !== null && creditLimit > 0

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Cómo viene tu tarjeta
      </h2>

      <div className="grid grid-cols-3 gap-3">
        {columns.map((col, idx) => {
          const percent = hasLimit
            ? Math.min(999, Math.round((col.pendingARS / creditLimit!) * 100))
            : null

          const isEmpty = col.pendingARS === 0 && col.pendingUSD === 0
          const cappedPercentForBar = percent !== null ? Math.min(100, percent) : null

          return (
            <div key={idx} className="flex flex-col gap-2">
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${labelToneClasses[col.tone]}`}
              >
                {col.label}
              </p>
              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                <span>cierra {formatDate(col.closeDate)}</span>
                <span>vence {formatDate(col.dueDate)}</span>
              </div>

              {hasLimit && (
                <div className="flex flex-col gap-1">
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor(percent ?? 0)}`}
                      style={{ width: `${cappedPercentForBar}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{percent}%</span>
                </div>
              )}

              <p className="text-base font-semibold tabular-nums">
                {formatARS(col.pendingARS, showCents)}
              </p>
              {col.pendingUSD > 0 && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatUSD(col.pendingUSD, showCents)} USD
                </p>
              )}
              {isEmpty && (
                <p className="text-[11px] text-muted-foreground italic">sin movimientos</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
