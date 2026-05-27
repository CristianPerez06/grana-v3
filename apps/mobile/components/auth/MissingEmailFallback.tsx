import { View } from 'react-native'
import { Button } from '../ui/Button'
import { AuthShell } from '../layout/AuthShell'

type Props = {
  /** Texto del botón que devuelve al inicio del flujo (p. ej. "Volver a crear cuenta"). */
  buttonTitle: string
  onPress: () => void
}

/**
 * Fallback compartido por las pantallas de verificación OTP (`signup-verify`,
 * `recovery-verify`) cuando llegan sin el parámetro `email` en la URL: invita a
 * reiniciar el flujo para recibir un código nuevo.
 */
export function MissingEmailFallback({ buttonTitle, onPress }: Props) {
  return (
    <AuthShell
      title="Falta tu email"
      subtitle="Volvé a empezar para que podamos enviarte un código nuevo."
    >
      <View className="mt-6">
        <Button title={buttonTitle} onPress={onPress} />
      </View>
    </AuthShell>
  )
}
