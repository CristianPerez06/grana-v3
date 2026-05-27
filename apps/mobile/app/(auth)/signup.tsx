import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { signupSchema, ValidationError } from '@grana/validation'
import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { TextInput } from '../../components/ui/TextInput'
import { AuthShell } from '../../components/layout/AuthShell'
import { AUTH_INPUT_CLASS } from '../../lib/auth-class-names'
import { supabase } from '../../lib/supabase'
import { mapSupabaseError } from '../../lib/supabase-errors'
import { translateValidationMessage } from '../../lib/yup-locale'

type FieldErrors = Partial<Record<'fullName' | 'email' | 'password' | 'confirmPassword', string>>

export default function SignupScreen() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignup() {
    setFieldErrors({})
    setFormError(null)
    const values = { fullName, email, password, confirmPassword }
    try {
      await signupSchema.validate(values, { abortEarly: false })
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
      } else {
        setFormError('Revisá los datos del formulario.')
      }
      return
    }

    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    setLoading(false)

    if (error) {
      setFormError(mapSupabaseError(error))
      return
    }

    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setFormError(mapSupabaseError({ code: 'user_already_exists' }))
      return
    }

    router.replace({
      pathname: '/(auth)/signup-verify',
      params: { email },
    })
  }

  return (
    <AuthShell
      title="Creá tu cuenta"
      subtitle="Completá los datos para empezar."
    >
      <TextInput
        label="Nombre completo"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Juana Pérez"
        autoCapitalize="words"
        autoComplete="name"
        error={fieldErrors.fullName}
        className={AUTH_INPUT_CLASS}
      />

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        error={fieldErrors.email}
        className={AUTH_INPUT_CLASS}
      />

      <TextInput
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        autoComplete="new-password"
        error={fieldErrors.password}
        className={AUTH_INPUT_CLASS}
      />

      <TextInput
        label="Confirmar contraseña"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="••••••••"
        secureTextEntry
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
        className={AUTH_INPUT_CLASS}
      />

      <FormError message={formError} />

      <View className="mt-4">
        <Button title="Crear cuenta" onPress={handleSignup} loading={loading} />
      </View>

      <Pressable className="mt-6 items-center">
        <Link href="/(auth)/login" className="text-sm font-medium text-primary">
          ¿Ya tenés cuenta? Iniciá sesión
        </Link>
      </Pressable>
    </AuthShell>
  )
}
