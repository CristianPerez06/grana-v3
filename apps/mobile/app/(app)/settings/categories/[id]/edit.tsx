import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { FormScreen } from '../../../../../components/layout/FormScreen'
import { Spinner } from '../../../../../components/ui/Spinner'
import { EditCategoryForm } from '../../../../../components/categories/EditCategoryForm'
import { getCategoryById, type Category } from '../../../../../lib/categories'
import { useT } from '../../../../../lib/locale-context'

export default function EditCategoryScreen() {
  const t = useT()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [category, setCategory] = useState<Category | null | undefined>(undefined)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getCategoryById(id)
      .then((result) => {
        if (!cancelled) setCategory(result)
      })
      .catch(() => {
        if (!cancelled) setCategory(null)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <FormScreen
      title={t('settings.categories.edit.title')}
      backLink={{
        href: '/(app)/settings/categories',
        label: t('settings.categories.label'),
      }}
      contentClassName="px-6 py-6"
    >
      {category === undefined ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : category === null ? (
        <Text className="text-sm text-error">
          {t('settings.categories.errors.not_found')}
        </Text>
      ) : (
        <EditCategoryForm category={category} />
      )}
    </FormScreen>
  )
}
