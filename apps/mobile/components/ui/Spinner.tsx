import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import type { SpinnerProps } from '@grana/ui-contracts'
import { colors } from '../../lib/colors'

type MobileSpinnerProps = SpinnerProps & {
  /** React Native-specific: override the stroke color. Defaults to `colors.textSoft`. */
  color?: string
}

const SIZE_MAP = { sm: 16, md: 24, lg: 40 } as const
const STROKE_RATIO = 0.1
const VIEWBOX = 24
const RADIUS = 10
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function Spinner({
  size = 'md',
  color = colors.textSoft,
  label = 'Loading',
}: MobileSpinnerProps) {
  const rotation = useSharedValue(0)

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    )
  }, [rotation])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  const px = SIZE_MAP[size]

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[{ width: px, height: px }, animatedStyle]}
    >
      <Svg width={px} height={px} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Circle
          cx={VIEWBOX / 2}
          cy={VIEWBOX / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={VIEWBOX * STROKE_RATIO}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE * 0.75} ${CIRCUMFERENCE}`}
        />
      </Svg>
    </Animated.View>
  )
}
