import '../global.css'
import '../lib/yup-locale'

import { useEffect } from 'react'
import { Slot, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans'
import { supabase } from '../lib/supabase'
import { hasRecoveryClaim } from '../lib/recovery'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const router = useRouter()
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        if (hasRecoveryClaim(session?.access_token)) return
        router.replace('/(app)/dashboard')
      } else if (event === 'SIGNED_OUT') {
        router.replace('/(auth)/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (!fontsLoaded) return null

  return <Slot />
}
