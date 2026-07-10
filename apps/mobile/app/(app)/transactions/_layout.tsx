import { Stack } from 'expo-router'

// The Movimientos tab is a nested stack: the feed (`index`) is the tab root and
// `new` (the alta screen) pushes over it. Each screen renders its own
// PageHeader over SafeAreaView, so the native stack header stays hidden. Mirror
// of accounts/_layout.tsx and cards/_layout.tsx.
export default function TransactionsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
