import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { PageHeader } from '../../../../../../components/ui/PageHeader'
import { Spinner } from '../../../../../../components/ui/Spinner'
import {
  SubcategoryList,
  type SubcategoryWithName,
} from '../../../../../../components/categories/SubcategoryList'
import {
  getCategoryById,
  getSubcategoriesByCategoryId,
  getCategoryName,
  getSubcategoryName,
  type Category,
} from '../../../../../../lib/categories'
import { useT } from '../../../../../../lib/locale-context'

export default function SubcategoriesScreen() {
  const t = useT()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [category, setCategory] = useState<Category | null | undefined>(undefined)
  const [subcategories, setSubcategories] = useState<SubcategoryWithName[] | null>(null)

  const load = async () => {
    if (!id) return
    const cat = await getCategoryById(id)
    setCategory(cat)
    if (!cat) {
      setSubcategories([])
      return
    }
    const subs = await getSubcategoriesByCategoryId(id)
    const named: SubcategoryWithName[] = subs.map((sub) => ({
      ...sub,
      displayName: getSubcategoryName(sub, t),
    }))
    setSubcategories(named)
  }

  // Re-fetch on focus so creating / archiving / deleting from a child route
  // reflects when we return. Stack keeps this screen mounted; useEffect would
  // only fire on first mount.
  useFocusEffect(
    useCallback(() => {
      void load()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  )

  const screenTitle = category
    ? `${getCategoryName(category, t)} · ${t('settings.categories.subcategories.title')}`
    : t('settings.categories.subcategories.title')

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="px-6 py-6">
        <View className="flex-col gap-6">
          <PageHeader
            title={screenTitle}
            backLink={{
              href: '/(app)/settings/categories',
              label: t('settings.categories.label'),
            }}
            actions={
              id ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/settings/categories/[id]/subcategories/new',
                      params: { id },
                    })
                  }
                  className="rounded-xl bg-emerald px-4 py-2"
                  accessibilityRole="button"
                >
                  <Text className="text-sm font-semibold text-white">
                    {t('settings.categories.actions.add_subcategory')}
                  </Text>
                </Pressable>
              ) : null
            }
          />
          {category === undefined || subcategories === null ? (
            <View className="items-center py-12">
              <Spinner size="md" />
            </View>
          ) : category === null ? (
            <Text className="text-sm text-error">
              {t('settings.categories.errors.not_found')}
            </Text>
          ) : (
            <SubcategoryList subcategories={subcategories} onChanged={load} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
