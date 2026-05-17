'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { FormField } from '@/components/ui/form-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import { createSubcategory } from '@/app/_actions/categories'
import { createSubcategorySchema, type CreateSubcategoryInput } from '@grana/validation'

type Props = { categoryId: string }

export const CreateSubcategoryForm = ({ categoryId }: Props) => {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateSubcategoryInput>({
    resolver: yupResolver(createSubcategorySchema),
    defaultValues: { category_id: categoryId, name: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const result = await createSubcategory(values)
    if (result.ok) {
      router.push(`/settings/categories/${categoryId}/subcategories`)
      return
    }
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (message) setError(field as keyof CreateSubcategoryInput, { message })
      }
    }
    if (result.formError) setFormError(result.formError)
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register('category_id')} />
      <FormField
        label="Nombre"
        placeholder="Ej: Farmacéuticos"
        error={errors.name?.message}
        {...register('name')}
      />
      {formError && <Alert variant="error">{formError}</Alert>}
      <SubmitButton pending={isSubmitting} className="w-full">
        Guardar subcategoría
      </SubmitButton>
    </form>
  )
}
