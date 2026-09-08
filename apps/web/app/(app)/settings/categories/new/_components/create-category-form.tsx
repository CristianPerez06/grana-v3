'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { FormField } from '@/components/ui/form-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { invalidateAfterCategoryMutation } from '@/lib/transactions/invalidation'
import { createCategory } from '@/app/_actions/categories'
import { createCategorySchema } from '@grana/validation'
import { IconPicker } from '../../_components/icon-picker'
import { ColorPicker } from '../../_components/color-picker'
import { HouseholdScopeField } from '../../_components/household-scope-field'

const TYPE_VALUES = ['expense', 'income', 'both'] as const

type Props = {
  /** Whether the user belongs to an active household. Shows the "Es del hogar" control. */
  hasHousehold?: boolean
  /** `'drawer'` renders the hi-fi shell; `'page'` renders the body inline (fallback route). */
  variant?: 'drawer' | 'page'
  /** Drawer chrome: close handler for the header ✕ / footer cancel. */
  onClose?: () => void
  /** When provided, a successful create refreshes the list and calls this instead of navigating. */
  onSuccess?: () => void
}

export const CreateCategoryForm = ({
  hasHousehold = false,
  variant = 'page',
  onClose,
  onSuccess,
}: Props) => {
  const t = useTranslations('settings.categories')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const isDrawer = variant === 'drawer'

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(createCategorySchema),
    defaultValues: { name: '', type: 'expense' as const, icon: '', color: '', scope: 'own' as const },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const result = await createCategory({
      ...values,
      icon: values.icon || null,
      color: values.color || null,
    })
    if (result.ok) {
      // Refresh the react-query categories cache so the new category appears in
      // the movement form's category picker without a manual page refresh.
      invalidateAfterCategoryMutation(queryClient)
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
        if (message) setError(field as 'name' | 'type' | 'icon' | 'color' | 'scope', { message })
      }
    }
    if (result.formError) setFormError(result.formError)
  })

  const fields = (
    <>
      <FormField
        label={t('form.name_label')}
        placeholder={t('form.name_placeholder')}
        error={errors.name?.message}
        {...register('name')}
      />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          {t('form.type_label')}
        </label>
        <select
          {...register('type')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`types.${value}`)}
            </option>
          ))}
        </select>
        {errors.type?.message && (
          <p className="text-xs text-destructive">{errors.type.message}</p>
        )}
      </div>
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
      {hasHousehold && (
        <Controller
          control={control}
          name="scope"
          render={({ field }) => (
            <HouseholdScopeField
              checked={field.value === 'household'}
              onChange={(checked) => field.onChange(checked ? 'household' : 'own')}
            />
          )}
        />
      )}
    </>
  )

  if (isDrawer) {
    return (
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
        <header className="shrink-0 border-b border-border bg-card px-5 pb-5 pt-[22px] sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-deep">
                {t('label')}
              </p>
              <h2 className="truncate text-[20px] font-extrabold leading-tight tracking-[-0.03em] text-text sm:text-[25px]">
                {t('new.title')}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-7 pt-[22px] sm:px-7">
          <div className="flex flex-col gap-4">
            {formError && <Alert variant="error">{formError}</Alert>}
            {fields}
          </div>
        </div>

        <footer className="shrink-0 border-t border-border bg-card px-5 py-4 sm:px-7">
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
              {t('form.submit_create')}
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
        {t('form.submit_create')}
      </SubmitButton>
    </form>
  )
}
