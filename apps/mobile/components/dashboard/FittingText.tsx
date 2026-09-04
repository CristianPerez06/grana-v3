import { useState } from 'react'
import { Text, View } from 'react-native'

type Props = {
  /** Longest first. The first one that fits is rendered. */
  variants: string[]
  className?: string
}

/**
 * Native mirror of the web `fitting-text.tsx`: renders the first of `variants`
 * that fits on one line, falling back to ellipsis on the last one.
 *
 * The rule for WHICH variants exist and in what order lives in
 * `dateLineVariants` (`@grana/dashboard`), pure and shared. Picking one needs
 * measurement, which is the half that cannot be shared — web uses an off-screen
 * DOM probe, native lays the candidates out invisibly and reads their widths
 * from `onLayout`.
 *
 * Reading truncation off `onTextLayout` instead would be shorter, but what
 * `lines[0].text` contains once a line is clipped differs between iOS and
 * Android, and a rule that resolves differently per OS is not a rule. Measuring
 * the candidates gives the same answer on both.
 *
 * Until the probes report (the first frame), the longest variant is rendered
 * with `numberOfLines={1}`, so the worst the user ever sees is one frame of
 * ellipsis rather than a wrong line.
 */
export const FittingText = ({ variants, className }: Props) => {
  const [available, setAvailable] = useState<number | null>(null)
  const [widths, setWidths] = useState<number[]>([])

  const index = pick(variants, widths, available)

  return (
    // `flexShrink`, NOT `flex-1`. Filling the row would push whatever follows
    // the text — the lens caret — to the far right edge, while on web the
    // equivalent `<span>` shrinks to its content and the caret stays glued to
    // the date. Shrinking also keeps the measurement honest: the box is the
    // content's width when it fits and the squeezed width when it does not,
    // which is exactly what `clientWidth` reports on the web side.
    // RN defaults `flexShrink` to 0, unlike the web, so it has to be explicit.
    <View
      style={{ flexShrink: 1, minWidth: 0 }}
      onLayout={(event) => setAvailable(event.nativeEvent.layout.width)}
    >
      <Text numberOfLines={1} className={className}>
        {variants[index] ?? variants[0]}
      </Text>

      {/* Probes: laid out at their natural width off-screen so nothing about
          the visible line depends on them. `pointerEvents="none"` keeps them
          out of the touch tree; they are also `aria-hidden` for the reader. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', left: -9999, top: 0, opacity: 0 }}
      >
        {variants.map((variant, i) => (
          <Text
            key={variant}
            className={className}
            onLayout={(event) => {
              const width = event.nativeEvent.layout.width
              setWidths((previous) => {
                if (previous[i] === width) return previous
                const next = [...previous]
                next[i] = width
                return next
              })
            }}
          >
            {variant}
          </Text>
        ))}
      </View>
    </View>
  )
}

/** First variant whose measured width fits; the last one when none does. */
function pick(variants: string[], widths: number[], available: number | null): number {
  if (available === null) return 0
  for (let i = 0; i < variants.length; i += 1) {
    const width = widths[i]
    if (width !== undefined && width <= available) return i
  }
  return widths.length === 0 ? 0 : variants.length - 1
}
