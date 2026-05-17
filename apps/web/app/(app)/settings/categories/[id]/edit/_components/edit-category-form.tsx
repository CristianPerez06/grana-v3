'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { FormField } from '@/components/ui/form-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import { updateCategory } from '@/app/_actions/categories'
import { updateCategorySchema } from '@grana/validation'
import type { Category } from '@/lib/categories/types'

type Props = { category: Category }

export const EditCategoryForm = ({ category }: Props) => {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
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
        label="Nombre"
        error={errors.name?.message}
        {...register('name')}
      />
      <FormField
        label="Ícono (emoji)"
        placeholder="Ej: 🐾"
        error={errors.icon?.message}
        {...register('icon')}
      />
      <FormField
        label="Color (hex)"
        placeholder="Ej: #FF6B6B"
        error={errors.color?.message}
        {...register('color')}
      />
      {formError && <Alert variant="error">{formError}</Alert>}
      <SubmitButton pending={isSubmitting} className="w-full">
        Guardar cambios
      </SubmitButton>
    </form>
  )
}
