import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { PageHeader } from '../../../../../../components/ui/PageHeader'
import { CreateSubcategoryForm } from '../../../../../../components/categories/CreateSubcategoryForm'
import { useT } from '../../../../../../lib/locale-context'

export default function NewSubcategoryScreen() {
  const t = useT()
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerClassName="px-6 py-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-col gap-6">
          <PageHeader
            title={t('settings.categories.subcategories.new.title')}
            backLink={{
              href: `/(app)/settings/categories/${id ?? ''}/subcategories`,
              label: t('settings.categories.subcategories.title'),
            }}
          />
          {id ? <CreateSubcategoryForm categoryId={id} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
