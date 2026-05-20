'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { PasswordField } from '@/components/ui/password-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { AUTH_INPUT_CLASS } from '@/lib/auth-class-names'
import { createClient } from '@/lib/supabase/client'
import { loginAction } from '@/app/_actions/login'
import {
  loginSchema,
  type LoginInput,
  translateFieldError,
} from '@grana/validation'

type InitialNotice = { variant: 'success' | 'error'; text: string } | null

export const LoginForm = ({ initialNotice }: { initialNotice: InitialNotice }) => {
  const t = useTranslations('auth.login')
  const tAll = useTranslations()
  const tv = useTranslations('validation')
  const fieldError = (msg: string | undefined) => translateFieldError(msg, tv)
  const router = useRouter()
  const supabase = createClient()

  const [formError, setFormError] = useState<string | null>(null)
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: yupResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    setUnconfirmedEmail(null)
    const result = await loginAction(values)
    if (!result || result.ok) return
    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (message) setError(field as keyof LoginInput, { message })
      }
    }
    if (result.errorCode === 'email_not_confirmed') {
      setUnconfirmedEmail(values.email)
      setFormError(tAll('auth.errors.email_not_confirmed_with_resend'))
      return
    }
    if (result.formError) setFormError(result.formError)
  })

  const handleResend = async () => {
    const email = unconfirmedEmail ?? getValues('email')
    if (!email) return
    setResending(true)
    // Best-effort resend; if the server rate-limits we still navigate — the
    // verify screen's cooldown takes over and the user can retry there.
    await supabase.auth.resend({ email, type: 'signup' })
    router.push(`/signup/verify?email=${encodeURIComponent(email)}`)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {initialNotice && (
        <Alert variant={initialNotice.variant}>{initialNotice.text}</Alert>
      )}
      <FormField
        label={t('email_label')}
        type="email"
        autoComplete="email"
        className={AUTH_INPUT_CLASS}
        error={fieldError(errors.email?.message)}
        {...register('email')}
      />
      <PasswordField
        label={t('password_label')}
        autoComplete="current-password"
        className={AUTH_INPUT_CLASS}
        error={fieldError(errors.password?.message)}
        {...register('password')}
      />
      {formError && (
        <Alert variant={unconfirmedEmail ? 'warning' : 'error'}>
          <div className="flex flex-col gap-2">
            <span>{formError}</span>
            {unconfirmedEmail && (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={handleResend}
                loading={resending}
                className="self-start"
              >
                {t('resend_confirmation_code')}
              </Button>
            )}
          </div>
        </Alert>
      )}
      <SubmitButton pending={isSubmitting} className="w-full">
        {t('submit')}
      </SubmitButton>
    </form>
  )
}
