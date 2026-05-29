import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { otpCodeSchema } from '@grana/validation'
import { supabase } from '../../lib/supabase'
import { mapSupabaseError } from '../../lib/supabase-errors'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { FormError } from '../ui/FormError'
import { FormField } from '../ui/FormField'
import { AUTH_INPUT_CLASS } from '../../lib/auth-class-names'

const RESEND_COOLDOWN_SECONDS = 60

type Props = {
  email: string
  type: 'signup' | 'recovery'
  onVerified: () => void | Promise<void>
}

export function OtpVerifyForm({ email, type, onVerified }: Props) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  async function handleSubmit() {
    setError(null)
    setNotice(null)
    try {
      await otpCodeSchema.validate({ code })
    } catch {
      setError('El código debe tener exactamente 8 dígitos.')
      return
    }
    setSubmitting(true)
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type,
    })
    setSubmitting(false)
    if (verifyError) {
      setError(mapSupabaseError(verifyError))
      return
    }
    await onVerified()
  }

  async function handleResend() {
    setError(null)
    setNotice(null)
    setResending(true)
    const { error: resendError } =
      type === 'signup'
        ? await supabase.auth.resend({ email, type: 'signup' })
        : await supabase.auth.resetPasswordForEmail(email)
    setResending(false)
    if (resendError) {
      setError(mapSupabaseError(resendError))
      return
    }
    setNotice('Te enviamos un código nuevo.')
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  const resendDisabled = cooldown > 0 || resending
  const resendLabel =
    cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'

  return (
    <View>
      <FormField
        label="Código"
        value={code}
        onChangeText={setCode}
        placeholder="12345678"
        keyboardType="number-pad"
        maxLength={8}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        className={AUTH_INPUT_CLASS}
      />

      <FormError message={error} />
      {notice ? (
        <View className="mt-2">
          <Alert variant="success">{notice}</Alert>
        </View>
      ) : null}

      <View className="mt-4">
        <Button title="Verificar" onPress={handleSubmit} loading={submitting} />
      </View>

      <Pressable
        onPress={handleResend}
        disabled={resendDisabled}
        className="mt-4 items-center"
      >
        <Text
          className={`text-sm font-medium ${
            resendDisabled ? 'text-muted-foreground' : 'text-primary'
          }`}
        >
          {resendLabel}
        </Text>
      </Pressable>
    </View>
  )
}
