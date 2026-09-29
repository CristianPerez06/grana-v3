import type { ReactNode } from 'react'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'

type Props = {
  children: ReactNode
}

/**
 * Keyboard-avoiding wrapper for overlay surfaces that own their own scrolling
 * region — typically a `FlatList` with its own `maxHeight`, like the searchable
 * pickers.
 *
 * Sibling of `FormSheetBody`, and the choice between them is not stylistic:
 * `FormSheetBody` provides the scroller itself, so putting a `FlatList` inside
 * it would nest a VirtualizedList in a ScrollView (RN warns, virtualization
 * breaks, and the list renders every row). This one only shifts its children
 * and lets the list keep scrolling itself.
 *
 * It does NOT mount a `KeyboardProvider`, and neither does the surface that
 * owns the `Modal`: the one in `app/_layout.tsx` tracks the keyboard inside the
 * modal window too, and a nested one left it paused after the modal closed
 * (issue #166).
 *
 * This is the library's `KeyboardAvoidingView`, NOT React Native's: it handles
 * Android edge-to-edge and animates in sync with the keyboard, which is exactly
 * what RN's version failed to do here (both pickers had it disabled on Android).
 */
export function FormSheetKeyboardView({ children }: Props) {
  return <KeyboardAvoidingView behavior="padding">{children}</KeyboardAvoidingView>
}
