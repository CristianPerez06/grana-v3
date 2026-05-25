import { useState } from 'react'
import { Alert as RNAlert, Pressable, Text, View } from 'react-native'
import { archiveSubcategory, deleteSubcategory, type Subcategory } from '../../lib/categories'
import { useT } from '../../lib/locale-context'

export type SubcategoryWithName = Subcategory & { displayName: string }

type Props = {
  subcategories: SubcategoryWithName[]
  onChanged?: () => void
}

export function SubcategoryList({ subcategories, onChanged }: Props) {
  const t = useT()

  if (subcategories.length === 0) {
    return (
      <View className="py-12">
        <Text className="text-center text-sm text-text-soft">
          {t('settings.categories.subcategories.empty')}
        </Text>
      </View>
    )
  }

  return (
    <View className="overflow-hidden rounded-2xl border border-border-soft bg-card">
      {subcategories.map((sub, index) => (
        <View
          key={sub.id}
          className={index === 0 ? '' : 'border-t border-border-soft'}
        >
          <SubcategoryRow subcategory={sub} onChanged={onChanged} />
        </View>
      ))}
    </View>
  )
}

function SubcategoryRow({
  subcategory,
  onChanged,
}: {
  subcategory: SubcategoryWithName
  onChanged?: () => void
}) {
  const t = useT()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const isSystem = subcategory.user_id === null

  const handleArchive = async () => {
    setPending(true)
    setError(null)
    const result = await archiveSubcategory(subcategory.id)
    setPending(false)
    if (!result.ok) {
      setError(t(result.errorKey))
      return
    }
    onChanged?.()
  }

  const handleDelete = () => {
    RNAlert.alert(
      t('settings.categories.actions.delete'),
      t('settings.categories.confirmations.delete_subcategory'),
      [
        { text: t('common.back'), style: 'cancel' },
        {
          text: t('settings.categories.actions.delete'),
          style: 'destructive',
          onPress: async () => {
            setPending(true)
            setError(null)
            const result = await deleteSubcategory(subcategory.id)
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
      <View className="flex-1">
        <Text className="text-sm font-medium text-text">{subcategory.displayName}</Text>
        {error && <Text className="mt-1 text-xs text-error">{error}</Text>}
      </View>
      {!isSystem && (
        <View className="flex-row items-center gap-3">
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
        </View>
      )}
    </View>
  )
}
