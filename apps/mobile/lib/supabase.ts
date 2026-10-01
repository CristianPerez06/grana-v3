import 'react-native-url-polyfill/auto'

import * as SecureStore from 'expo-secure-store'
import { createClient } from '@grana/supabase'
import { AppState } from 'react-native'

import { registerSessionRefresh } from './session-refresh'
import { registerSessionWatch } from './session-watch'

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
)

registerSessionRefresh(AppState, supabase.auth)
registerSessionWatch(AppState, supabase.auth)
