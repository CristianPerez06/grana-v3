import { Modal, Pressable, ScrollView, View } from 'react-native'
import type { PopoverProps } from '@grana/ui-contracts'

/**
 * Content anchored to a trigger. Mirrors apps/web/components/ui/popover.tsx via
 * the shared PopoverProps contract. On mobile the content is presented as a
 * bottom sheet (the conventional native placement) rather than a pixel-anchored
 * popover — an allowed platform divergence under the Web↔Mobile policy. Tapping
 * the trigger opens it; tapping the scrim closes it.
 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
}: PopoverProps) {
  return (
    <View>
      <Pressable onPress={() => onOpenChange(true)}>{trigger}</Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => onOpenChange(false)}
      >
        <Pressable
          onPress={() => onOpenChange(false)}
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(11,26,43,0.30)',
          }}
        >
          <Pressable
            onPress={() => {}}
            className="rounded-t-2xl bg-card p-2"
            style={{ maxHeight: '60%' }}
          >
            {/* Scroll the list when it exceeds the sheet's max height — without
                this the maxHeight just clips the extra rows (e.g. the long
                category list) with no way to reach them. */}
            <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}
