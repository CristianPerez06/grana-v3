import { useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'

type Props = {
  /** Longest first. The first one that fits is rendered. */
  variants: string[]
  className?: string
  /**
   * Rendered immediately after the text, at its natural width — a caret, a
   * badge. It lives INSIDE this component on purpose: the width available to
   * the text is "the row minus whatever follows it", and measuring that here is
   * what lets the row be measured without the text's own width in the loop.
   */
  trailing?: ReactNode
}

/** Space between the text and `trailing`. Applied as padding so `onLayout` reports it. */
const TRAILING_GAP = 6

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
 * ── THE MEASURED BOX MUST NOT DEPEND ON THE TEXT ──────────────────────────
 *
 * This is the whole correctness argument, and getting it wrong is issue #140.
 *
 * The outer `View` is `flex: 1`: it takes the width its parent hands it, and
 * that width is the same whichever variant is on screen. The text shrinks
 * inside it. Before, the outer box was `flexShrink: 1` with no grow — so it
 * measured the CHOSEN TEXT, fed that to the picker, and the picker chose the
 * text. Width decided content and content decided width; on the dashboard
 * header, where the current month is the only selection that produces two
 * variants, the two kept trading places and the date line flickered with both
 * strings drawn over each other.
 *
 * The comment that argued for `flexShrink` claimed filling the row would push
 * the caret to the far edge. It does not: a flex row lays its children out from
 * the start, so a container wider than its content leaves the caret exactly
 * where it was, right after the text. Web proves the same point from the other
 * side — its host is a `block` span, sized by its parent, never by its own text.
 *
 * `available` and `trailingWidth` are both properties of the LAYOUT. Neither
 * moves when the picker changes its mind, so one pass settles it.
 *
 * Until the probes report (the first frame), the longest variant is rendered
 * with `numberOfLines={1}`, so the worst the user ever sees is one frame of
 * ellipsis rather than a wrong line.
 *
 * Reading truncation off `onTextLayout` instead would be shorter, but what
 * `lines[0].text` contains once a line is clipped differs between iOS and
 * Android, and a rule that resolves differently per OS is not a rule. Measuring
 * the candidates gives the same answer on both.
 */
export const FittingText = ({ variants, className, trailing }: Props) => {
  const [available, setAvailable] = useState<number | null>(null)
  const [trailingWidth, setTrailingWidth] = useState(0)
  const [widths, setWidths] = useState<number[]>([])

  // What the text itself may occupy: the row, less whatever trails it.
  const room = available === null ? null : available - trailingWidth
  const index = pick(variants, widths, room)

  return (
    <View
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
      onLayout={(event) => setAvailable(event.nativeEvent.layout.width)}
    >
      <Text numberOfLines={1} className={className} style={{ flexShrink: 1 }}>
        {variants[index] ?? variants[0]}
      </Text>

      {trailing != null ? (
        <View
          style={{ flexShrink: 0, paddingLeft: TRAILING_GAP }}
          onLayout={(event) => setTrailingWidth(event.nativeEvent.layout.width)}
        >
          {trailing}
        </View>
      ) : null}

      {/* Probes: laid out at their natural width off-screen so nothing about
          the visible line depends on them. Absolutely positioned, so they are
          out of the row's flow and cannot widen the box being measured.
          `pointerEvents="none"` keeps them out of the touch tree; they are also
          `aria-hidden` for the reader. */}
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
