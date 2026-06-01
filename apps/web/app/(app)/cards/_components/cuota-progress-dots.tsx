/**
 * Installment progress dots: paid in accent, the next one in faded accent,
 * future ones in border-gray. `paid` = installments already paid; the next is
 * `paid + 1`.
 */
type Props = {
  paid: number
  total: number
  accent: string
}

export const CuotaProgressDots = ({ paid, total, accent }: Props) => (
  <div className="flex flex-wrap gap-1.5">
    {Array.from({ length: total }, (_, i) => {
      const n = i + 1
      const isPaid = n <= paid
      const isNext = n === paid + 1
      return (
        <span
          key={n}
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: isPaid ? accent : isNext ? `color-mix(in srgb, ${accent} 40%, transparent)` : 'var(--border)',
          }}
          aria-hidden
        />
      )
    })}
  </div>
)
