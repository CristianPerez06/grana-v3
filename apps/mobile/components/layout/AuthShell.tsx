import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GranaLogo } from '../ui/GranaLogo'
import {
  KEYBOARD_BOTTOM_OFFSET,
  KeyboardAwareScrollView,
} from './keyboard-aware-scroll-view'

type Props = {
  title: string
  subtitle?: string
  children: ReactNode
}

/**
 * Shell del grupo `(auth)` en mobile: tarjeta centrada minimalista, cardless.
 * A ancho de teléfono el contenido va directo sobre `bg-page` (sin borde ni
 * sombra), con el logo Grana arriba. El scroller keyboard-aware mantiene el
 * campo enfocado por encima del teclado (ver capability `mobile-app-shell`).
 *
 * Antes usaba `KeyboardAvoidingView` con `behavior` por plataforma; se unificó
 * con el resto de la app para que Android quede cubierto igual que iOS y para
 * no dejar dos mecanismos de teclado conviviendo.
 */
export function AuthShell({ title, subtitle, children }: Props) {
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1 bg-page">
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_BOTTOM_OFFSET}
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
          <View className="mt-8 flex-col gap-4">{children}</View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  )
}
