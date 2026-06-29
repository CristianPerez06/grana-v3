import { Stack } from 'expo-router'

// Cards is a pushed stack (from Menú / the dashboard committed card), not a tab —
// the native tabs are fixed. Each screen renders its own PageHeader over
// SafeAreaView, so the native stack header stays hidden. Mirror of
// accounts/_layout.tsx.
export default function CardsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
