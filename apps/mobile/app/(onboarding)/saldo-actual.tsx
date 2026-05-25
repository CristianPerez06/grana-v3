import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { parseMoneyInput, saldoActualSchema } from '@grana/validation'
import { Button } from '../../components/ui/Button'
import { FormError } from '../../components/ui/FormError'
import { TextInput } from '../../components/ui/TextInput'
import { supabase } from '../../lib/supabase'
import { useT } from '../../lib/locale-context'

type Mode = 'novato' | 'experto'
type Account = { id: string; name: string; type: string }

type ParsedAmounts = {
  primary_ars: number | undefined
  primary_usd: number | undefined
  cash_ars: number | undefined
  cash_usd: number | undefined
}

export default function SaldoActualScreen() {
  const t = useT()
  const router = useRouter()
  const [mode, setMode] = useState<Mode | null>(null)
  const [primaryAccount, setPrimaryAccount] = useState<Account | null>(null)
  const [secondaryCashAccount, setSecondaryCashAccount] = useState<Account | null>(null)
  const [loadingScreen, setLoadingScreen] = useState(true)

  const [primaryArsStr, setPrimaryArsStr] = useState('')
  const [primaryUsdStr, setPrimaryUsdStr] = useState('')
  const [cashArsStr, setCashArsStr] = useState('')
  const [cashUsdStr, setCashUsdStr] = useState('')

  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('mode')
        .eq('id', user.id)
        .maybeSingle()

      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, name, type')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .in('type', ['cash', 'bank'])

      if (cancelled) return

      const list = (accounts ?? []) as Account[]
      const bank = list.find((a) => a.type === 'bank') ?? null
      const cash = list.find((a) => a.type === 'cash') ?? null

      if (!cash) {
        router.replace('/(onboarding)/done')
        return
      }

      const resolvedMode: Mode = profile?.mode === 'experto' ? 'experto' : 'novato'
      setMode(resolvedMode)
      setPrimaryAccount(bank ?? cash)
      setSecondaryCashAccount(bank ? cash : null)
      setLoadingScreen(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router])

  function parseAmounts():
    | { ok: true; data: ParsedAmounts }
    | { ok: false; errorKey: 'amount_invalid' | 'amount_negative' } {
    const fields: [string, keyof ParsedAmounts][] = [
      [primaryArsStr, 'primary_ars'],
      [primaryUsdStr, 'primary_usd'],
      [cashArsStr, 'cash_ars'],
      [cashUsdStr, 'cash_usd'],
    ]
    const data: Partial<ParsedAmounts> = {}
    for (const [raw, dest] of fields) {
      const trimmed = raw.trim()
      if (trimmed === '') {
        data[dest] = undefined
        continue
      }
      const n = parseMoneyInput(trimmed)
      if (n === null) return { ok: false, errorKey: 'amount_invalid' }
      if (n < 0) return { ok: false, errorKey: 'amount_negative' }
      data[dest] = n
    }
    return { ok: true, data: data as ParsedAmounts }
  }

  async function handleSubmit() {
    setFormError(null)
    if (!primaryAccount) return

    const parsed = parseAmounts()
    if (!parsed.ok) {
      setFormError(t(`onboarding.errors.${parsed.errorKey}`))
      return
    }

    if (parsed.data.primary_ars === undefined) {
      setFormError(t('onboarding.errors.primary_ars_required'))
      return
    }

    const input = {
      primary_account_id: primaryAccount.id,
      primary_ars: parsed.data.primary_ars,
      primary_usd: parsed.data.primary_usd,
      cash_account_id: secondaryCashAccount?.id ?? null,
      cash_ars: parsed.data.cash_ars,
      cash_usd: parsed.data.cash_usd,
    }

    try {
      await saldoActualSchema.validate(input)
    } catch {
      setFormError(t('onboarding.errors.amount_invalid'))
      return
    }

    setSubmitting(true)
    try {
      type Update = {
        account_id: string
        currency_code: 'ARS' | 'USD'
        amount: number
      }
      const updates: Update[] = []

      if (input.primary_ars !== undefined && input.primary_ars > 0) {
        updates.push({ account_id: input.primary_account_id, currency_code: 'ARS', amount: input.primary_ars })
      }
      if (input.primary_usd !== undefined && input.primary_usd > 0) {
        updates.push({ account_id: input.primary_account_id, currency_code: 'USD', amount: input.primary_usd })
      }
      if (input.cash_account_id && input.cash_ars !== undefined && input.cash_ars > 0) {
        updates.push({ account_id: input.cash_account_id, currency_code: 'ARS', amount: input.cash_ars })
      }
      if (input.cash_account_id && input.cash_usd !== undefined && input.cash_usd > 0) {
        updates.push({ account_id: input.cash_account_id, currency_code: 'USD', amount: input.cash_usd })
      }

      for (const u of updates) {
        const { error } = await supabase
          .from('account_currencies')
          .update({ initial_balance: u.amount })
          .eq('account_id', u.account_id)
          .eq('currency_code', u.currency_code)
        if (error) {
          setFormError(t('onboarding.errors.generic'))
          return
        }
      }

      router.replace('/(onboarding)/done')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingScreen || !primaryAccount || !mode) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-page" edges={['top']}>
        <ActivityIndicator />
      </SafeAreaView>
    )
  }

  const showSecondaryCash = mode === 'experto' && secondaryCashAccount !== null
  const primaryLabel =
    mode === 'experto' && primaryAccount.type === 'bank'
      ? t('onboarding.saldoActual.group_primary_bank', { accountName: primaryAccount.name })
      : t('onboarding.saldoActual.group_novato')

  return (
    <SafeAreaView className="flex-1 bg-page" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
        <View className="mx-auto w-full max-w-md gap-8">
          <View className="gap-2">
            <Text className="text-center text-2xl font-bold tracking-tight text-text">
              {t('onboarding.saldoActual.title')}
            </Text>
            <Text className="text-center text-sm text-text-muted">
              {showSecondaryCash
                ? t('onboarding.saldoActual.description_experto')
                : t('onboarding.saldoActual.description_novato')}
            </Text>
          </View>

          <View className="gap-3">
            <Text className="text-sm font-medium text-text">{primaryLabel}</Text>
            <TextInput
              label={t('onboarding.saldoActual.ars_label')}
              value={primaryArsStr}
              onChangeText={setPrimaryArsStr}
              placeholder={t('onboarding.saldoActual.amount_placeholder')}
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
            <TextInput
              label={t('onboarding.saldoActual.usd_label')}
              value={primaryUsdStr}
              onChangeText={setPrimaryUsdStr}
              placeholder={t('onboarding.saldoActual.amount_placeholder')}
              keyboardType="decimal-pad"
              inputMode="decimal"
            />
          </View>

          {showSecondaryCash && secondaryCashAccount ? (
            <View className="gap-3">
              <Text className="text-sm font-medium text-text">
                {t('onboarding.saldoActual.group_cash')}
              </Text>
              <TextInput
                label={t('onboarding.saldoActual.ars_label')}
                value={cashArsStr}
                onChangeText={setCashArsStr}
                placeholder={t('onboarding.saldoActual.amount_placeholder')}
                keyboardType="decimal-pad"
                inputMode="decimal"
              />
              <TextInput
                label={t('onboarding.saldoActual.usd_label')}
                value={cashUsdStr}
                onChangeText={setCashUsdStr}
                placeholder={t('onboarding.saldoActual.amount_placeholder')}
                keyboardType="decimal-pad"
                inputMode="decimal"
              />
            </View>
          ) : null}

          <FormError message={formError} />

          <Button
            title={t('onboarding.saldoActual.continue')}
            onPress={handleSubmit}
            loading={submitting}
          />
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
