import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function OnboardingLayout() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session) router.replace('/(auth)/login')
    }
    check()
    return () => {
      cancelled = true
    }
  }, [router])

  return <Stack screenOptions={{ headerShown: false }} />
}
