import { useLocalSearchParams } from 'expo-router'
import { FormScreen } from '../../../../../../components/layout/FormScreen'
import { CreateSubcategoryForm } from '../../../../../../components/categories/CreateSubcategoryForm'
import { useT } from '../../../../../../lib/locale-context'

export default function NewSubcategoryScreen() {
  const t = useT()
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <FormScreen
      title={t('settings.categories.subcategories.new.title')}
      backLink={{
        href: `/(app)/settings/categories/${id ?? ''}/subcategories`,
        label: t('settings.categories.subcategories.title'),
      }}
      contentClassName="px-6 py-6"
    >
      {id ? <CreateSubcategoryForm categoryId={id} /> : null}
    </FormScreen>
  )
}
