import Link from 'next/link'
import type { CategorySlice } from '@grana/money-logic'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Dashboard teaser: the top categories of the month as a hook into the full
// spending-by-category breakdown in Movimientos. Shows proportions (bar + %),
// NOT amounts — so it needs no eye-mask. Composes the shared Card like every
// other dashboard section. Bimoneda: ARS is primary; the USD breakdown shows
// as a subordinate list below, only when there's USD spending — proportions
// are computed per currency (never mixed).

const FALLBACK = '#9CA3AF'

type Props = {
  title: string
  viewAllLabel: string
  href: string
  /** Top categories (already sliced/sorted), ARS. */
  slices: CategorySlice[]
  /** Top USD categories; rendered as a subordinate list when non-empty. */
  usdSlices?: CategorySlice[]
}

const SliceList = ({ slices }: { slices: CategorySlice[] }) => (
  <ul className="flex flex-col gap-2">
    {slices.map((s) => (
      <li key={s.categoryId} className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm">
          {s.icon ? `${s.icon} ` : ''}
          {s.label}
        </span>
        <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${s.percentage}%`, backgroundColor: s.color ?? FALLBACK }}
          />
        </div>
        <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {Math.round(s.percentage)}%
        </span>
      </li>
    ))}
  </ul>
)

export const CategoryTeaser = ({ title, viewAllLabel, href, slices, usdSlices = [] }: Props) => {
  if (slices.length === 0 && usdSlices.length === 0) return null
  const showCurrencyLabels = slices.length > 0 && usdSlices.length > 0

  return (
    <Card className="min-h-[8rem]">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          {viewAllLabel}
        </Link>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {slices.length > 0 && (
          <div className="flex flex-col gap-2">
            {showCurrencyLabels && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-soft">ARS</p>
            )}
            <SliceList slices={slices} />
          </div>
        )}
        {usdSlices.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border-soft pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-500">USD</p>
            <SliceList slices={usdSlices} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
