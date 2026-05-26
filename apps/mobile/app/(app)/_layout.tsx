import { useEffect, useState } from 'react'
import { Modal, Pressable, View } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { hasRecoveryClaim } from '../../lib/recovery'
import { PreferencesProvider } from '../../lib/preferences-context'
import { AppMenu } from '../../components/layout/AppMenu'
import { TabBar } from '../../components/layout/TabBar'

export default function AppLayout() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

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

  return (
    <PreferencesProvider>
      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setMenuOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/30">
          <Pressable className="flex-1" onPress={() => setMenuOpen(false)} />
          <AppMenu onClose={() => setMenuOpen(false)} />
        </View>
      </Modal>

      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <TabBar
            {...props}
            onMenuPress={() => setMenuOpen(true)}
            menuActive={menuOpen}
          />
        )}
      >
        <Tabs.Screen name="dashboard" />
        <Tabs.Screen name="transactions" />
        <Tabs.Screen name="home" />
        <Tabs.Screen name="menu" />
        <Tabs.Screen name="cards" options={{ href: null }} />
        <Tabs.Screen name="accounts" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
      </Tabs>
    </PreferencesProvider>
  )
}
