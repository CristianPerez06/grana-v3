import { Text, View } from 'react-native'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'

export default function DashboardScreen() {
  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="mb-8 text-2xl font-semibold text-foreground">Dashboard</Text>
      <Button title="Cerrar sesión" onPress={handleSignOut} variant="ghost" />
    </View>
  )
}
