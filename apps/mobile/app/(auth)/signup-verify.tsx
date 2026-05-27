import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { OtpVerifyForm } from '../../components/OtpVerifyForm'
import { Button } from '../../components/ui/Button'
import { AuthShell } from '../../components/layout/AuthShell'
import { supabase } from '../../lib/supabase'

export default function SignupVerifyScreen() {
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email?: string }>()

  if (!email) {
    return (
      <AuthShell
        title="Falta tu email"
        subtitle="Volvé a empezar para que podamos enviarte un código nuevo."
      >
        <View className="mt-6">
          <Button title="Volver a crear cuenta" onPress={() => router.replace('/(auth)/signup')} />
        </View>
      </AuthShell>
    )
  }

  async function handleVerified() {
    await supabase.auth.signOut()
    router.replace({
      pathname: '/(auth)/login',
      params: { message: 'account_confirmed' },
    })
  }

  return (
    <AuthShell
      title="Confirmá tu cuenta"
      subtitle={`Ingresá el código de 8 dígitos que te enviamos a ${email}.`}
    >
      <OtpVerifyForm email={email} type="signup" onVerified={handleVerified} />
    </AuthShell>
  )
}
