import { useEffect, useRef } from 'react'
import { Animated, Dimensions, Modal, Pressable } from 'react-native'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import type { DrawerProps } from '@grana/ui-contracts'

/**
 * Side panel sliding in over a scrim. Mirrors apps/web/components/ui/drawer.tsx
 * via the shared DrawerProps contract. Tapping the scrim closes; the panel is
 * full-height anchored to `side`. Entrance slides in; close uses the modal's
 * fade (RN modals unmount on close, so an exit slide isn't reliable here).
 *
 * Mounts the `KeyboardProvider` for its window: an RN `Modal` is a separate
 * native window that the root provider does not reach, and the provider's own
 * view is `flex: 1`, so it belongs at the root of the window and not inside the
 * form (see `FormSheetBody`).
 */
export function Drawer({
  open,
  onClose,
  side = 'right',
  widthPx = 528,
  ariaLabel,
  children,
}: DrawerProps) {
  const screenWidth = Dimensions.get('window').width
  const panelWidth = Math.min(widthPx, screenWidth)
  const hiddenOffset = side === 'right' ? panelWidth : -panelWidth
  const translateX = useRef(new Animated.Value(hiddenOffset)).current

  useEffect(() => {
    if (open) {
      translateX.setValue(hiddenOffset)
      Animated.timing(translateX, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }).start()
    }
  }, [open, hiddenOffset, translateX])

  return (
    // No `statusBarTranslucent`/`navigationBarTranslucent` here, even though the
    // provider inside forces both under edge-to-edge: the panels this drawer
    // hosts are not inset-aware (`home/settings` passes a bare padded `View`),
    // so an edge-to-edge window would slide their content under the system bars.
    // Aligning the flags is a follow-up that needs a `SafeAreaView` there first.
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardProvider>
        <Pressable
          accessibilityLabel={ariaLabel}
          onPress={onClose}
          style={{ flex: 1, backgroundColor: 'rgba(11,26,43,0.30)' }}
        >
          <Pressable
            onPress={() => {}}
            style={{ position: 'absolute', top: 0, bottom: 0, [side]: 0, width: panelWidth }}
          >
            <Animated.View
              className="flex-1 bg-page"
              style={{ transform: [{ translateX }] }}
            >
              {children}
            </Animated.View>
          </Pressable>
        </Pressable>
      </KeyboardProvider>
    </Modal>
  )
}
