import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Button } from '../ui/Button'
import { FormField } from '../ui/FormField'
import { FormError } from '../ui/FormError'
import { createCategory, type CategoryType } from '../../lib/categories'
import { useT } from '../../lib/locale-context'

const TYPE_OPTIONS: CategoryType[] = ['expense', 'income', 'both']

export function CreateCategoryForm() {
  const t = useT()
  const router = useRouter()

  const [name, setName] = useState('')
  const [type, setType] = useState<CategoryType>('expense')
  const [icon, setIcon] = useState('')
  const [color, setColor] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setFormError(null)
    setFieldErrors({})
    setSubmitting(true)
    const result = await createCategory({
      name,
      type,
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
        placeholder={t('settings.categories.form.name_placeholder')}
        error={fieldErrors.name}
      />

      <View className="flex-col gap-1.5">
        <Text className="text-sm font-medium text-text">
          {t('settings.categories.form.type_label')}
        </Text>
        <View className="flex-row gap-2">
          {TYPE_OPTIONS.map((option) => {
            const active = type === option
            return (
              <Pressable
                key={option}
                onPress={() => setType(option)}
                className={`flex-1 rounded-xl border px-3 py-2 ${
                  active ? 'border-emerald bg-emerald-soft' : 'border-border-soft bg-card'
                }`}
              >
                <Text
                  className={`text-center text-sm ${
                    active ? 'font-semibold text-text' : 'text-text-soft'
                  }`}
                >
                  {t(`settings.categories.types.${option}`)}
                </Text>
              </Pressable>
            )
          })}
        </View>
        {fieldErrors.type && (
          <Text className="text-xs text-error">{fieldErrors.type}</Text>
        )}
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
        placeholder={t('settings.categories.form.color_placeholder')}
        autoCapitalize="none"
        error={fieldErrors.color}
      />

      <FormError message={formError} />

      <Button onPress={handleSubmit} loading={submitting}>
        {t('settings.categories.form.submit_create')}
      </Button>
    </View>
  )
}
