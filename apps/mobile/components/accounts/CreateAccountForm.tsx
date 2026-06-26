import { useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { parseMoneyInput } from '@grana/validation'
import { resolveAccountAvatar } from '@grana/ui-contracts'
import type { Institution } from '@grana/accounts'
import { createAccount } from '../../lib/accounts/mutations'
import { useT } from '../../lib/locale-context'
import { Button } from '../ui/Button'
import { FormError } from '../ui/FormError'
import { Label } from '../ui/Label'
import { Input } from '../ui/Input'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { AccountAvatar } from '../ui/AccountAvatar'
import { BankSelector } from './BankSelector'

type Props = {
  institutions: Institution[]
}

// Create a bank/debit account (cash is provisioned at onboarding, so the type is
// fixed — no selector, mirror of web). Name optional (falls back to institution).
// Bimoneda: ARS + USD initial balances, both editable, negative allowed.
export function CreateAccountForm({ institutions }: Props) {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [ars, setArs] = useState('0')
  const [usd, setUsd] = useState('0')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const selected = institutions.find((i) => i.id === institutionId) ?? null
  const displayName = name.trim() || selected?.name || t('accounts.preview.name_placeholder')
  const avatar = resolveAccountAvatar(
    {
      id: institutionId ?? 'preview',
      name: name.trim() || selected?.name || '',
      type: 'bank',
      color_key: null,
      icon_key: null,
    },
    selected ? { brand_color: selected.brand_color, icon_type: selected.icon_type } : null,
  )

  const validate = () => {
    const errs: Record<string, string> = {}
    if (name.trim().length > 50) errs.name = t('accounts.errors.name_too_long')
    if (!institutionId) errs.institution = t('accounts.errors.institution_required_short')
    if (parseMoneyInput(ars, { allowNegative: true }) === null) {
      errs.balance_ARS = t('accounts.errors.balance_invalid')
    }
    if (parseMoneyInput(usd, { allowNegative: true }) === null) {
      errs.balance_USD = t('accounts.errors.balance_invalid')
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    setFormError(null)
    if (!validate()) return
    setSubmitting(true)
    const result = await createAccount(queryClient, {
      name: name.trim() || selected?.name || '',
      type: 'bank',
      institution_id: institutionId,
      currencies: [
        { currency_code: 'ARS', initial_balance: parseMoneyInput(ars, { allowNegative: true }) ?? 0 },
        { currency_code: 'USD', initial_balance: parseMoneyInput(usd, { allowNegative: true }) ?? 0 },
      ],
      color_key: null,
      icon_key: null,
    })
    setSubmitting(false)
    if (result.ok) {
      if (result.id) {
        router.replace({ pathname: '/(app)/accounts/[id]', params: { id: result.id } })
      } else {
        router.back()
      }
      return
    }
    if (result.fieldErrors) setFieldErrors(result.fieldErrors)
    else setFormError(t(result.errorKey))
  }

  return (
    <View className="flex-col gap-5">
      {/* Live preview */}
      <View className="flex-row items-center gap-3 rounded-[18px] border border-border bg-card p-4">
        <AccountAvatar {...avatar} size="md" />
        <View className="flex-1">
          <Text
            className={`text-[15px] font-semibold ${name.trim() || selected ? 'text-text' : 'text-text-soft'}`}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <Text className="text-[13px] text-text-soft">
            {selected
              ? t('accounts.preview.meta_bank', { bank: selected.name })
              : t('accounts.preview.meta_bank', { bank: t('accounts.preview.meta_bank_empty') })}
          </Text>
        </View>
      </View>

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

      <View className="flex-col gap-1.5">
        <Label>{t('accounts.labels.name')}</Label>
        <Input
          value={name}
          onChangeText={setName}
          maxLength={50}
          placeholder={t('accounts.placeholders.name_bank')}
          invalid={Boolean(fieldErrors.name)}
        />
        {fieldErrors.name && <Text className="text-xs text-error">{fieldErrors.name}</Text>}
      </View>

      <View className="flex-col gap-2.5">
        <Label>{t('accounts.labels.initialBalance')}</Label>
        <View className="flex-col gap-1.5">
          <Text className="text-xs font-medium text-text-muted">{t('accounts.labels.ars')}</Text>
          <MoneyAmountInput value={ars} onChangeText={setArs} placeholder="0" />
          {fieldErrors.balance_ARS && (
            <Text className="text-xs text-error">{fieldErrors.balance_ARS}</Text>
          )}
        </View>
        <View className="flex-col gap-1.5">
          <Text className="text-xs font-medium text-text-muted">{t('accounts.labels.usd')}</Text>
          <MoneyAmountInput value={usd} onChangeText={setUsd} placeholder="0" />
          {fieldErrors.balance_USD && (
            <Text className="text-xs text-error">{fieldErrors.balance_USD}</Text>
          )}
        </View>
        <Text className="text-xs text-text-muted">{t('accounts.hints.initialBalance')}</Text>
      </View>

      <FormError message={formError} />

      <Button onPress={handleSubmit} loading={submitting} disabled={!institutionId}>
        {t('accounts.actions.create')}
      </Button>
    </View>
  )
}
