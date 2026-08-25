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
   * Full-height overlays (`Drawer`) leave it unset and let flex do the work.
   */
  maxHeight?: number
  children: ReactNode
}

/**
 * Scrollable body for overlay surfaces that contain text inputs (`Drawer`,
 * `BottomSheet`, or any RN `Modal`).
 *
 * It does NOT mount a `KeyboardProvider`. An RN `Modal` renders into a separate
 * native window and the keyboard context is anchored to a window, so the
 * provider in `app/_layout.tsx` does not reach inside a modal — but the provider
 * renders a `flex: 1` view, which measures 0 inside a content-sized sheet and
 * hides the content. So the provider is mounted by whoever owns the `Modal`
 * (`BottomSheet`, `Drawer`, `MovementFiltersSheet`), where it fills the window;
 * this component only scrolls and shifts.
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
