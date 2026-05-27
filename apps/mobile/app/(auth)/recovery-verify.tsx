import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { OtpVerifyForm } from '../../components/OtpVerifyForm'
import { Button } from '../../components/ui/Button'
import { AuthShell } from '../../components/layout/AuthShell'

export default function RecoveryVerifyScreen() {
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email?: string }>()

  if (!email) {
    return (
      <AuthShell
        title="Falta tu email"
        subtitle="Volvé a empezar para que podamos enviarte un código nuevo."
      >
        <View className="mt-6">
          <Button
            title="Volver a recuperar contraseña"
            onPress={() => router.replace('/(auth)/forgot-password')}
          />
        </View>
      </AuthShell>
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
