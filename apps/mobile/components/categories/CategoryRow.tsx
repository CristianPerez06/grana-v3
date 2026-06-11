import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { MoreHorizontal } from 'lucide-react-native'
import { archiveCategory, deleteCategory, type CategoryWithSubcategories } from '../../lib/categories'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { Popover } from '../ui/Popover'

type Props = {
  category: CategoryWithSubcategories
  displayName: string
  subcategoryCount: number
  isSystem: boolean
  onChanged?: () => void
}

const pillClassByType: Record<CategoryWithSubcategories['type'], string> = {
  income: 'bg-emerald-soft',
  expense: 'bg-terracotta-soft',
  both: 'bg-border-soft',
}

const pillTextByType: Record<CategoryWithSubcategories['type'], string> = {
  income: 'text-emerald-deep',
  expense: 'text-terracotta',
  both: 'text-text-muted',
}

export function CategoryRow({
  category,
  displayName,
  subcategoryCount,
  isSystem,
  onChanged,
}: Props) {
  const t = useT()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const typeLabel = t(`settings.categories.types.${category.type}`)

  const handleArchive = async () => {
    setPending(true)
    setError(null)
    const result = await archiveCategory(category.id)
    setPending(false)
    if (!result.ok) {
      setError(t(result.errorKey))
      return
    }
    onChanged?.()
  }

  const handleDelete = () => {
    Alert.alert(
      t('settings.categories.actions.delete'),
      t('settings.categories.confirmations.delete_category'),
      [
        { text: t('common.back'), style: 'cancel' },
        {
          text: t('settings.categories.actions.delete'),
          style: 'destructive',
          onPress: async () => {
            setPending(true)
            setError(null)
            const result = await deleteCategory(category.id)
            setPending(false)
            if (!result.ok) {
              setError(t(result.errorKey))
              return
            }
            onChanged?.()
          },
        },
      ],
    )
  }

  // Run a menu action after the sheet has closed.
  const runFromMenu = (action: () => void) => {
    setMenuOpen(false)
    action()
  }

  const iconStyle = category.color?.startsWith('#')
    ? { backgroundColor: `${category.color}1a` }
    : undefined

  return (
    <View
      className={`flex-row items-center gap-3 px-[18px] py-[15px] ${
        pending ? 'opacity-50' : ''
      }`}
    >
      <View
        className="h-[42px] w-[42px] items-center justify-center rounded-[14px] bg-border-soft"
        style={iconStyle}
      >
        {category.icon ? <Text className="text-xl">{category.icon}</Text> : null}
      </View>
      <View className="flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-[13px] font-extrabold text-text">{displayName}</Text>
          <View className={`rounded-full px-2 py-0.5 ${pillClassByType[category.type]}`}>
            <Text className={`text-[11px] font-extrabold ${pillTextByType[category.type]}`}>
              {typeLabel}
            </Text>
          </View>
        </View>
        {subcategoryCount > 0 && (
          <Text className="mt-1 text-[13px] text-text-muted">
            {t('settings.categories.list.subcategory_count', { count: subcategoryCount })}
          </Text>
        )}
        {error && <Text className="mt-1 text-xs text-error">{error}</Text>}
      </View>

      <Popover
        open={menuOpen}
        onOpenChange={setMenuOpen}
        trigger={
          <View
            className="h-9 w-9 items-center justify-center rounded-[12px] border border-border bg-card"
            accessibilityRole="button"
            accessibilityLabel={t('settings.categories.actions.more')}
          >
            <MoreHorizontal size={18} color={colors.textMuted} />
          </View>
        }
      >
        <MenuItem
          label={t('settings.categories.actions.view_subcategories')}
          onPress={() =>
            runFromMenu(() =>
              router.push({
                pathname: '/(app)/settings/categories/[id]/subcategories',
                params: { id: category.id },
              }),
            )
          }
        />
        {!isSystem && (
          <>
            <MenuItem
              label={t('settings.categories.actions.edit')}
              onPress={() =>
                runFromMenu(() =>
                  router.push({
                    pathname: '/(app)/settings/categories/[id]/edit',
                    params: { id: category.id },
                  }),
                )
              }
            />
            <MenuItem
              label={t('settings.categories.actions.archive')}
              onPress={() => runFromMenu(handleArchive)}
            />
            <MenuItem
              label={t('settings.categories.actions.delete')}
              destructive
              onPress={() => runFromMenu(handleDelete)}
            />
          </>
        )}
      </Popover>
    </View>
  )
}

function MenuItem({
  label,
  onPress,
  destructive = false,
}: {
  label: string
  onPress: () => void
  destructive?: boolean
}) {
  return (
    <Pressable onPress={onPress} className="rounded-[10px] px-3 py-3 active:bg-border-soft">
      <Text className={`text-sm ${destructive ? 'text-negative' : 'text-text'}`}>{label}</Text>
    </Pressable>
  )
}
