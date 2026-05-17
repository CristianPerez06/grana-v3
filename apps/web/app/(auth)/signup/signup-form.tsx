'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { FormField } from '@/components/ui/form-field'
import { PasswordField } from '@/components/ui/password-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { signupAction } from '@/app/_actions/signup'
import {
  signupSchema,
  type SignupInput,
  translateFieldError,
} from '@grana/validation'

export const SignupForm = () => {
  const t = useTranslations('auth.signup')
  const tv = useTranslations('validation')
  const fieldError = (msg: string | undefined) => translateFieldError(msg, tv)
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: yupResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const result = await signupAction(values)
    if (result.ok) {
      setSubmitted(true)
      return
    }
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (message) setError(field as keyof SignupInput, { message })
      }
    }
    if (result.formError) setFormError(result.formError)
  })

  if (submitted) {
    return (
      <Alert variant="success" title={t('check_email_title')}>
        {t('check_email_body')}
      </Alert>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormField
        label={t('fullName_label')}
        autoComplete="name"
        error={fieldError(errors.fullName?.message)}
        {...register('fullName')}
      />
      <FormField
        label={t('email_label')}
        type="email"
        autoComplete="email"
        error={fieldError(errors.email?.message)}
        {...register('email')}
      />
      <PasswordField
        label={t('password_label')}
        autoComplete="new-password"
        error={fieldError(errors.password?.message)}
        {...register('password')}
      />
      <PasswordField
        label={t('confirm_label')}
        autoComplete="new-password"
        error={fieldError(errors.confirmPassword?.message)}
        {...register('confirmPassword')}
      />
      {formError && <Alert variant="error">{formError}</Alert>}
      <SubmitButton pending={isSubmitting} className="w-full">
        {t('submit')}
      </SubmitButton>
    </form>
  )
}
