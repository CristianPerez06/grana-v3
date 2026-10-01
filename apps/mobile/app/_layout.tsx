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
        // Whatever ended the session — the menu button, another device, a
        // refresh the service refused — the next person to sign in must not
        // read this one's data from the cache: query keys carry no user id.
        // After the redirect, so the (app) screens are gone and don't refetch.
        queryClient.clear()
      }
    })

    return () => subscription.unsubscribe()
  }, [router, queryClient])

  if (!fontsLoaded) return null

  // Provider order: SafeAreaProvider must wrap everything so any descendant
  // (TabBar, AppMenu, screen-level SafeAreaView) gets non-zero insets.
  // KeyboardProvider goes right inside it: every form surface reads keyboard
  // state from here (FormScreen, FormSheetBody, TabBar), and it must sit under
  // SafeAreaProvider because the keyboard-aware scrollers combine keyboard
  // height with the safe-area insets. It is the ONLY keyboard provider in the
  // app: it also tracks the keyboard inside RN Modals (sheets, drawers), and a
  // nested one there left this one paused after the modal closed, with the
  // toolbar below stuck on screen (issue #166).
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
