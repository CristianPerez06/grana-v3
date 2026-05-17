'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { FormField } from '@/components/ui/form-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { requestPasswordResetAction } from '@/app/_actions/request-password-reset'
import {
  forgotSchema,
  type ForgotInput,
  translateFieldError,
} from '@grana/validation'

export const ForgotPasswordForm = () => {
  const t = useTranslations('auth.forgot')
  const tv = useTranslations('validation')
  const fieldError = (msg: string | undefined) => translateFieldError(msg, tv)
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotInput>({
    resolver: yupResolver(forgotSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const result = await requestPasswordResetAction(values)
    if (result.ok) {
      setSubmitted(true)
      return
    }
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (message) setError(field as keyof ForgotInput, { message })
      }
    }
    if (result.formError) setFormError(result.formError)
  })

  if (submitted) return <Alert variant="info">{t('sent_notice')}</Alert>

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormField
        label={t('email_label')}
        type="email"
        autoComplete="email"
        error={fieldError(errors.email?.message)}
        {...register('email')}
      />
      {formError && <Alert variant="error">{formError}</Alert>}
      <SubmitButton pending={isSubmitting} className="w-full">
        {t('submit')}
      </SubmitButton>
    </form>
  )
}
