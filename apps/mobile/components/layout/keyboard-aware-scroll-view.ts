import { cssInterop } from 'nativewind'
import { KeyboardAwareScrollView as BaseKeyboardAwareScrollView } from 'react-native-keyboard-controller'

/**
 * `KeyboardAwareScrollView` registered with NativeWind. Always import the
 * scroller from here — never straight from `react-native-keyboard-controller`.
 *
 * NativeWind only auto-registers a fixed list of components
 * (`react-native-css-interop/src/runtime/components.ts`): `ScrollView` is on it,
 * this one is not. Without the `cssInterop` call below, `className` and
 * `contentContainerClassName` are handed to the component as plain strings and
 * silently dropped — every form screen would render flush against the screen
 * edges, with no padding at all.
 *
 * TypeScript does NOT catch this: NativeWind augments `ScrollViewProps`
 * globally, so both props typecheck on any component that extends them,
 * registered or not. The failure is runtime-only and visual.
 */
cssInterop(BaseKeyboardAwareScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
})

export const KeyboardAwareScrollView = BaseKeyboardAwareScrollView

/**
 * Height of `KeyboardToolbar` (mounted once in `app/_layout.tsx`). Mirrors
 * `KEYBOARD_TOOLBAR_HEIGHT` in the library, which is NOT part of its public API
 * — hence the literal.
 */
const KEYBOARD_TOOLBAR_HEIGHT = 42

/** Breathing room between the focused field and whatever is below it. */
const BREATHING_ROOM = 24

/**
 * `bottomOffset` for every keyboard-aware scroller in the app.
 *
 * It MUST include the toolbar height: the scroller positions the focused field
 * `bottomOffset` above the top edge of the **keyboard**, and it has no knowledge
 * of `KeyboardToolbar` (nothing in `KeyboardAwareScrollView` references it). The
 * toolbar floats in those 42px, so any offset below that leaves the bottom of
 * the field covered — with a bare 24 the input reads as "half hidden by the
 * keyboard", which is exactly how this was first reported.
 *
 * The breathing room on top of it keeps the field clear of the toolbar and
 * leaves the field's error text (rendered under the input by `FormField`)
 * visible.
 */
export const KEYBOARD_BOTTOM_OFFSET = KEYBOARD_TOOLBAR_HEIGHT + BREATHING_ROOM
