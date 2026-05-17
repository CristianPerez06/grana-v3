'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PasswordField } from '@/components/ui/password-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Spinner } from '@/components/ui/spinner'
import { createClient } from '@/lib/supabase/client'
import { mapSupabaseError } from '@/lib/supabase/errors'
import { resetSchema, type ResetInput } from '@/lib/validation/auth'
import { translateFieldError } from '@/lib/validation/translate-error'

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
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetInput>({
    resolver: yupResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setHasRecovery(Boolean(data.user))
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
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Spinner />
        </CardContent>
      </Card>
    )
  }

  if (updated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('success_title')}</CardTitle>
          <CardDescription>{t('success_body')}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/login">{t('go_to_login')}</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  if (!hasRecovery) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('invalid_link_title')}</CardTitle>
          <CardDescription>{t('invalid_link')}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="link" size="sm" asChild>
            <Link href="/forgot-password">{t('go_to_forgot')}</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
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
      </CardContent>
    </Card>
  )
}

export default ResetPasswordPage
