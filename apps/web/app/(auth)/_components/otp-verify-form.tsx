'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { SubmitButton } from '@/components/ui/submit-button'
import { AUTH_INPUT_CLASS } from '@/lib/auth-class-names'
import { createClient } from '@/lib/supabase/client'
import { supabaseErrorKey } from '@/lib/supabase/errors'
import {
  otpCodeSchema,
  type OtpCodeInput,
  translateFieldError,
} from '@grana/validation'

const RESEND_COOLDOWN_SECONDS = 60

type OtpVerifyFormProps = {
  email: string
  type: 'signup' | 'recovery'
  onVerified: () => Promise<void> | void
}

export const OtpVerifyForm = ({ email, type, onVerified }: OtpVerifyFormProps) => {
  const t = useTranslations()
  const tv = useTranslations('validation')
  const fieldError = (msg: string | undefined) => translateFieldError(msg, tv)

  const supabase = createClient()

  const [formErrorKey, setFormErrorKey] = useState<string | null>(null)
  const [resendNotice, setResendNotice] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState<number>(RESEND_COOLDOWN_SECONDS)
  const [resending, setResending] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OtpCodeInput>({
    resolver: yupResolver(otpCodeSchema),
    defaultValues: { code: '' },
  })

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  const onSubmit = handleSubmit(async ({ code }) => {
    setFormErrorKey(null)
    setResendNotice(null)
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type })
    if (error) {
      setFormErrorKey(supabaseErrorKey(error))
      return
    }
    await onVerified()
  })

  const handleResend = async () => {
    setFormErrorKey(null)
    setResendNotice(null)
    setResending(true)
    const { error } =
      type === 'signup'
        ? await supabase.auth.resend({ email, type: 'signup' })
        : await supabase.auth.resetPasswordForEmail(email)
    setResending(false)
    if (error) {
      setFormErrorKey(supabaseErrorKey(error))
      return
    }
    setResendNotice(t('auth.resend.sent_notice'))
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  const resendLabel =
    cooldown > 0
      ? t('auth.resend.button_cooldown', { seconds: cooldown })
      : t('auth.resend.button')

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormField
        label={t('auth.verify.code_label')}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={8}
        placeholder={t('auth.verify.code_placeholder')}
        className={AUTH_INPUT_CLASS}
        error={fieldError(errors.code?.message)}
        {...register('code')}
      />
      {formErrorKey && <Alert variant="error">{t(formErrorKey)}</Alert>}
      {resendNotice && <Alert variant="success">{resendNotice}</Alert>}
      <SubmitButton pending={isSubmitting} className="w-full">
        {t('auth.verify.submit')}
      </SubmitButton>
      <Button
        type="button"
        variant="link"
        size="sm"
        onClick={handleResend}
        disabled={cooldown > 0 || resending}
      >
        {resendLabel}
      </Button>
    </form>
  )
}
