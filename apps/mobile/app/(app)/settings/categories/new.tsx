import { FormScreen } from '../../../../components/layout/FormScreen'
import { CreateCategoryForm } from '../../../../components/categories/CreateCategoryForm'
import { useT } from '../../../../lib/locale-context'

export default function NewCategoryScreen() {
  const t = useT()

  return (
    <FormScreen
      title={t('settings.categories.new.title')}
      backLink={{
        href: '/(app)/settings/categories',
        label: t('settings.categories.label'),
      }}
      contentClassName="px-6 py-6"
    >
      <CreateCategoryForm />
    </FormScreen>
  )
}
