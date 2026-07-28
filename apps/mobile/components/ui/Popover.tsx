import { Pressable, View } from 'react-native'
import type { PopoverProps } from '@grana/ui-contracts'
import { BottomSheet } from './BottomSheet'

/**
 * Content anchored to a trigger. Mirrors apps/web/components/ui/popover.tsx via
 * the shared PopoverProps contract. On mobile the content is presented as a
 * bottom sheet (the conventional native placement) rather than a pixel-anchored
 * popover — an allowed platform divergence under the Web↔Mobile policy. Tapping
 * the trigger opens it; tapping the scrim or dismissing the sheet closes it.
 *
 * Renders through the shared `BottomSheet` so row-action menus (accounts,
 * categories) get the same grabber + surface + slide-up as the pickers. Callers
 * own their header row inside `children`, mirroring how `SelectSheet` does.
 */
export function Popover({ open, onOpenChange, trigger, children }: PopoverProps) {
  return (
    <View>
      <Pressable onPress={() => onOpenChange(true)}>{trigger}</Pressable>
      <BottomSheet visible={open} onClose={() => onOpenChange(false)}>
        {children}
      </BottomSheet>
    </View>
  )
}
