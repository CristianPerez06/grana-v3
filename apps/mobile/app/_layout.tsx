import '../global.css'
import '../lib/yup-locale'

import { useEffect, useState } from 'react'
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
import { supabase } from '../lib/supabase'
import { hasRecoveryClaim } from '../lib/recovery'
import { createQueryClient } from '../lib/query-client'
import { registerFocusManager } from '../lib/focus-manager-setup'

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

  return (
    <QueryClientProvider client={queryClient}>
      <Slot />
    </QueryClientProvider>
  )
}
