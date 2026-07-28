import type { ReactNode } from 'react'
import { Dimensions, FlatList, Pressable, Text, View } from 'react-native'
import { BottomSheet } from './BottomSheet'
import { useT } from '../../lib/locale-context'

type Props<T> = {
  visible: boolean
  onClose: () => void
  /** Sheet title, shown in the header next to the close affordance. */
  title: string
  items: T[]
  keyExtractor: (item: T) => string
  /** Renders one row; the caller owns selection state + tap-to-close. */
  renderRow: (item: T) => ReactNode
  /** Optional slot above the list — used by the category drill (back + "whole"). */
  header?: ReactNode
  /** Optional slot below the list — used for the "add new" action. */
  footer?: ReactNode
}

// Cap the list at ~half the screen so a long category list scrolls inside the
// sheet; a short list (a handful of accounts) makes the sheet hug its content.
const LIST_MAX_HEIGHT = Math.round(Dimensions.get('window').height * 0.5)

/**
 * Single-select picker rendered as a content-sized `BottomSheet`: header (title +
 * close) + an optional `header` slot + a `FlatList` of caller-rendered rows + an
 * optional `footer` slot. Distilled from `InstitutionPickerModal` minus the
 * search box (web has none). Generic over the item type so accounts and
 * categories reuse it.
 */
export function SelectSheet<T>({
  visible,
  onClose,
  title,
  items,
  keyExtractor,
  renderRow,
  header,
  footer,
}: Props<T>) {
  const t = useT()
  return (
    <BottomSheet visible={visible} onClose={onClose} ariaLabel={title}>
      <View className="flex-row items-center justify-between border-b border-border px-5 pb-3 pt-1">
        <Text className="text-lg font-semibold text-text">{title}</Text>
        <Pressable onPress={onClose} accessibilityRole="button">
          <Text className="text-sm font-medium text-emerald">{t('common.close')}</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-5 pb-2 pt-2"
        style={{ maxHeight: LIST_MAX_HEIGHT }}
        ListHeaderComponent={header ? <>{header}</> : null}
        ListFooterComponent={footer ? <>{footer}</> : null}
        renderItem={({ item }) => <>{renderRow(item)}</>}
      />
    </BottomSheet>
  )
}
