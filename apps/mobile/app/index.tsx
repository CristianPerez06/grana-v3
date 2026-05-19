import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Redirect } from 'expo-router'
import { supabase } from '../lib/supabase'
import { hasRecoveryClaim } from '../lib/recovery'

type Target = '/(app)/dashboard' | '/(auth)/login' | '/(auth)/new-password'

export default function Index() {
  const [target, setTarget] = useState<Target | null>(null)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!session) return setTarget('/(auth)/login')
        if (hasRecoveryClaim(session.access_token)) {
          return setTarget('/(auth)/new-password')
        }
        setTarget('/(app)/dashboard')
      })
      .catch(() => setTarget('/(auth)/login'))
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
