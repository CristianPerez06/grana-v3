import { useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../ui/Button'
import { FormField } from '../ui/FormField'
import { FormError } from '../ui/FormError'
import { createSubcategory } from '../../lib/categories'
import { invalidateAfterCategoryMutation } from '../../lib/categories-invalidate'
import { useT } from '../../lib/locale-context'

type Props = {
  categoryId: string
  /** When provided, a successful create calls this instead of navigating (sheet host closes + refetches). */
  onSuccess?: () => void
}

export function CreateSubcategoryForm({ categoryId, onSuccess }: Props) {
  const t = useT()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [name, setName] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setFormError(null)
    setFieldErrors({})
    setSubmitting(true)
    const result = await createSubcategory({ category_id: categoryId, name })
    setSubmitting(false)
    if (result.ok) {
      invalidateAfterCategoryMutation(queryClient)
      if (onSuccess) onSuccess()
      else router.back()
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
        placeholder={t('settings.categories.subcategories.new.name_placeholder')}
        error={fieldErrors.name}
      />

      <FormError message={formError} />

      <Button onPress={handleSubmit} loading={submitting}>
        {t('settings.categories.subcategories.new.submit')}
      </Button>
    </View>
  )
}
