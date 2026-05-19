import '../global.css'
import '../lib/yup-locale'

import { useEffect } from 'react'
import { Slot, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { hasRecoveryClaim } from '../lib/recovery'

export default function RootLayout() {
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        // A recovery session (amr=otp) must stay inside the auth flow so the
        // user can set a new password. The new-password screen routes to
        // login after the password is updated. Signup-verify also briefly
        // creates a session before calling signOut; we let that screen
        // handle its own navigation.
        if (hasRecoveryClaim(session?.access_token)) return
        router.replace('/(app)/dashboard')
      } else if (event === 'SIGNED_OUT') {
        router.replace('/(auth)/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return <Slot />
}
