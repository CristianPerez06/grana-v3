'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { FormField } from '@/components/ui/form-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { updateCategory } from '@/app/_actions/categories'
import { updateCategorySchema } from '@grana/validation'
import type { Category } from '@/lib/categories/types'
import { IconPicker } from '../../../_components/icon-picker'
import { ColorPicker } from '../../../_components/color-picker'

type Props = {
  category: Category
  /** `'drawer'` renders the hi-fi shell; `'page'` renders the body inline (fallback route). */
  variant?: 'drawer' | 'page'
  /** Drawer chrome: close handler for the header ✕ / footer cancel. */
  onClose?: () => void
  /** When provided, a successful update refreshes the list and calls this instead of navigating. */
  onSuccess?: () => void
}

export const EditCategoryForm = ({ category, variant = 'page', onClose, onSuccess }: Props) => {
  const t = useTranslations('settings.categories')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const isDrawer = variant === 'drawer'

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
      if (onSuccess) {
        router.refresh()
        onSuccess()
      } else {
        router.push('/settings/categories')
      }
      return
    }
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (message) setError(field as 'name' | 'icon' | 'color', { message })
      }
    }
    if (result.formError) setFormError(result.formError)
  })

  const fields = (
    <>
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
    </>
  )

  if (isDrawer) {
    return (
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
        <header className="shrink-0 border-b border-border bg-card px-7 pb-5 pt-[22px]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-deep">
                {t('label')}
              </p>
              <h2 className="truncate text-[25px] font-extrabold leading-tight tracking-[-0.03em] text-text">
                {t('edit.title')}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={tCommon('close')}
              className="inline-flex size-[38px] shrink-0 items-center justify-center rounded-[11px] border border-border text-text transition-colors hover:bg-border-soft"
            >
              <X className="size-[18px]" aria-hidden />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7 pt-[22px]">
          <div className="flex flex-col gap-4">
            {formError && <Alert variant="error">{formError}</Alert>}
            {fields}
          </div>
        </div>

        <footer className="shrink-0 border-t border-border bg-card px-7 py-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="h-[52px] w-auto shrink-0 rounded-[14px] px-[22px] text-sm font-bold"
            >
              {tCommon('cancel')}
            </Button>
            <SubmitButton pending={isSubmitting} className="h-[52px] flex-1 rounded-[14px]">
              {t('form.submit_update')}
            </SubmitButton>
          </div>
        </footer>
      </form>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {fields}
      {formError && <Alert variant="error">{formError}</Alert>}
      <SubmitButton pending={isSubmitting} className="w-full">
        {t('form.submit_update')}
      </SubmitButton>
    </form>
  )
}
