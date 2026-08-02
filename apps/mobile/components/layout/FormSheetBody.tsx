import type { ReactNode } from 'react'
import { KeyboardProvider } from 'react-native-keyboard-controller'
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
 * It mounts its OWN `KeyboardProvider`: an RN `Modal` renders into a separate
 * native window, and the keyboard context is anchored to a window — so the
 * provider mounted in `app/_layout.tsx` does not reach inside the modal. That
 * detail is encapsulated here instead of being repeated (and eventually
 * forgotten) in every sheet.
 *
 * Only overlays with inputs pay for this. An overlay without a text field —
 * `SelectSheet`, `EditDatesSheet` — keeps a plain `ScrollView`/`FlatList`.
 */
export function FormSheetBody({ contentClassName, maxHeight, children }: Props) {
  return (
    <KeyboardProvider>
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_BOTTOM_OFFSET}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName={contentClassName}
        style={maxHeight === undefined ? undefined : { maxHeight }}
      >
        {children}
      </KeyboardAwareScrollView>
    </KeyboardProvider>
  )
}
