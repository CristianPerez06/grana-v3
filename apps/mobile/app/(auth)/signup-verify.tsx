import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { OtpVerifyForm } from '../../components/OtpVerifyForm'
import { Button } from '../../components/ui/Button'
import { CurvedNavyContainer } from '../../components/layout/CurvedNavyContainer'
import { supabase } from '../../lib/supabase'

export default function SignupVerifyScreen() {
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email?: string }>()

  if (!email) {
    return (
      <CurvedNavyContainer
        title="Falta tu email"
        subtitle="Volvé a empezar para que podamos enviarte un código nuevo."
        showBack
        backHref="/(auth)/signup"
      >
        <View className="mt-6">
          <Button title="Volver a crear cuenta" onPress={() => router.replace('/(auth)/signup')} />
        </View>
      </CurvedNavyContainer>
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
    <CurvedNavyContainer
      title="Confirmá tu cuenta"
      subtitle={`Ingresá el código de 8 dígitos que te enviamos a ${email}.`}
      showBack
      backHref="/(auth)/signup"
    >
      <OtpVerifyForm email={email} type="signup" onVerified={handleVerified} />
    </CurvedNavyContainer>
  )
}
