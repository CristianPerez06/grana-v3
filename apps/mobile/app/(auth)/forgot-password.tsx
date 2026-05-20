import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { forgotSchema, ValidationError } from '@grana/validation'
import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { TextInput } from '../../components/ui/TextInput'
import { CurvedNavyContainer } from '../../components/layout/CurvedNavyContainer'
import { AUTH_INPUT_CLASS } from '../../lib/auth-class-names'
import { supabase } from '../../lib/supabase'
import { mapSupabaseError } from '../../lib/supabase-errors'
import { translateValidationMessage } from '../../lib/yup-locale'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setEmailError(undefined)
    setFormError(null)
    try {
      await forgotSchema.validate({ email })
    } catch (err) {
      if (err instanceof ValidationError) {
        setEmailError(translateValidationMessage(err.message))
      }
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    setLoading(false)

    if (error) {
      setFormError(mapSupabaseError(error))
      return
    }

    router.replace({
      pathname: '/(auth)/recovery-verify',
      params: { email },
    })
  }

  return (
    <CurvedNavyContainer
      title="Recuperar contraseña"
      subtitle="Te enviaremos un código a tu email."
      showBack
      backHref="/(auth)/login"
    >
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        error={emailError}
        className={AUTH_INPUT_CLASS}
      />

      <FormError message={formError} />

      <View className="mt-4">
        <Button title="Enviar código" onPress={handleSubmit} loading={loading} />
      </View>

      <Pressable className="mt-6 items-center">
        <Link href="/(auth)/login" className="text-sm font-medium text-primary">
          Volver a iniciar sesión
        </Link>
      </Pressable>
    </CurvedNavyContainer>
  )
}
