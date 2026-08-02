import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { parseMoneyInput } from '@grana/validation'
import { FormScreen } from '../../../../components/layout/FormScreen'
import { Spinner } from '../../../../components/ui/Spinner'
import { Button } from '../../../../components/ui/Button'
import { Label } from '../../../../components/ui/Label'
import { MoneyAmountInput } from '../../../../components/ui/MoneyAmountInput'
import { useAccountDetail } from '../../../../lib/accounts/queries'
import {
  addCurrencyToAccount,
  deactivateCurrencyFromAccount,
} from '../../../../lib/accounts/mutations'
import { useT } from '../../../../lib/locale-context'

const SUPPORTED = ['ARS', 'USD'] as const
type CurrencyCode = (typeof SUPPORTED)[number]

export default function AccountCurrencyScreen() {
  const t = useT()
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()
  const accountQ = useAccountDetail(id)
  const account = accountQ.data

  const [addCurrency, setAddCurrency] = useState<CurrencyCode | null>(null)
  const [addAmount, setAddAmount] = useState('0')
  const [addError, setAddError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const activeCodes = account
    ? account.currencies.filter((c) => c.is_active).map((c) => c.currency_code)
    : []
  const addable = SUPPORTED.filter((c) => !activeCodes.includes(c))
  const currentAdd = addCurrency && addable.includes(addCurrency) ? addCurrency : addable[0] ?? null

  const currencyLabel = (code: CurrencyCode) =>
    code === 'ARS' ? t('accounts.currency_options.ars') : t('accounts.currency_options.usd')

  const handleAdd = async () => {
    if (!currentAdd) return
    setAddError(null)
    setPending(true)
    const result = await addCurrencyToAccount(queryClient, id, {
      currency_code: currentAdd,
      initial_balance: parseMoneyInput(addAmount, { allowNegative: true }) ?? 0,
    })
    setPending(false)
    if (result.ok) {
      setAddAmount('0')
      setAddCurrency(null)
      return
    }
    setAddError(result.fieldErrors?.initial_balance ?? t(result.errorKey))
  }

  const handleDeactivate = (code: CurrencyCode) => {
    Alert.alert(
      t('accounts.confirmations.deactivateCurrency_title', { currency: code }),
      t('accounts.confirmations.deactivateCurrency_body', { currency: code }),
      [
        { text: t('common.back'), style: 'cancel' },
        {
          text: t('accounts.actions.deactivateCurrency'),
          style: 'destructive',
          onPress: async () => {
            setPending(true)
            const result = await deactivateCurrencyFromAccount(queryClient, id, code)
            setPending(false)
            if (!result.ok) Alert.alert(t(result.errorKey))
          },
        },
      ],
    )
  }

  return (
    <FormScreen
      title={t('accounts.labels.currencies')}
      backLink={{ href: `/(app)/accounts/${id}`, label: account?.name ?? t('accounts.title') }}
      contentClassName="gap-6 px-6 py-6"
    >
        {accountQ.isPending ? (
          <View className="items-center py-12">
            <Spinner size="md" />
          </View>
        ) : accountQ.isError || !account ? (
          <Text className="text-center text-sm text-text-muted">
            {t('accounts.errors.account_not_found')}
          </Text>
        ) : (
          <>
            {/* Add currency */}
            {currentAdd && (
              <View className="gap-3 rounded-[18px] border border-border bg-card p-5">
                <Text className="text-[15px] font-bold text-text">
                  {t('accounts.actions.addCurrency')}
                </Text>
                {addable.length > 1 && (
                  <View className="flex-row gap-2">
                    {addable.map((code) => {
                      const isActive = currentAdd === code
                      return (
                        <Pressable
                          key={code}
                          onPress={() => setAddCurrency(code)}
                          className={`flex-1 rounded-xl border px-3 py-2 ${
                            isActive ? 'border-emerald bg-emerald-soft' : 'border-border-soft bg-card'
                          }`}
                        >
                          <Text
                            className={`text-center text-sm ${
                              isActive ? 'font-semibold text-text' : 'text-text-soft'
                            }`}
                          >
                            {currencyLabel(code)}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                )}
                <View className="gap-1.5">
                  <Label>
                    {currencyLabel(currentAdd)} · {t('accounts.labels.initialBalance')}
                  </Label>
                  <MoneyAmountInput value={addAmount} onChangeText={setAddAmount} placeholder="0" />
                  {addError && <Text className="text-xs text-error">{addError}</Text>}
                </View>
                <Button onPress={handleAdd} loading={pending}>
                  {t('accounts.actions.addCurrency')}
                </Button>
              </View>
            )}

            {/* Deactivate currency */}
            <View className="gap-3 rounded-[18px] border border-border bg-card p-5">
              <Text className="text-[15px] font-bold text-text">
                {t('accounts.actions.deactivateCurrency')}
              </Text>
              {activeCodes.map((code) => (
                <View key={code} className="flex-row items-center justify-between">
                  <Text className="text-sm text-text">{currencyLabel(code)}</Text>
                  <Pressable
                    onPress={() => handleDeactivate(code)}
                    disabled={pending}
                    accessibilityRole="button"
                    className={`rounded-lg bg-terracotta-soft px-3 py-2 ${pending ? 'opacity-50' : ''}`}
                  >
                    <Text className="text-sm font-semibold text-negative">
                      {t('accounts.actions.deactivateCurrency')}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}
    </FormScreen>
  )
}
