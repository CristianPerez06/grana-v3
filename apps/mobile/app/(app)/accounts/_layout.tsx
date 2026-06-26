import { Stack } from 'expo-router'

// Accounts is a pushed stack (from Menú / the dashboard accounts card), not a
// tab — the native tabs are fixed. Each screen renders its own PageHeader over
// SafeAreaView, so the native stack header stays hidden. Mirror of
// settings/categories/_layout.tsx.
export default function AccountsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
