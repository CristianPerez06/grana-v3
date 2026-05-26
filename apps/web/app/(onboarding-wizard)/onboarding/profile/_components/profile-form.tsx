'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  profileSchema,
  type ProfileInput,
  translateFieldError,
} from '@grana/validation'
import { saveProfileAction } from '@/app/_actions/onboarding'
import { cn } from '@/lib/utils'

type Institution = { id: string; name: string }

type Props = {
  institutions: Institution[]
}

export const ProfileForm = ({ institutions }: Props) => {
  const t = useTranslations('onboarding.profile')
  const tv = useTranslations('validation')
  const tErr = useTranslations('onboarding.errors')
  const fieldError = (msg: string | undefined) => translateFieldError(msg, tv)
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      mode: undefined as unknown as ProfileInput['mode'],
      has_bank_account: false,
      institution_id: null,
      bank_account_name: undefined,
    },
  })

  const mode = watch('mode')
  const hasBankAccount = watch('has_bank_account')

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const result = await saveProfileAction(values)
    if (result.ok) {
      router.push('/onboarding/initial-balance')
      return
    }
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (message) setError(field as keyof ProfileInput, { message })
      }
    }
    if (result.formError) setFormError(result.formError)
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate>
      <header className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      </header>

      <section className="flex flex-col gap-3">
        <p className="text-sm font-medium">{t('mode_question')}</p>
        <Controller
          control={control}
          name="mode"
          render={({ field }) => (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ModeCard
                title={t('mode_simple_title')}
                description={t('mode_simple_description')}
                selected={field.value === 'novato'}
                onClick={() => field.onChange('novato')}
              />
              <ModeCard
                title={t('mode_detailed_title')}
                description={t('mode_detailed_description')}
                selected={field.value === 'experto'}
                onClick={() => field.onChange('experto')}
              />
            </div>
          )}
        />
        {errors.mode && (
          <p className="text-xs text-error">{tErr('mode_required')}</p>
        )}
      </section>

      {mode === 'experto' && (
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium">{t('bank_question')}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={hasBankAccount ? 'primary' : 'secondary'}
              onClick={() => setValue('has_bank_account', true, { shouldValidate: true })}
            >
              {t('bank_yes')}
            </Button>
            <Button
              type="button"
              variant={!hasBankAccount ? 'primary' : 'secondary'}
              onClick={() => {
                setValue('has_bank_account', false, { shouldValidate: true })
                setValue('institution_id', null)
                setValue('bank_account_name', undefined)
              }}
            >
              {t('bank_no')}
            </Button>
          </div>

          {hasBankAccount && (
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-text" htmlFor="institution_id">
                  {t('institution_label')}
                </label>
                <select
                  id="institution_id"
                  className="h-11 rounded-[var(--radius-md)] border border-border bg-card px-3 text-sm"
                  {...register('institution_id')}
                >
                  <option value="">{t('institution_placeholder')}</option>
                  {institutions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                {errors.institution_id && (
                  <p className="text-xs text-error">{tErr('institution_required')}</p>
                )}
              </div>

              <FormField
                label={t('account_name_label')}
                placeholder={t('account_name_placeholder')}
                error={
                  errors.bank_account_name
                    ? fieldError(errors.bank_account_name.message) ?? tErr('account_name_required')
                    : undefined
                }
                {...register('bank_account_name')}
              />
            </div>
          )}
        </section>
      )}

      {formError && <Alert variant="error">{formError}</Alert>}

      <SubmitButton pending={isSubmitting}>{t('continue')}</SubmitButton>
    </form>
  )
}

type ModeCardProps = {
  title: string
  description: string
  selected: boolean
  onClick: () => void
}

const ModeCard = ({ title, description, selected, onClick }: ModeCardProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={cn(
      'flex flex-col gap-2 rounded-[var(--radius-lg)] border-2 bg-card p-4 text-left transition-colors',
      selected
        ? 'border-emerald bg-emerald/5'
        : 'border-border hover:border-border-strong',
    )}
  >
    <span className="text-base font-semibold">{title}</span>
    <p className="text-sm text-text-muted">{description}</p>
  </button>
)
