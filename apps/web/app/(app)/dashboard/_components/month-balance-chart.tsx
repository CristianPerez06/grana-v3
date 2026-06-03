import type { MonthBalanceDay } from '@grana/dashboard'

type Props = {
  /** Primary currency series (left axis). */
  ars: MonthBalanceDay[]
  /** Secondary currency series (right axis). Omitted/empty ⇒ single ARS line. */
  usd?: MonthBalanceDay[] | null
  height?: number
}

const PADDING = { top: 18, right: 12, bottom: 24, left: 12 }
const VIEWBOX_WIDTH = 600

// Compact axis label: 1_250_000 → "1.3M", 754_500 → "755k", 300 → "300".
const compact = (n: number): string => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(Math.round(n))
}

const scaleFor = (series: MonthBalanceDay[]) => {
  const values = series.map((d) => d.accumulatedBalance)
  // Always include 0 so the baseline is meaningful.
  const minY = Math.min(0, ...values)
  const maxY = Math.max(0, ...values)
  return { minY, maxY, range: maxY - minY || 1 }
}

// Accumulated month balance over the days of the month. Bimoneda: ARS and USD
// are NEVER plotted on a shared scale (USD's smaller magnitude would flatten to
// the baseline). When USD has activity the chart is dual-axis — ARS reads
// against the left scale, USD (dashed) against the right — and the legend +
// totals below carry the absolute numbers.
export const MonthBalanceChart = ({ ars, usd, height = 200 }: Props) => {
  const totalDays = ars.length
  if (totalDays === 0) {
    return <div className="h-[200px]" aria-hidden />
  }

  const hasUsd = !!usd && usd.length > 0 && usd.some((d) => d.accumulatedBalance !== 0)

  const plotWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right
  const plotHeight = height - PADDING.top - PADDING.bottom

  const xFor = (day: number) =>
    totalDays === 1
      ? PADDING.left + plotWidth / 2
      : PADDING.left + ((day - 1) / (totalDays - 1)) * plotWidth

  const arsScale = scaleFor(ars)
  const yForArs = (value: number) =>
    PADDING.top + (1 - (value - arsScale.minY) / arsScale.range) * plotHeight

  const buildLine = (series: MonthBalanceDay[], yFor: (v: number) => number) =>
    series
      .map(
        (d, i) =>
          `${i === 0 ? 'M' : 'L'} ${xFor(d.day).toFixed(2)} ${yFor(d.accumulatedBalance).toFixed(2)}`,
      )
      .join(' ')

  const arsLine = buildLine(ars, yForArs)
  const lastArs = ars[totalDays - 1]
  const arsBaselineY = yForArs(0)
  const arsAreaPath = `${arsLine} L ${xFor(lastArs.day).toFixed(2)} ${arsBaselineY.toFixed(2)} L ${xFor(ars[0].day).toFixed(2)} ${arsBaselineY.toFixed(2)} Z`
  const arsPositive = lastArs.accumulatedBalance >= 0

  // USD on its own (right) scale.
  let usdLine: string | null = null
  let usdScale: ReturnType<typeof scaleFor> | null = null
  let lastUsd: MonthBalanceDay | null = null
  if (hasUsd && usd) {
    usdScale = scaleFor(usd)
    const yForUsd = (value: number) =>
      PADDING.top + (1 - (value - usdScale!.minY) / usdScale!.range) * plotHeight
    usdLine = buildLine(usd, yForUsd)
    lastUsd = usd[usd.length - 1]
  }

  const tickDays = [1, 5, 10, 15, 20, 25, totalDays].filter(
    (d, i, arr) => d <= totalDays && arr.indexOf(d) === i,
  )

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label="Balance acumulado del mes por moneda"
      className="block"
    >
      {/* Baseline (ARS y = 0) */}
      <line
        x1={PADDING.left}
        x2={VIEWBOX_WIDTH - PADDING.right}
        y1={arsBaselineY}
        y2={arsBaselineY}
        stroke="currentColor"
        className="text-border"
        strokeWidth={1}
        strokeDasharray="2 4"
      />

      {/* ARS area fill */}
      <path d={arsAreaPath} className={arsPositive ? 'fill-emerald/10' : 'fill-negative/10'} />

      {/* ARS line (primary, left axis) */}
      <path
        d={arsLine}
        fill="none"
        className={arsPositive ? 'stroke-emerald' : 'stroke-negative'}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* USD line (secondary, right axis) */}
      {usdLine && (
        <path
          d={usdLine}
          fill="none"
          className="stroke-sky-500"
          strokeWidth={2}
          strokeDasharray="5 3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Endpoint dots */}
      <circle
        cx={xFor(lastArs.day)}
        cy={yForArs(lastArs.accumulatedBalance)}
        r={3.5}
        className={arsPositive ? 'fill-emerald' : 'fill-negative'}
      />
      {usdLine && usdScale && lastUsd && (
        <circle
          cx={xFor(lastUsd.day)}
          cy={PADDING.top + (1 - (lastUsd.accumulatedBalance - usdScale.minY) / usdScale.range) * plotHeight}
          r={3.5}
          className="fill-sky-500"
        />
      )}

      {/* Per-axis max labels — make the two independent scales legible */}
      {hasUsd && usdScale && (
        <>
          <text
            x={PADDING.left}
            y={12}
            textAnchor="start"
            className="fill-emerald text-[10px] font-semibold"
          >
            {compact(arsScale.maxY)}
          </text>
          <text
            x={VIEWBOX_WIDTH - PADDING.right}
            y={12}
            textAnchor="end"
            className="fill-sky-500 text-[10px] font-semibold"
          >
            {compact(usdScale.maxY)}
          </text>
        </>
      )}

      {/* X axis tick labels */}
      {tickDays.map((d) => (
        <text
          key={d}
          x={xFor(d)}
          y={height - 6}
          textAnchor="middle"
          className="fill-text-muted text-[10px]"
        >
          {d}
        </text>
      ))}
    </svg>
  )
}
