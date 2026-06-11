import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { X } from 'lucide-react-native'
import { PageHeader } from '../../../../../../components/ui/PageHeader'
import { Spinner } from '../../../../../../components/ui/Spinner'
import { Drawer } from '../../../../../../components/ui/Drawer'
import {
  SubcategoryList,
  type SubcategoryWithName,
} from '../../../../../../components/categories/SubcategoryList'
import { CreateSubcategoryForm } from '../../../../../../components/categories/CreateSubcategoryForm'
import {
  getCategoryById,
  getSubcategoriesByCategoryId,
  getCategoryName,
  getSubcategoryName,
  type Category,
} from '../../../../../../lib/categories'
import { colors } from '../../../../../../lib/colors'
import { useT } from '../../../../../../lib/locale-context'

export default function SubcategoriesScreen() {
  const t = useT()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [category, setCategory] = useState<Category | null | undefined>(undefined)
  const [subcategories, setSubcategories] = useState<SubcategoryWithName[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createKey, setCreateKey] = useState(0)

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

  // Re-fetch on focus so archiving / deleting from a child route reflects when we
  // return. Stack keeps this screen mounted; useEffect would only fire on first mount.
  useFocusEffect(
    useCallback(() => {
      void load()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  )

  const openCreate = () => {
    setCreateKey((n) => n + 1)
    setCreateOpen(true)
  }

  const screenTitle = category
    ? `${getCategoryName(category, t)} · ${t('settings.categories.subcategories.title')}`
    : t('settings.categories.subcategories.title')

  return (
    <View className="flex-1 bg-background">
      <PageHeader
        title={screenTitle}
        backLink={{
          href: '/(app)/settings/categories',
          label: t('settings.categories.label'),
        }}
        actions={
          id ? (
            <Pressable
              onPress={openCreate}
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
      <ScrollView contentContainerClassName="px-6 py-6">
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
      </ScrollView>

      {id ? (
        <Drawer
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          ariaLabel={t('settings.categories.subcategories.new.title')}
        >
          <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-page">
            <View className="flex-row items-center justify-between border-b border-border px-6 py-4">
              <Text className="text-[22px] font-extrabold text-text">
                {t('settings.categories.subcategories.new.title')}
              </Text>
              <Pressable
                onPress={() => setCreateOpen(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                className="h-9 w-9 items-center justify-center rounded-[11px] border border-border"
              >
                <X size={18} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView contentContainerClassName="px-6 py-6" keyboardShouldPersistTaps="handled">
              <CreateSubcategoryForm
                key={createKey}
                categoryId={id}
                onSuccess={() => {
                  setCreateOpen(false)
                  void load()
                }}
              />
            </ScrollView>
          </SafeAreaView>
        </Drawer>
      ) : null}
    </View>
  )
}
