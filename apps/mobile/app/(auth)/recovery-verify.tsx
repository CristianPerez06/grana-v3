import { useLocalSearchParams, useRouter } from 'expo-router'
import { OtpVerifyForm } from '../../components/auth/OtpVerifyForm'
import { MissingEmailFallback } from '../../components/auth/MissingEmailFallback'
import { AuthShell } from '../../components/layout/AuthShell'

export default function RecoveryVerifyScreen() {
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email?: string }>()

  if (!email) {
    return (
      <MissingEmailFallback
        buttonTitle="Volver a recuperar contraseña"
        onPress={() => router.replace('/(auth)/forgot-password')}
      />
    )
  }

  function handleVerified() {
    router.replace('/(auth)/new-password')
  }

  return (
    <AuthShell
      title="Verificá que sos vos"
      subtitle={`Ingresá el código de 8 dígitos que te enviamos a ${email}.`}
    >
      <OtpVerifyForm email={email} type="recovery" onVerified={handleVerified} />
    </AuthShell>
  )
}
