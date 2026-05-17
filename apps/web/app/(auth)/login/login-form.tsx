'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { FormField } from '@/components/ui/form-field'
import { PasswordField } from '@/components/ui/password-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { loginAction } from '@/app/_actions/login'
import {
  loginSchema,
  type LoginInput,
  translateFieldError,
} from '@grana/validation'

type InitialNotice = { variant: 'success' | 'error'; text: string } | null

export const LoginForm = ({ initialNotice }: { initialNotice: InitialNotice }) => {
  const t = useTranslations('auth.login')
  const tv = useTranslations('validation')
  const fieldError = (msg: string | undefined) => translateFieldError(msg, tv)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: yupResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const result = await loginAction(values)
    if (!result || result.ok) return
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (message) setError(field as keyof LoginInput, { message })
      }
    }
    if (result.formError) setFormError(result.formError)
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {initialNotice && (
        <Alert variant={initialNotice.variant}>{initialNotice.text}</Alert>
      )}
      <FormField
        label={t('email_label')}
        type="email"
        autoComplete="email"
        error={fieldError(errors.email?.message)}
        {...register('email')}
      />
      <PasswordField
        label={t('password_label')}
        autoComplete="current-password"
        error={fieldError(errors.password?.message)}
        {...register('password')}
      />
      {formError && <Alert variant="error">{formError}</Alert>}
      <SubmitButton pending={isSubmitting} className="w-full">
        {t('submit')}
      </SubmitButton>
    </form>
  )
}
