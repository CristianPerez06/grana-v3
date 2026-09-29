import type { ReactNode } from 'react'
import {
  KEYBOARD_BOTTOM_OFFSET,
  KeyboardAwareScrollView,
} from './keyboard-aware-scroll-view'

type Props = {
  /** Spacing of the scroll content container. Each sheet keeps its own rhythm. */
  contentClassName?: string
  /**
   * Caps the scroller's height so a long form scrolls inside the sheet instead
   * of pushing it past its own max height (`BottomSheet` caps the panel at 90%).
   * Inside a `BottomSheet` this must come from `useSheetBodyMaxHeight()`, which
   * splits what is left of the screen — a hardcoded number leaves the CTA below
   * the fold on a tall phone and clipped on a short one.
   * Full-height overlays (`Drawer`) leave it unset and let flex do the work.
   */
  maxHeight?: number
  children: ReactNode
}

/**
 * Scrollable body for overlay surfaces that contain text inputs (`Drawer`,
 * `BottomSheet`, or any RN `Modal`).
 *
 * It does NOT mount a `KeyboardProvider`, and neither does the surface that
 * owns the `Modal`: the one in `app/_layout.tsx` tracks the keyboard inside the
 * modal window too, and a nested one left it paused after the modal closed
 * (issue #166). This component only scrolls and shifts.
 *
 * An overlay without a text field — `SelectSheet`, `EditDatesSheet` — keeps a
 * plain `ScrollView`/`FlatList`.
 */
export function FormSheetBody({ contentClassName, maxHeight, children }: Props) {
  return (
    <KeyboardAwareScrollView
      bottomOffset={KEYBOARD_BOTTOM_OFFSET}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName={contentClassName}
      style={maxHeight === undefined ? undefined : { maxHeight }}
    >
      {children}
    </KeyboardAwareScrollView>
  )
}
