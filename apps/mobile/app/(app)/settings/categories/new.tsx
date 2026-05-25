import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { PageHeader } from '../../../../components/ui/PageHeader'
import { CreateCategoryForm } from '../../../../components/categories/CreateCategoryForm'
import { useT } from '../../../../lib/locale-context'

export default function NewCategoryScreen() {
  const t = useT()

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerClassName="px-6 py-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-col gap-6">
          <PageHeader
            title={t('settings.categories.new.title')}
            backLink={{
              href: '/(app)/settings/categories',
              label: t('settings.categories.label'),
            }}
          />
          <CreateCategoryForm />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
