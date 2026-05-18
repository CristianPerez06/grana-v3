import '../global.css'

import { useEffect } from 'react'
import { Slot, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

export default function RootLayout() {
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        router.replace('/(app)/dashboard')
      } else if (event === 'SIGNED_OUT') {
        router.replace('/(auth)/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return <Slot />
}
