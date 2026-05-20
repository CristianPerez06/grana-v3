import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { TextInput } from '../../components/ui/TextInput'
import { supabase } from '../../lib/supabase'
import { mapSupabaseError } from '../../lib/supabase-errors'

const MESSAGE_COPY: Record<string, string> = {
  account_confirmed: 'Tu cuenta fue confirmada. Ingresá con tu email y contraseña.',
  password_updated: 'Tu contraseña fue cambiada. Iniciá sesión con la nueva.',
}

export default function LoginScreen() {
  const router = useRouter()
  const { message } = useLocalSearchParams<{ message?: string }>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resending, setResending] = useState(false)
  const [notice, setNotice] = useState<string | null>(
    message ? (MESSAGE_COPY[message] ?? null) : null,
  )

  useEffect(() => {
    // Drop the one-shot message from the URL so a refresh doesn't repeat it.
    if (message) {
      router.setParams({ message: undefined })
    }
  }, [message, router])

  async function handleLogin() {
    if (!email || !password) {
      setError('Por favor completá el email y la contraseña.')
      return
    }
    setError(null)
    setNotice(null)
    setUnconfirmed(false)
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authError) {
      if (authError.code === 'email_not_confirmed') {
        setUnconfirmed(true)
        setError('Tu cuenta todavía no está confirmada. Reenviá el código y completá la confirmación.')
        return
      }
      setError(mapSupabaseError(authError))
    }
  }

  async function handleResend() {
    if (!email) return
    setResending(true)
    await supabase.auth.resend({ email, type: 'signup' })
    setResending(false)
    router.push({
      pathname: '/(auth)/signup-verify',
      params: { email },
    })
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
          <Text className="text-3xl font-bold text-foreground">Grana</Text>
          <Text className="mt-1 text-muted-foreground">Ingresá con tu email y contraseña.</Text>
        </View>

        {notice ? (
          <View className="mb-4 rounded-lg border border-success/30 bg-success/10 p-3">
            <Text className="text-sm text-success">{notice}</Text>
          </View>
        ) : null}

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="tu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
        />

        <TextInput
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="password"
        />

        <FormError message={error} />
        {unconfirmed ? (
          <Pressable
            onPress={handleResend}
            disabled={resending}
            className="mt-2 items-start"
          >
            <Text className="text-sm font-medium text-primary">
              {resending ? 'Reenviando…' : 'Reenviar código de confirmación'}
            </Text>
          </Pressable>
        ) : null}

        <View className="mt-4">
          <Button title="Iniciar sesión" onPress={handleLogin} loading={loading} />
        </View>

        <View className="mt-6 items-center gap-2">
          <Link
            href="/(auth)/forgot-password"
            className="text-sm font-medium text-primary"
          >
            ¿Olvidaste tu contraseña?
          </Link>
          <Link
            href="/(auth)/signup"
            className="text-sm font-medium text-primary"
          >
            ¿No tenés cuenta? Registrate
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
