import '../global.css'
import '../lib/yup-locale'

import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Slot, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans'
import { QueryClientProvider } from '@tanstack/react-query'
import { KeyboardProvider, KeyboardToolbar } from 'react-native-keyboard-controller'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { hasRecoveryClaim } from '../lib/recovery'
import { createQueryClient } from '../lib/query-client'
import { registerFocusManager } from '../lib/focus-manager-setup'
import { LocaleProvider } from '../lib/locale-context'

SplashScreen.preventAutoHideAsync().catch(() => {})
registerFocusManager()

export default function RootLayout() {
  const router = useRouter()
  const [queryClient] = useState(() => createQueryClient())
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [fontsLoaded])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        if (hasRecoveryClaim(session?.access_token)) return
        if (!session) {
          router.replace('/(app)/dashboard')
          return
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed_at')
          .eq('id', session.user.id)
          .maybeSingle()
        if (!profile?.onboarding_completed_at) {
          router.replace('/(onboarding)/welcome')
        } else {
          router.replace('/(app)/dashboard')
        }
      } else if (event === 'SIGNED_OUT') {
        router.replace('/(auth)/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (!fontsLoaded) return null

  // Provider order: SafeAreaProvider must wrap everything so any descendant
  // (TabBar, AppMenu, screen-level SafeAreaView) gets non-zero insets.
  // KeyboardProvider goes right inside it: every form surface reads keyboard
  // state from here (FormScreen, FormSheetBody, TabBar), and it must sit under
  // SafeAreaProvider because the keyboard-aware scrollers combine keyboard
  // height with the safe-area insets. Surfaces rendered inside an RN Modal live
  // in their own window and mount their own nested provider — that's what
  // FormSheetBody encapsulates; this one does not reach them.
  // LocaleProvider is next so translations reach auth screens.
  // QueryClientProvider has no dependency on the others and sits innermost.
  // El `View className="flex-1 bg-page"` pinta el fondo de la ventana: sin él
  // se ve el window background nativo (negro) por cualquier hueco que las
  // pantallas no cubran — notablemente los `rounded-t-xl` del TabBar, que vive
  // fuera del contenedor de pantallas del navigator.
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <View className="flex-1 bg-page">
          <LocaleProvider>
            <QueryClientProvider client={queryClient}>
              <Slot />
            </QueryClientProvider>
          </LocaleProvider>
        </View>
        {/* Accessory bar over the keyboard, mounted once for the whole app.
            MoneyAmountInput forces `decimal-pad`, which on iOS has NO return
            key — without this the only way to dismiss it is tapping empty
            background, which a dense form may not even have. */}
        <KeyboardToolbar />
      </KeyboardProvider>
    </SafeAreaProvider>
  )
}
