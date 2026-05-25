import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { archiveCategory, deleteCategory, type CategoryWithSubcategories } from '../../lib/categories'
import { useT } from '../../lib/locale-context'

type Props = {
  category: CategoryWithSubcategories
  displayName: string
  subcategoryCount: number
  isSystem: boolean
  onChanged?: () => void
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

  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3 ${
        pending ? 'opacity-50' : ''
      }`}
    >
      {category.icon ? (
        <Text className="w-8 text-center text-xl">{category.icon}</Text>
      ) : null}
      <View className="flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-sm font-medium text-text">{displayName}</Text>
          <View className="rounded bg-border-soft px-1.5 py-0.5">
            <Text className="text-[10px] uppercase tracking-wide text-text-soft">
              {typeLabel}
            </Text>
          </View>
          {subcategoryCount > 0 && (
            <Text className="text-xs text-text-soft">
              {t('settings.categories.list.subcategory_count', { count: subcategoryCount })}
            </Text>
          )}
        </View>
        {error && <Text className="mt-1 text-xs text-error">{error}</Text>}
      </View>
      <View className="flex-row items-center gap-3">
        <Link
          href={{
            pathname: '/(app)/settings/categories/[id]/subcategories',
            params: { id: category.id },
          }}
          asChild
        >
          <Pressable>
            <Text className="text-xs text-text-soft">
              {t('settings.categories.actions.view_subcategories')}
            </Text>
          </Pressable>
        </Link>
        {!isSystem && (
          <>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(app)/settings/categories/[id]/edit',
                  params: { id: category.id },
                })
              }
              disabled={pending}
            >
              <Text className="text-xs text-text-soft">
                {t('settings.categories.actions.edit')}
              </Text>
            </Pressable>
            <Pressable onPress={handleArchive} disabled={pending}>
              <Text className="text-xs text-text-soft">
                {t('settings.categories.actions.archive')}
              </Text>
            </Pressable>
            <Pressable onPress={handleDelete} disabled={pending}>
              <Text className="text-xs text-error">
                {t('settings.categories.actions.delete')}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  )
}
