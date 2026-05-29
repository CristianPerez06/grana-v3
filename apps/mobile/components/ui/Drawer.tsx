import { useEffect, useRef } from 'react'
import { Animated, Dimensions, Modal, Pressable } from 'react-native'
import type { DrawerProps } from '@grana/ui-contracts'

/**
 * Side panel sliding in over a scrim. Mirrors apps/web/components/ui/drawer.tsx
 * via the shared DrawerProps contract. Tapping the scrim closes; the panel is
 * full-height anchored to `side`. Entrance slides in; close uses the modal's
 * fade (RN modals unmount on close, so an exit slide isn't reliable here).
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
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
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
    </Modal>
  )
}
