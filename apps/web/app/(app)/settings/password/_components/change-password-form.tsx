'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { CheckCircle2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  changePasswordSchema,
  translateFieldError,
  type ChangePasswordInput,
} from '@grana/validation'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordField } from '@/components/ui/password-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { createClient } from '@/lib/supabase/client'
import { verifyCurrentPassword } from '@/lib/supabase/verification-client'
import { mapSupabaseError } from '@/lib/supabase/errors'

export const ChangePasswordForm = () => {
  const t = useTranslations('settings.security.change_password')
  const tv = useTranslations('validation')
  const tAll = useTranslations()
  const fieldError = (msg: string | undefined) => translateFieldError(msg, tv)

  const supabase = createClient()

  // `null` while the form is live; once set, the form unmounts and the success
  // card takes its place. `othersRevoked` carries the outcome of the last,
  // best-effort step — the password change already happened either way.
  const [outcome, setOutcome] = useState<{ othersRevoked: boolean } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: yupResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)

    const { data: userData } = await supabase.auth.getUser()
    const email = userData.user?.email
    if (!email) {
      setFormError(tAll('auth.errors.generic'))
      return
    }

    // 1. Verify the current password on a throwaway client, so the live
    //    session survives untouched whatever happens next.
    const verifyError = await verifyCurrentPassword(email, values.currentPassword)
    if (verifyError) {
      if (verifyError.code === 'invalid_credentials') {
        // Not `mapSupabaseError`: its copy for this code names the email
        // ("Incorrect email or password"), which is right for the login form
        // and misleading here — the only thing to fix is this one field.
        setError('currentPassword', { message: t('errors.current_incorrect') })
      } else {
        setFormError(mapSupabaseError(verifyError, tAll))
      }
      return
    }

    // 2. The irreversible step.
    const { error: updateError } = await supabase.auth.updateUser({
      password: values.password,
    })
    if (updateError) {
      setFormError(mapSupabaseError(updateError, tAll))
      return
    }

    // 3. Revoke every other device. `scope: 'others'` is load-bearing: the
    //    SDK default is 'global', which would sign the user out right here,
    //    and 'others' fires no SIGNED_OUT event. Failure is reported on the
    //    success card, never swallowed — the password did change.
    const { error: revokeError } = await supabase.auth.signOut({ scope: 'others' })
    setOutcome({ othersRevoked: !revokeError })
  })

  if (outcome) {
    return (
      <Card className="max-w-md">
        <CardHeader className="flex-row items-center gap-3">
          <CheckCircle2 className="size-6 shrink-0 text-emerald-deep" aria-hidden />
          <CardTitle>{t('success_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={
              outcome.othersRevoked
                ? 'text-sm text-text-muted'
                : 'text-sm text-warning-deep'
            }
          >
            {outcome.othersRevoked
              ? t('success_body')
              : t('success_body_revoke_failed')}
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="secondary" asChild className="w-auto">
            <Link href="/settings">{t('back_cta')}</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-4" noValidate>
      <PasswordField
        label={t('current_label')}
        autoComplete="current-password"
        toggleLabelShow={t('toggle_show')}
        toggleLabelHide={t('toggle_hide')}
        error={fieldError(errors.currentPassword?.message)}
        {...register('currentPassword')}
      />
      <PasswordField
        label={t('new_label')}
        autoComplete="new-password"
        toggleLabelShow={t('toggle_show')}
        toggleLabelHide={t('toggle_hide')}
        error={fieldError(errors.password?.message)}
        {...register('password')}
      />
      <PasswordField
        label={t('confirm_label')}
        autoComplete="new-password"
        toggleLabelShow={t('toggle_show')}
        toggleLabelHide={t('toggle_hide')}
        error={fieldError(errors.confirmPassword?.message)}
        {...register('confirmPassword')}
      />
      {formError && <Alert variant="error">{formError}</Alert>}
      <SubmitButton pending={isSubmitting} className="w-auto self-start">
        {t('submit')}
      </SubmitButton>
    </form>
  )
}
