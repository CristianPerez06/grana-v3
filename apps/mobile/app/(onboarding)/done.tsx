import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import { useT } from '../../lib/locale-context'

type Totals = { ARS: number; USD: number }

const formatARS = (n: number) =>
  `$${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}`

const formatUSD = (n: number) =>
  `US$${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)}`

export default function DoneScreen() {
  const t = useT()
  const router = useRouter()
  const [totals, setTotals] = useState<Totals | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed_at')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile?.onboarding_completed_at) {
        await supabase
          .from('profiles')
          .update({ onboarding_completed_at: new Date().toISOString() })
          .eq('id', user.id)
      }

      const { data: rows } = await supabase
        .from('account_currencies')
        .select(
          'currency_code, initial_balance, accounts!inner(user_id, type, is_active)',
        )
        .eq('accounts.user_id', user.id)
        .eq('accounts.is_active', true)
        .in('accounts.type', ['cash', 'bank'])

      if (cancelled) return

      const agg: Totals = { ARS: 0, USD: 0 }
      type Row = {
        currency_code: 'ARS' | 'USD'
        initial_balance: string | number | null
      }
      for (const row of (rows ?? []) as Row[]) {
        const amount = Number(row.initial_balance ?? 0)
        if (row.currency_code === 'ARS' || row.currency_code === 'USD') {
          agg[row.currency_code] += amount
        }
      }
      setTotals(agg)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  if (!totals) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-page" edges={['top']}>
        <ActivityIndicator />
      </SafeAreaView>
    )
  }

  const hasData = totals.ARS > 0 || totals.USD > 0

  return (
    <SafeAreaView className="flex-1 bg-page" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow justify-center px-6 py-10"
      >
        <View className="mx-auto w-full max-w-md gap-8">
        <Text className="text-center text-3xl font-bold tracking-tight text-text">
          {t('onboarding.done.title')}
        </Text>

        <View className="gap-3 rounded-xl border border-border bg-card p-6">
          <Text className="text-xs uppercase tracking-wide text-text-muted">
            {t('onboarding.done.balance_label')}
          </Text>
          <Text className="text-3xl font-semibold text-text">
            {formatARS(totals.ARS)}
          </Text>
          {totals.USD > 0 ? (
            <Text className="text-sm text-text-muted">{formatUSD(totals.USD)}</Text>
          ) : null}
        </View>

        <Text className="text-center text-sm text-text-muted">
          {hasData
            ? t('onboarding.done.next_step_with_data')
            : t('onboarding.done.next_step_skip')}
        </Text>

        <Button
          title={t('onboarding.done.cta')}
          onPress={() => router.replace('/(app)/dashboard')}
        />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
