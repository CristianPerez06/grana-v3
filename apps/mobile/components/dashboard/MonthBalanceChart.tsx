import { useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg'
import type { MonthBalanceDay } from '@grana/dashboard'

type Props = {
  /** Primary currency series (left axis). */
  ars: MonthBalanceDay[]
  /** Secondary currency series (right axis). Omitted/empty ⇒ single ARS line. */
  usd?: MonthBalanceDay[] | null
  height?: number
}

const PADDING = { top: 18, right: 12, bottom: 24, left: 12 }
const COLOR_EMERALD = '#10B981'
const COLOR_NEGATIVE = '#E11D48'
const COLOR_SKY = '#0EA5E9'
const COLOR_BORDER = '#E2E5EA'
const COLOR_TEXT_MUTED = '#6B7683'

// Compact axis label: 1_250_000 → "1.3M", 754_500 → "755k", 300 → "300".
const compact = (n: number): string => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(Math.round(n))
}

const scaleFor = (series: MonthBalanceDay[]) => {
  const values = series.map((d) => d.accumulatedBalance)
  const minY = Math.min(0, ...values)
  const maxY = Math.max(0, ...values)
  return { minY, maxY, range: maxY - minY || 1 }
}

// Accumulated month balance over the days of the month. Bimoneda: ARS and USD
// are NEVER plotted on a shared scale (USD's smaller magnitude would flatten to
// the baseline). When USD has activity the chart is dual-axis — ARS reads
// against the left scale, USD (dashed) against the right.
export const MonthBalanceChart = ({ ars, usd, height = 200 }: Props) => {
  const [width, setWidth] = useState(0)

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
  }

  const totalDays = ars.length
  if (totalDays === 0) {
    return <View style={{ height }} onLayout={onLayout} />
  }

  if (width === 0) {
    // First render: measure container.
    return <View style={{ height }} onLayout={onLayout} />
  }

  const hasUsd = !!usd && usd.length > 0 && usd.some((d) => d.accumulatedBalance !== 0)

  const plotWidth = width - PADDING.left - PADDING.right
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
  const arsColor = arsPositive ? COLOR_EMERALD : COLOR_NEGATIVE

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
    <View style={{ height }} onLayout={onLayout}>
      <Svg width={width} height={height}>
        {/* Baseline (ARS y = 0) */}
        <Line
          x1={PADDING.left}
          x2={width - PADDING.right}
          y1={arsBaselineY}
          y2={arsBaselineY}
          stroke={COLOR_BORDER}
          strokeWidth={1}
          strokeDasharray="2 4"
        />

        {/* ARS area fill */}
        <Path d={arsAreaPath} fill={arsColor} fillOpacity={0.1} />

        {/* ARS line (primary, left axis) */}
        <Path
          d={arsLine}
          stroke={arsColor}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* USD line (secondary, right axis) */}
        {usdLine && (
          <Path
            d={usdLine}
            stroke={COLOR_SKY}
            strokeWidth={2}
            strokeDasharray="5 3"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Endpoint dots */}
        <Circle cx={xFor(lastArs.day)} cy={yForArs(lastArs.accumulatedBalance)} r={3.5} fill={arsColor} />
        {usdLine && usdScale && lastUsd && (
          <Circle
            cx={xFor(lastUsd.day)}
            cy={PADDING.top + (1 - (lastUsd.accumulatedBalance - usdScale.minY) / usdScale.range) * plotHeight}
            r={3.5}
            fill={COLOR_SKY}
          />
        )}

        {/* Per-axis max labels — make the two independent scales legible */}
        {hasUsd && usdScale && (
          <>
            <SvgText
              x={PADDING.left}
              y={12}
              fontSize={10}
              fontWeight="600"
              fill={COLOR_EMERALD}
              textAnchor="start"
            >
              {compact(arsScale.maxY)}
            </SvgText>
            <SvgText
              x={width - PADDING.right}
              y={12}
              fontSize={10}
              fontWeight="600"
              fill={COLOR_SKY}
              textAnchor="end"
            >
              {compact(usdScale.maxY)}
            </SvgText>
          </>
        )}

        {/* X axis tick labels */}
        {tickDays.map((d) => (
          <SvgText
            key={d}
            x={xFor(d)}
            y={height - 6}
            fontSize={10}
            fill={COLOR_TEXT_MUTED}
            textAnchor="middle"
          >
            {d}
          </SvgText>
        ))}
      </Svg>
    </View>
  )
}
