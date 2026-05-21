import type { MonthBalanceDay } from '@grana/dashboard'

type Props = {
  days: MonthBalanceDay[]
  height?: number
}

const PADDING = { top: 16, right: 12, bottom: 24, left: 12 }
const VIEWBOX_WIDTH = 600

export const MonthBalanceChart = ({ days, height = 200 }: Props) => {
  const totalDays = days.length
  if (totalDays === 0) {
    return <div className="h-[200px]" aria-hidden />
  }

  const plotWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right
  const plotHeight = height - PADDING.top - PADDING.bottom

  const values = days.map((d) => d.accumulatedBalance)
  // Always include 0 so the baseline is visible.
  const minY = Math.min(0, ...values)
  const maxY = Math.max(0, ...values)
  const range = maxY - minY || 1

  const xFor = (day: number) => {
    if (totalDays === 1) return PADDING.left + plotWidth / 2
    return PADDING.left + ((day - 1) / (totalDays - 1)) * plotWidth
  }
  const yFor = (value: number) => {
    const normalized = (value - minY) / range
    return PADDING.top + (1 - normalized) * plotHeight
  }

  // Build line + area paths
  const linePath = days
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(d.day).toFixed(2)} ${yFor(d.accumulatedBalance).toFixed(2)}`)
    .join(' ')

  const lastDay = days[totalDays - 1]
  const baselineY = yFor(0)
  const areaPath = `${linePath} L ${xFor(lastDay.day).toFixed(2)} ${baselineY.toFixed(2)} L ${xFor(days[0].day).toFixed(2)} ${baselineY.toFixed(2)} Z`

  const finalValue = lastDay.accumulatedBalance
  const isPositive = finalValue >= 0

  // Tick days: 1, 5, 10, 15, 20, 25, last
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
      aria-label="Balance acumulado del mes"
      className="block"
    >
      {/* Baseline (y = 0) */}
      <line
        x1={PADDING.left}
        x2={VIEWBOX_WIDTH - PADDING.right}
        y1={baselineY}
        y2={baselineY}
        stroke="currentColor"
        className="text-border"
        strokeWidth={1}
        strokeDasharray="2 4"
      />

      {/* Area fill */}
      <path
        d={areaPath}
        className={isPositive ? 'fill-emerald/10' : 'fill-negative/10'}
      />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        className={isPositive ? 'stroke-emerald' : 'stroke-negative'}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Endpoint dot */}
      <circle
        cx={xFor(lastDay.day)}
        cy={yFor(finalValue)}
        r={3.5}
        className={isPositive ? 'fill-emerald' : 'fill-negative'}
      />

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
