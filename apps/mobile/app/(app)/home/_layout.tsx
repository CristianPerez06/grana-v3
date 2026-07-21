import { Stack } from 'expo-router'

// The Hogar (Compartido) tab is a nested stack: the home (`index`) is the tab
// root and `settle` / `settings` / `cuenta-corriente` push over it. Each screen
// renders its own PageHeader over SafeAreaView, so the native stack header stays
// hidden. Mirror of transactions/_layout.tsx and cards/_layout.tsx.
export default function HomeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
