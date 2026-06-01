'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useTranslations } from 'next-intl'
import { FormField } from '@/components/ui/form-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import { updateCategory } from '@/app/_actions/categories'
import { updateCategorySchema } from '@grana/validation'
import type { Category } from '@/lib/categories/types'
import { IconPicker } from '../../../_components/icon-picker'
import { ColorPicker } from '../../../_components/color-picker'

type Props = { category: Category }

export const EditCategoryForm = ({ category }: Props) => {
  const t = useTranslations('settings.categories')
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(updateCategorySchema),
    defaultValues: {
      name: category.name,
      icon: category.icon ?? '',
      color: category.color ?? '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const result = await updateCategory(category.id, {
      ...values,
      icon: values.icon || null,
      color: values.color || null,
    })
    if (result.ok) {
      router.push('/settings/categories')
      return
    }
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (message) setError(field as 'name' | 'icon' | 'color', { message })
      }
    }
    if (result.formError) setFormError(result.formError)
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormField
        label={t('form.name_label')}
        error={errors.name?.message}
        {...register('name')}
      />
      <Controller
        control={control}
        name="icon"
        render={({ field }) => (
          <IconPicker value={field.value ?? ''} onChange={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <ColorPicker value={field.value ?? ''} onChange={field.onChange} />
        )}
      />
      {errors.color?.message && (
        <p className="text-xs text-destructive">{errors.color.message}</p>
      )}
      {formError && <Alert variant="error">{formError}</Alert>}
      <SubmitButton pending={isSubmitting} className="w-full">
        {t('form.submit_update')}
      </SubmitButton>
    </form>
  )
}
