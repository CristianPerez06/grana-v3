import { useState } from 'react'
import { View, type LayoutChangeEvent } from 'react-native'
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg'
import type { MonthBalanceDay } from '@grana/dashboard'

type Props = {
  days: MonthBalanceDay[]
  height?: number
}

const PADDING = { top: 16, right: 12, bottom: 24, left: 12 }
const COLOR_EMERALD = '#10B981'
const COLOR_NEGATIVE = '#E11D48'
const COLOR_BORDER = '#E2E5EA'
const COLOR_TEXT_MUTED = '#6B7683'

export const MonthBalanceChart = ({ days, height = 200 }: Props) => {
  const [width, setWidth] = useState(0)

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width)
  }

  if (days.length === 0) {
    return <View style={{ height }} onLayout={onLayout} />
  }

  if (width === 0) {
    // First render: measure container.
    return <View style={{ height }} onLayout={onLayout} />
  }

  const totalDays = days.length
  const plotWidth = width - PADDING.left - PADDING.right
  const plotHeight = height - PADDING.top - PADDING.bottom

  const values = days.map((d) => d.accumulatedBalance)
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

  const linePath = days
    .map(
      (d, i) =>
        `${i === 0 ? 'M' : 'L'} ${xFor(d.day).toFixed(2)} ${yFor(d.accumulatedBalance).toFixed(2)}`,
    )
    .join(' ')

  const lastDay = days[totalDays - 1]
  const baselineY = yFor(0)
  const areaPath = `${linePath} L ${xFor(lastDay.day).toFixed(2)} ${baselineY.toFixed(2)} L ${xFor(days[0].day).toFixed(2)} ${baselineY.toFixed(2)} Z`

  const finalValue = lastDay.accumulatedBalance
  const isPositive = finalValue >= 0
  const strokeColor = isPositive ? COLOR_EMERALD : COLOR_NEGATIVE
  const areaColor = isPositive ? COLOR_EMERALD : COLOR_NEGATIVE

  const tickDays = [1, 5, 10, 15, 20, 25, totalDays].filter(
    (d, i, arr) => d <= totalDays && arr.indexOf(d) === i,
  )

  return (
    <View style={{ height }} onLayout={onLayout}>
      <Svg width={width} height={height}>
        {/* Baseline (y = 0) */}
        <Line
          x1={PADDING.left}
          x2={width - PADDING.right}
          y1={baselineY}
          y2={baselineY}
          stroke={COLOR_BORDER}
          strokeWidth={1}
          strokeDasharray="2 4"
        />

        {/* Area fill */}
        <Path d={areaPath} fill={areaColor} fillOpacity={0.1} />

        {/* Line */}
        <Path
          d={linePath}
          stroke={strokeColor}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Endpoint dot */}
        <Circle cx={xFor(lastDay.day)} cy={yFor(finalValue)} r={3.5} fill={strokeColor} />

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
