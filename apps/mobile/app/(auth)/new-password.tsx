import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { resetSchema, ValidationError } from '@grana/validation'
import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { TextInput } from '../../components/ui/TextInput'
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
    // onAuthStateChange in root layout will redirect to /(auth)/login.
    router.replace({
      pathname: '/(auth)/login',
      params: { message: 'password_updated' },
    })
  }

  if (checking) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    )
  }

  if (!hasRecovery) {
    return (
      <View className="flex-1 justify-center bg-background px-6">
        <Text className="text-xl font-semibold text-foreground">Sesión inválida</Text>
        <Text className="mt-2 text-muted-foreground">
          Esta sesión de recuperación es inválida o ya expiró. Pedí un código nuevo.
        </Text>
        <View className="mt-6">
          <Button
            title="Pedir un código nuevo"
            onPress={() => router.replace('/(auth)/forgot-password')}
          />
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-8">
          <Text className="text-3xl font-bold text-foreground">Nueva contraseña</Text>
          <Text className="mt-1 text-muted-foreground">
            Elegí una contraseña nueva para tu cuenta.
          </Text>
        </View>

        <TextInput
          label="Nueva contraseña"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="new-password"
          error={fieldErrors.password}
        />

        <TextInput
          label="Confirmar contraseña"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
        />

        <FormError message={formError} />

        <View className="mt-4">
          <Button title="Guardar contraseña" onPress={handleSubmit} loading={loading} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
