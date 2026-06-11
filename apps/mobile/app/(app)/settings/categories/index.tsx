import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { X } from 'lucide-react-native'
import { PageHeader } from '../../../../components/ui/PageHeader'
import { Spinner } from '../../../../components/ui/Spinner'
import { Drawer } from '../../../../components/ui/Drawer'
import { CategoryList } from '../../../../components/categories/CategoryList'
import { CreateCategoryForm } from '../../../../components/categories/CreateCategoryForm'
import { getAllCategories, type CategoryWithSubcategories } from '../../../../lib/categories'
import { supabase } from '../../../../lib/supabase'
import { colors } from '../../../../lib/colors'
import { useT } from '../../../../lib/locale-context'

export default function CategoriesScreen() {
  const t = useT()
  const [categories, setCategories] = useState<CategoryWithSubcategories[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createKey, setCreateKey] = useState(0)

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

  // Re-fetch every time the screen returns to focus (e.g. after archiving /
  // deleting from a child route). The Stack keeps the list screen mounted, so a
  // plain `useEffect` would only fire on first mount and miss those transitions.
  useFocusEffect(
    useCallback(() => {
      void fetchCategories()
    }, [fetchCategories]),
  )

  const openCreate = () => {
    setCreateKey((n) => n + 1)
    setCreateOpen(true)
  }

  return (
    <View className="flex-1 bg-background">
      <PageHeader
        title={t('settings.categories.label')}
        description={t('settings.categories.description')}
        backLink={{ href: '/(app)/settings', label: t('settings.title') }}
        actions={
          <Pressable
            onPress={openCreate}
            className="rounded-xl bg-emerald px-4 py-2"
            accessibilityRole="button"
          >
            <Text className="text-sm font-semibold text-white">
              {t('settings.categories.actions.add')}
            </Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerClassName="px-6 py-6">
        {error ? (
          <Text className="text-sm text-error">{error}</Text>
        ) : categories === null ? (
          <View className="items-center py-12">
            <Spinner size="md" />
          </View>
        ) : (
          <CategoryList categories={categories} onChanged={fetchCategories} />
        )}
      </ScrollView>

      <Drawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        ariaLabel={t('settings.categories.new.title')}
      >
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-page">
          <View className="flex-row items-center justify-between border-b border-border px-6 py-4">
            <Text className="text-[22px] font-extrabold text-text">
              {t('settings.categories.new.title')}
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
            <CreateCategoryForm
              key={createKey}
              onSuccess={() => {
                setCreateOpen(false)
                void fetchCategories()
              }}
            />
          </ScrollView>
        </SafeAreaView>
      </Drawer>
    </View>
  )
}
