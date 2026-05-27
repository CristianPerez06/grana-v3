import { useLocalSearchParams, useRouter } from 'expo-router'
import { OtpVerifyForm } from '../../components/auth/OtpVerifyForm'
import { MissingEmailFallback } from '../../components/auth/MissingEmailFallback'
import { AuthShell } from '../../components/layout/AuthShell'
import { supabase } from '../../lib/supabase'

export default function SignupVerifyScreen() {
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email?: string }>()

  if (!email) {
    return (
      <MissingEmailFallback
        buttonTitle="Volver a crear cuenta"
        onPress={() => router.replace('/(auth)/signup')}
      />
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
