import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GranaLogo } from '../ui/GranaLogo'

type Props = {
  title: string
  subtitle?: string
  children: ReactNode
}

/**
 * Shell del grupo `(auth)` en mobile: tarjeta centrada minimalista, cardless.
 * A ancho de teléfono el contenido va directo sobre `bg-page` (sin borde ni
 * sombra), con el logo Grana arriba. Mantiene KeyboardAvoidingView + ScrollView
 * para que el teclado no tape el formulario.
 */
export function AuthShell({ title, subtitle, children }: Props) {
  const insets = useSafeAreaInsets()

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-page"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="flex-grow justify-center px-6"
        contentContainerStyle={{
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 32,
        }}
      >
        <View className="mx-auto w-full max-w-[420px]">
          <View className="items-center">
            <GranaLogo width={104} />
            <Text className="mt-6 text-center text-2xl font-bold text-text">
              {title}
            </Text>
            {subtitle ? (
              <Text className="mt-2 text-center text-sm leading-snug text-text-muted">
                {subtitle}
              </Text>
            ) : null}
          </View>
          <View className="mt-8">{children}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
