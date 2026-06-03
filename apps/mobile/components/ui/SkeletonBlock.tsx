import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

type Props = {
  /** NativeWind utilities for sizing, border-radius and (optionally) base color. */
  className?: string
}

// Matches Tailwind's `animate-pulse` (2s cycle, 1.0 → 0.5 → 1.0, ease-in-out).
// The wide range matters: `bg-muted` (~#EEF1F4) has low contrast on white
// surfaces, so a narrow opacity delta makes the pulse imperceptible.
const PULSE_DURATION_MS = 2000
const PULSE_MIN_OPACITY = 0.5
const STATIC_OPACITY = 0.7

export const SkeletonBlock = ({ className }: Props) => {
  const opacity = useSharedValue(1)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = STATIC_OPACITY
      return
    }
    opacity.value = withRepeat(
      withTiming(PULSE_MIN_OPACITY, {
        duration: PULSE_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    )
  }, [opacity, reduceMotion])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  // Animated.View only drives opacity; the inner `View` handles sizing/color/
  // radius via NativeWind. Passing both `className` AND `style={animatedStyle}`
  // on the same Animated.View made NativeWind skip the className processing,
  // collapsing the block to 0×0 — splitting the responsibilities avoids that.
  //
  // Note: `bg-border-soft` (hex literal #EEF1F4) instead of `bg-muted`. In the
  // tokens, `muted` is aliased to `var(--border-soft)` — a CSS variable that
  // resolves on web but is an unparseable string on native, leaving the block
  // transparent.
  return (
    <Animated.View style={animatedStyle}>
      <View className={`bg-border-soft ${className ?? ''}`} />
    </Animated.View>
  )
}
