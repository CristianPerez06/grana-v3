import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { hasRecoveryClaim } from '../../lib/recovery'

export default function AppLayout() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (!session) {
        router.replace('/(auth)/login')
        return
      }
      if (hasRecoveryClaim(session.access_token)) {
        router.replace('/(auth)/new-password')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed_at')
        .eq('id', session.user.id)
        .maybeSingle()
      if (cancelled) return
      if (!profile?.onboarding_completed_at) {
        router.replace('/(onboarding)/welcome')
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [router])

  return <Stack screenOptions={{ headerShown: false }} />
}
