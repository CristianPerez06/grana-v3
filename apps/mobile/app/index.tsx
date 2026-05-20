import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Redirect } from 'expo-router'
import { supabase } from '../lib/supabase'
import { hasRecoveryClaim } from '../lib/recovery'

type Target =
  | '/(app)/dashboard'
  | '/(auth)/login'
  | '/(auth)/new-password'
  | '/(onboarding)/welcome'

export default function Index() {
  const [target, setTarget] = useState<Target | null>(null)

  useEffect(() => {
    const resolve = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return setTarget('/(auth)/login')
        if (hasRecoveryClaim(session.access_token)) {
          return setTarget('/(auth)/new-password')
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed_at')
          .eq('id', session.user.id)
          .maybeSingle()
        if (!profile?.onboarding_completed_at) {
          return setTarget('/(onboarding)/welcome')
        }
        setTarget('/(app)/dashboard')
      } catch {
        setTarget('/(auth)/login')
      }
    }
    resolve()
  }, [])

  if (target === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    )
  }

  return <Redirect href={target} />
}
