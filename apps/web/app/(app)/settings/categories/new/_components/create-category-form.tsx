'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { FormField } from '@/components/ui/form-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Alert } from '@/components/ui/alert'
import { createCategory } from '@/app/_actions/categories'
import { createCategorySchema } from '@grana/validation'

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Gasto' },
  { value: 'income', label: 'Ingreso' },
  { value: 'both', label: 'Ambos' },
]

export const CreateCategoryForm = () => {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(createCategorySchema),
    defaultValues: { name: '', type: 'expense' as const, icon: '', color: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const result = await createCategory({
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
        if (message) setError(field as 'name' | 'type' | 'icon' | 'color', { message })
      }
    }
    if (result.formError) setFormError(result.formError)
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormField
        label="Nombre"
        placeholder="Ej: Mascotas"
        error={errors.name?.message}
        {...register('name')}
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Tipo</label>
        <select
          {...register('type')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {errors.type?.message && (
          <p className="text-xs text-destructive">{errors.type.message}</p>
        )}
      </div>
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
        Guardar categoría
      </SubmitButton>
    </form>
  )
}
