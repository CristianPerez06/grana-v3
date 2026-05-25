import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PageHeader } from '../../../../components/ui/PageHeader'
import { Spinner } from '../../../../components/ui/Spinner'
import { CategoryList } from '../../../../components/categories/CategoryList'
import { getAllCategories, type CategoryWithSubcategories } from '../../../../lib/categories'
import { supabase } from '../../../../lib/supabase'
import { useT } from '../../../../lib/locale-context'

export default function CategoriesScreen() {
  const t = useT()
  const router = useRouter()
  const [categories, setCategories] = useState<CategoryWithSubcategories[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError(t('settings.categories.errors.generic'))
        return
      }
      const result = await getAllCategories(user.id)
      setCategories(result)
      setError(null)
    } catch {
      setError(t('settings.categories.errors.generic'))
    }
  }, [t])

  // Re-fetch every time the screen returns to focus (e.g. after creating /
  // editing / archiving / deleting from a child route). The Stack keeps the
  // list screen mounted, so a plain `useEffect` would only fire on first mount
  // and miss those transitions.
  useFocusEffect(
    useCallback(() => {
      void fetchCategories()
    }, [fetchCategories]),
  )

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="px-6 py-6">
        <View className="flex-col gap-6">
          <PageHeader
            title={t('settings.categories.label')}
            description={t('settings.categories.description')}
            backLink={{ href: '/(app)/settings', label: t('settings.title') }}
            actions={
              <Pressable
                onPress={() => router.push('/(app)/settings/categories/new')}
                className="rounded-xl bg-emerald px-4 py-2"
                accessibilityRole="button"
              >
                <Text className="text-sm font-semibold text-white">
                  {t('settings.categories.actions.add')}
                </Text>
              </Pressable>
            }
          />

          {error ? (
            <Text className="text-sm text-error">{error}</Text>
          ) : categories === null ? (
            <View className="items-center py-12">
              <Spinner size="md" />
            </View>
          ) : (
            <CategoryList categories={categories} onChanged={fetchCategories} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
