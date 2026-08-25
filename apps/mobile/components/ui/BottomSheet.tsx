import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { Animated, Dimensions, Modal, Pressable, View } from 'react-native'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Breathing room below the last element, on top of the OS inset — so content
// never sits flush with the screen edge (the home-indicator inset is 0 on
// Android phones with button navigation, so we can't rely on it alone).
const BOTTOM_SPACING = 20

/**
 * Content-sized bottom sheet: a panel anchored to the bottom that hugs its
 * children and is capped at 90% of the screen (long content scrolls inside its
 * own list rather than pushing the sheet full-height). Same interaction model as
 * `Popover` — tapping the scrim closes; a decorative grabber sits on top. The
 * scrim fades in (Modal) while the panel slides up (Animated), mirroring how
 * `Drawer` slides horizontally. RN modals unmount on close, so there's no exit
 * slide — the fade covers it.
 *
 * This replaces `presentationStyle="formSheet"` for the pickers, which rendered
 * full-height on Android (status bar over the header). A scrollable region in
 * `children` (FlatList/ScrollView) should carry its own `maxHeight` so it scrolls
 * instead of overflowing the cap.
 *
 * The `KeyboardProvider` for the sheet is mounted HERE, at the root of the modal
 * window, and never inside the panel. Two facts force that placement: an RN
 * `Modal` is a separate native window that the root provider does not reach, and
 * the provider renders its own view with a hardcoded `flex: 1`. In the
 * content-sized panel that view measures 0 (flex-basis 0 inside an auto-height
 * column) and takes the whole sheet down with it; at the modal root it fills the
 * window, which is what it wants. Sheets with a text field wrap their content in
 * `FormSheetKeyboardView` / `FormSheetBody`, which now only shift or scroll.
 */
export function BottomSheet({
  visible,
  onClose,
  ariaLabel,
  children,
}: {
  visible: boolean
  onClose: () => void
  ariaLabel?: string
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const screenHeight = Dimensions.get('window').height
  const translateY = useRef(new Animated.Value(screenHeight)).current

  useEffect(() => {
    if (visible) {
      translateY.setValue(screenHeight)
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start()
    }
  }, [visible, screenHeight, translateY])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Must match what the provider inside uses: under edge-to-edge it forces
      // both to true, and the library requires the modal window to agree.
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardProvider>
        <Pressable
          accessibilityLabel={ariaLabel}
          onPress={onClose}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,26,43,0.30)' }}
        >
          <Animated.View
            className="overflow-hidden rounded-t-2xl bg-page"
            style={{ maxHeight: '90%', transform: [{ translateY }] }}
          >
            {/* Swallow taps on the panel so they don't bubble to the scrim. The
                bottom padding = OS inset + a fixed base so the last element keeps
                its distance from the screen edge on every device. */}
            <Pressable onPress={() => {}} style={{ paddingBottom: insets.bottom + BOTTOM_SPACING }}>
              <View className="items-center pb-1 pt-2.5">
                <View className="h-1 w-9 rounded-full bg-border" />
              </View>
              {children}
            </Pressable>
          </Animated.View>
        </Pressable>
      </KeyboardProvider>
    </Modal>
  )
}
