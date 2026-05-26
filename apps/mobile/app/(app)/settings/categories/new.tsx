import { ScrollView, View } from 'react-native'
import { PageHeader } from '../../../../components/ui/PageHeader'
import { CreateCategoryForm } from '../../../../components/categories/CreateCategoryForm'
import { useT } from '../../../../lib/locale-context'

export default function NewCategoryScreen() {
  const t = useT()

  return (
    <View className="flex-1 bg-background">
      <PageHeader
        title={t('settings.categories.new.title')}
        backLink={{
          href: '/(app)/settings/categories',
          label: t('settings.categories.label'),
        }}
      />
      <ScrollView
        contentContainerClassName="px-6 py-6"
        keyboardShouldPersistTaps="handled"
      >
        <CreateCategoryForm />
      </ScrollView>
    </View>
  )
}
