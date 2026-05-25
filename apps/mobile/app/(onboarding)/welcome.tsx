import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import { useT } from '../../lib/locale-context'

export default function WelcomeScreen() {
  const t = useT()
  const router = useRouter()
  const [firstName, setFirstName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      const fullName = (profile?.full_name as string | undefined) ?? ''
      setFirstName(fullName.split(' ')[0] ?? '')
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-page" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-6 py-10"
      >
        <View className="mx-auto w-full max-w-md gap-8">
        <View className="gap-3">
          {firstName ? (
            <Text className="text-center text-sm text-text-muted">
              {t('onboarding.welcome.greeting', { name: firstName })}
            </Text>
          ) : null}
          <Text className="text-center text-3xl font-bold tracking-tight text-text">
            {t('onboarding.welcome.title')}
          </Text>
          <Text className="text-center text-sm text-text-muted">
            {t('onboarding.welcome.description')}
          </Text>
        </View>

        <Button
          title={t('onboarding.welcome.cta')}
          onPress={() => router.push('/(onboarding)/perfil')}
        />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
