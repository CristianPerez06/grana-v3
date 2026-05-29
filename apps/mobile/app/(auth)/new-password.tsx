import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useRouter } from 'expo-router'
import { resetSchema, ValidationError } from '@grana/validation'
import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { PasswordField } from '../../components/ui/PasswordField'
import { AuthShell } from '../../components/layout/AuthShell'
import { AUTH_INPUT_CLASS } from '../../lib/auth-class-names'
import { supabase } from '../../lib/supabase'
import { hasRecoveryClaim } from '../../lib/recovery'
import { mapSupabaseError } from '../../lib/supabase-errors'
import { translateValidationMessage } from '../../lib/yup-locale'

type FieldErrors = Partial<Record<'password' | 'confirmPassword', string>>

export default function NewPasswordScreen() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [hasRecovery, setHasRecovery] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasRecovery(hasRecoveryClaim(data.session?.access_token))
      setChecking(false)
    })
  }, [])

  async function handleSubmit() {
    setFieldErrors({})
    setFormError(null)
    const values = { password, confirmPassword }
    try {
      await resetSchema.validate(values, { abortEarly: false })
    } catch (err) {
      if (err instanceof ValidationError) {
        const errs: FieldErrors = {}
        for (const issue of err.inner) {
          if (issue.path && !errs[issue.path as keyof FieldErrors]) {
            errs[issue.path as keyof FieldErrors] = translateValidationMessage(
              issue.message,
            )
          }
        }
        setFieldErrors(errs)
      }
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setLoading(false)
      setFormError(mapSupabaseError(updateError))
      return
    }

    await supabase.auth.signOut()
    router.replace({
      pathname: '/(auth)/login',
      params: { message: 'password_updated' },
    })
  }

  if (checking) {
    return (
      <View className="flex-1 items-center justify-center bg-page">
        <ActivityIndicator />
      </View>
    )
  }

  if (!hasRecovery) {
    return (
      <AuthShell
        title="Sesión inválida"
        subtitle="Esta sesión de recuperación es inválida o ya expiró. Pedí un código nuevo."
      >
        <View className="mt-6">
          <Button
            title="Pedir un código nuevo"
            onPress={() => router.replace('/(auth)/forgot-password')}
          />
        </View>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Nueva contraseña"
      subtitle="Elegí una contraseña nueva para tu cuenta."
    >
      <PasswordField
        label="Nueva contraseña"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        autoComplete="new-password"
        error={fieldErrors.password}
        className={AUTH_INPUT_CLASS}
      />

      <PasswordField
        label="Confirmar contraseña"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="••••••••"
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
        className={AUTH_INPUT_CLASS}
      />

      <FormError message={formError} />

      <View className="mt-4">
        <Button title="Guardar contraseña" onPress={handleSubmit} loading={loading} />
      </View>
    </AuthShell>
  )
}
