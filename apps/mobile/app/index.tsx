import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Redirect } from 'expo-router'
import { supabase } from '../lib/supabase'

export default function Index() {
  const [session, setSession] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => setSession(!!session))
      .catch(() => setSession(false))
  }, [])

  if (session === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    )
  }

  return <Redirect href={session ? '/(app)/dashboard' : '/(auth)/login'} />
}
