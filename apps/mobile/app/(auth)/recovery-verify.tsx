import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { OtpVerifyForm } from '../../components/OtpVerifyForm'
import { Button } from '../../components/ui/Button'

export default function RecoveryVerifyScreen() {
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email?: string }>()

  if (!email) {
    return (
      <View className="flex-1 justify-center bg-background px-6">
        <Text className="text-xl font-semibold text-foreground">Falta tu email</Text>
        <Text className="mt-2 text-muted-foreground">
          Volvé a empezar para que podamos enviarte un código nuevo.
        </Text>
        <View className="mt-6">
          <Button
            title="Volver a recuperar contraseña"
            onPress={() => router.replace('/(auth)/forgot-password')}
          />
        </View>
      </View>
    )
  }

  function handleVerified() {
    router.replace('/(auth)/new-password')
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
          <Text className="text-3xl font-bold text-foreground">Verificá tu identidad</Text>
          <Text className="mt-1 text-muted-foreground">
            Ingresá el código de 8 dígitos que te enviamos a {email}.
          </Text>
        </View>

        <OtpVerifyForm email={email} type="recovery" onVerified={handleVerified} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
