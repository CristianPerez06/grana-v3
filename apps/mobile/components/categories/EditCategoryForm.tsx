import { useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { FormField } from '../ui/FormField'
import { FormError } from '../ui/FormError'
import { updateCategory, type Category } from '../../lib/categories'
import { useT } from '../../lib/locale-context'

type Props = { category: Category }

export function EditCategoryForm({ category }: Props) {
  const t = useT()
  const router = useRouter()
  const isSystem = category.user_id === null

  const [name, setName] = useState(category.name)
  const [icon, setIcon] = useState(category.icon ?? '')
  const [color, setColor] = useState(category.color ?? '')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isSystem) {
    return (
      <Alert variant="warning">
        {t('settings.categories.errors.system_readonly')}
      </Alert>
    )
  }

  const handleSubmit = async () => {
    setFormError(null)
    setFieldErrors({})
    setSubmitting(true)
    const result = await updateCategory(category.id, {
      name,
      icon: icon || null,
      color: color || null,
    })
    setSubmitting(false)
    if (result.ok) {
      router.back()
      return
    }
    if (result.fieldErrors) {
      setFieldErrors(result.fieldErrors)
    } else {
      setFormError(t(result.errorKey))
    }
  }

  return (
    <View className="flex-col gap-4">
      <FormField
        label={t('settings.categories.form.name_label')}
        value={name}
        onChangeText={setName}
        error={fieldErrors.name}
      />

      <View className="flex-col gap-1.5">
        <Text className="text-sm font-medium text-text">
          {t('settings.categories.form.type_label')}
        </Text>
        <View className="rounded-xl border border-border-soft bg-card px-3 py-2">
          <Text className="text-sm text-text-soft">
            {t(`settings.categories.types.${category.type}`)}
          </Text>
        </View>
      </View>

      <FormField
        label={t('settings.categories.form.icon_label')}
        value={icon}
        onChangeText={setIcon}
        placeholder={t('settings.categories.form.icon_placeholder')}
        error={fieldErrors.icon}
      />

      <FormField
        label={t('settings.categories.form.color_label')}
        value={color}
        onChangeText={setColor}
        autoCapitalize="none"
        placeholder={t('settings.categories.form.color_placeholder')}
        error={fieldErrors.color}
      />

      <FormError message={formError} />

      <Button onPress={handleSubmit} loading={submitting}>
        {t('settings.categories.form.submit_update')}
      </Button>
    </View>
  )
}
