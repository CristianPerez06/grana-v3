'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { PasswordField } from '@/components/ui/password-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Spinner } from '@/components/ui/spinner'
import { AuthShell } from '@/components/layout/auth-shell'
import { AUTH_INPUT_CLASS } from '@/lib/auth-class-names'
import { createClient } from '@/lib/supabase/client'
import { mapSupabaseError } from '@/lib/supabase/errors'
import {
  resetSchema,
  type ResetInput,
  translateFieldError,
} from '@grana/validation'

type JwtAmrEntry = { method?: string }

const hasRecoveryClaim = (accessToken: string): boolean => {
  const parts = accessToken.split('.')
  if (parts.length < 2) return false
  try {
    const padded = parts[1].padEnd(
      parts[1].length + ((4 - (parts[1].length % 4)) % 4),
      '=',
    )
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as { amr?: JwtAmrEntry[] }
    return (payload.amr ?? []).some((entry) => entry.method === 'otp')
  } catch {
    return false
  }
}

const ResetPasswordPage = () => {
  const t = useTranslations('auth.reset')
  const tv = useTranslations('validation')
  const tAll = useTranslations()
  const fieldError = (msg: string | undefined) => translateFieldError(msg, tv)

  const supabase = createClient()

  const [checkingSession, setCheckingSession] = useState(true)
  const [hasRecovery, setHasRecovery] = useState(false)
  const [updated, setUpdated] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetInput>({
    resolver: yupResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token
      setHasRecovery(Boolean(token && hasRecoveryClaim(token)))
      setCheckingSession(false)
    })
  }, [supabase])

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const { error: updateError } = await supabase.auth.updateUser({
      password: values.password,
    })

    if (updateError) {
      setFormError(mapSupabaseError(updateError, tAll))
      return
    }

    await supabase.auth.signOut()
    setUpdated(true)
  })

  if (checkingSession) {
    return (
      <AuthShell title={t('title')} subtitle={t('description')}>
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      </AuthShell>
    )
  }

  if (updated) {
    return (
      <AuthShell
        title={t('success_title')}
        subtitle={t('success_body')}
      >
        <Button asChild className="w-full">
          <Link href="/login">{t('go_to_login')}</Link>
        </Button>
      </AuthShell>
    )
  }

  if (!hasRecovery) {
    return (
      <AuthShell
        title={t('invalid_link_title')}
        subtitle={t('invalid_link')}
      >
        <div className="flex justify-center">
          <Button variant="link" size="sm" asChild>
            <Link href="/forgot-password">{t('go_to_forgot')}</Link>
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title={t('title')} subtitle={t('description')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <PasswordField
          label={t('password_label')}
          autoComplete="new-password"
          className={AUTH_INPUT_CLASS}
          error={fieldError(errors.password?.message)}
          {...register('password')}
        />
        <PasswordField
          label={t('confirm_label')}
          autoComplete="new-password"
          className={AUTH_INPUT_CLASS}
          error={fieldError(errors.confirmPassword?.message)}
          {...register('confirmPassword')}
        />
        {formError && <Alert variant="error">{formError}</Alert>}
        <SubmitButton pending={isSubmitting} className="w-full">
          {t('submit')}
        </SubmitButton>
      </form>
    </AuthShell>
  )
}

export default ResetPasswordPage
