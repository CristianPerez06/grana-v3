import { useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { AccountWithBalances, Institution } from '@grana/accounts'
import { Lock } from 'lucide-react-native'
import { updateAccount } from '../../lib/accounts/mutations'
import { useShowCents } from '../../lib/preferences-context'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { Button } from '../ui/Button'
import { FormError } from '../ui/FormError'
import { Label } from '../ui/Label'
import { Input } from '../ui/Input'
import { BankSelector } from './BankSelector'

type Props = {
  account: AccountWithBalances
  institutions: Institution[]
}

// Edit name + institution (bank only). Initial balances are locked — they're
// adjusted via movements, not edited (mirror of web's LockedMoneyGroup).
export function EditAccountForm({ account, institutions }: Props) {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const showCents = useShowCents()
  const isBank = account.type === 'bank'

  const [name, setName] = useState(account.name)
  const [institutionId, setInstitutionId] = useState<string | null>(account.institution_id)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const arsCurrency = account.currencies.find((c) => c.currency_code === 'ARS' && c.is_active)
  const usdCurrency = account.currencies.find((c) => c.currency_code === 'USD' && c.is_active)

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = t('accounts.errors.name_required')
    else if (name.trim().length > 50) errs.name = t('accounts.errors.name_too_long')
    if (isBank && !institutionId) errs.institution = t('accounts.errors.institution_required_short')
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    setFormError(null)
    if (!validate()) return
    setSubmitting(true)
    const result = await updateAccount(queryClient, account.id, {
      name: name.trim(),
      ...(isBank ? { institution_id: institutionId } : {}),
    })
    setSubmitting(false)
    if (result.ok) {
      router.back()
      return
    }
    if (result.fieldErrors) setFieldErrors(result.fieldErrors)
    else setFormError(t(result.errorKey))
  }

  return (
    <View className="flex-col gap-5">
      {isBank && (
        <View className="flex-col gap-1.5">
          <Label>{t('accounts.labels.institution')}</Label>
          <BankSelector
            institutions={institutions}
            selectedId={institutionId}
            onSelect={(inst) => setInstitutionId(inst.id)}
            invalid={Boolean(fieldErrors.institution)}
          />
          {fieldErrors.institution && (
            <Text className="text-xs text-error">{fieldErrors.institution}</Text>
          )}
        </View>
      )}

      <View className="flex-col gap-1.5">
        <Label>{t('accounts.labels.name')}</Label>
        <Input
          value={name}
          onChangeText={setName}
          maxLength={50}
          invalid={Boolean(fieldErrors.name)}
        />
        {fieldErrors.name && <Text className="text-xs text-error">{fieldErrors.name}</Text>}
      </View>

      {/* Locked initial balances */}
      <View className="flex-col gap-1.5">
        <View className="flex-row items-center gap-1.5">
          <Label>{t('accounts.labels.initialBalance')}</Label>
          <Lock size={12} color={colors.textMuted} />
        </View>
        <View className="flex-col gap-2 rounded-lg border border-border-soft bg-border-soft px-3 py-3">
          {arsCurrency && (
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-medium text-text-muted">{t('accounts.labels.ars')}</Text>
              <Text className="text-sm font-semibold tabular-nums text-text-muted">
                {formatARS(arsCurrency.initial_balance, showCents)}
              </Text>
            </View>
          )}
          {usdCurrency && (
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-medium text-text-muted">{t('accounts.labels.usd')}</Text>
              <Text className="text-sm font-semibold tabular-nums text-text-muted">
                {formatUSD(usdCurrency.initial_balance, showCents)}
              </Text>
            </View>
          )}
        </View>
        <Text className="text-xs text-text-muted">{t('accounts.readonly.initialBalance')}</Text>
      </View>

      <FormError message={formError} />

      <Button onPress={handleSubmit} loading={submitting}>
        {t('common.save_changes')}
      </Button>
    </View>
  )
}
