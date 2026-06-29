import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { parseMoneyInput } from '@grana/validation'
import type { Institution } from '@grana/accounts'
import type { CardNetwork } from '../../lib/cards/queries'
import { createCreditCard } from '../../lib/cards/mutations'
import { useT } from '../../lib/locale-context'
import { Button } from '../ui/Button'
import { FormError } from '../ui/FormError'
import { Label } from '../ui/Label'
import { Input } from '../ui/Input'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { DateField } from '../ui/DateField'
import { BankSelector } from '../accounts/BankSelector'

type Props = {
  institutions: Institution[]
  networks: CardNetwork[]
}

type NetworkSelection =
  | { type: 'catalog'; networkId: string }
  | { type: 'other'; name: string }
  | null

// Native twin of web's create-card-form.tsx. Same public name/fields, idiomatic
// RN presentation. Currencies are bimoneda-fixed (ARS + USD) like web — no
// selector. The create logic lives in the shared @grana/cards mutation; this form
// only collects input, validates client-side, and resolves errors with useT.
export function CreateCardForm({ institutions, networks }: Props) {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [institutionId, setInstitutionId] = useState<string | null>(null)
  const [network, setNetwork] = useState<NetworkSelection>(null)
  const [name, setName] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [currentEnd, setCurrentEnd] = useState('')
  const [currentDue, setCurrentDue] = useState('')

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const parsedLimit = creditLimit ? parseMoneyInput(creditLimit) : null
  const networkValid =
    network?.type === 'catalog' || (network?.type === 'other' && network.name.trim().length > 0)
  const canSubmit = Boolean(institutionId) && networkValid && Boolean(currentEnd) && Boolean(currentDue)

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!institutionId) errs.institution = t('cards.errors.bank_required')
    if (!network) errs.network = t('cards.errors.network_required')
    else if (network.type === 'other' && !network.name.trim())
      errs.network = t('cards.errors.network_other_required')
    if (creditLimit && (parsedLimit === null || parsedLimit <= 0))
      errs.creditLimit = t('cards.errors.limit_invalid')
    if (!currentEnd) errs.currentEnd = t('common.required_short')
    if (!currentDue) errs.currentDue = t('common.required_short')
    if (currentEnd && currentDue && currentDue <= currentEnd)
      errs.currentDue = t('cards.errors.due_after_close')
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    setFormError(null)
    if (!validate()) return
    setSubmitting(true)
    const result = await createCreditCard(queryClient, {
      institution_id: institutionId,
      network_id: network?.type === 'catalog' ? network.networkId : undefined,
      other_network_name: network?.type === 'other' ? network.name.trim() : undefined,
      name: name.trim() || undefined,
      currencies: [{ currency_code: 'ARS' }, { currency_code: 'USD' }],
      credit_limit: parsedLimit ?? undefined,
      current_end_date: currentEnd,
      current_due_date: currentDue,
    })
    setSubmitting(false)
    if (result.ok) {
      router.back()
      return
    }
    if (result.fieldErrors) setFieldErrors(result.fieldErrors)
    else setFormError(t(result.errorKey))
  }

  const pillClass = (active: boolean) =>
    `rounded-full border px-4 py-2 ${active ? 'border-navy bg-navy' : 'border-border bg-card'}`
  const pillTextClass = (active: boolean) =>
    `text-[13px] font-semibold ${active ? 'text-white' : 'text-text-muted'}`

  return (
    <View className="flex-col gap-5">
      {/* Banco / institución */}
      <View className="flex-col gap-1.5">
        <Label>{t('cards.labels.bank')}</Label>
        <BankSelector
          institutions={institutions}
          selectedId={institutionId}
          onSelect={(inst) => setInstitutionId(inst.id)}
          invalid={Boolean(fieldErrors.institution)}
        />
        {fieldErrors.institution && (
          <Text className="text-xs text-error">{fieldErrors.institution}</Text>
        )}
        <Text className="text-xs text-text-muted">{t('cards.new.bank_hint')}</Text>
      </View>

      {/* Red / marca — pills (catálogo + "Otra red") */}
      <View className="flex-col gap-1.5">
        <Label>{t('cards.labels.network')}</Label>
        <View className="flex-row flex-wrap gap-2">
          {networks.map((n) => {
            const active = network?.type === 'catalog' && network.networkId === n.id
            return (
              <Pressable
                key={n.id}
                onPress={() => setNetwork({ type: 'catalog', networkId: n.id })}
                className={pillClass(active)}
              >
                <Text className={pillTextClass(active)}>{n.name}</Text>
              </Pressable>
            )
          })}
          <Pressable
            onPress={() => setNetwork({ type: 'other', name: '' })}
            className={pillClass(network?.type === 'other')}
          >
            <Text className={pillTextClass(network?.type === 'other')}>
              {t('cards.actions.network_other')}
            </Text>
          </Pressable>
        </View>
        {network?.type === 'other' && (
          <Input
            value={network.name}
            onChangeText={(value) => setNetwork({ type: 'other', name: value })}
            maxLength={50}
            placeholder={t('cards.placeholders.network_other')}
            invalid={Boolean(fieldErrors.network)}
          />
        )}
        {fieldErrors.network && <Text className="text-xs text-error">{fieldErrors.network}</Text>}
      </View>

      {/* Nombre — opcional */}
      <View className="flex-col gap-1.5">
        <Label>{t('cards.labels.name')}</Label>
        <Input
          value={name}
          onChangeText={setName}
          maxLength={50}
          placeholder={t('cards.placeholders.name_auto')}
        />
      </View>

      {/* Ciclo — solo el resumen actual; el próximo nace estimado */}
      <View className="flex-col gap-2.5">
        <Label>{t('cards.labels.current_period')}</Label>
        <View className="flex-row gap-3">
          <View className="flex-1 flex-col gap-1.5">
            <Text className="text-xs font-medium text-text-muted">{t('cards.labels.close_date')}</Text>
            <DateField value={currentEnd} onChange={setCurrentEnd} invalid={Boolean(fieldErrors.currentEnd)} />
            {fieldErrors.currentEnd && (
              <Text className="text-xs text-error">{fieldErrors.currentEnd}</Text>
            )}
          </View>
          <View className="flex-1 flex-col gap-1.5">
            <Text className="text-xs font-medium text-text-muted">{t('cards.labels.due_date')}</Text>
            <DateField value={currentDue} onChange={setCurrentDue} invalid={Boolean(fieldErrors.currentDue)} />
            {fieldErrors.currentDue && (
              <Text className="text-xs text-error">{fieldErrors.currentDue}</Text>
            )}
          </View>
        </View>
        <Text className="text-xs text-text-muted">{t('cards.new.cycle_hint')}</Text>
      </View>

      {/* Límite — opcional */}
      <View className="flex-col gap-1.5">
        <Label>{t('cards.labels.credit_limit')}</Label>
        <MoneyAmountInput
          value={creditLimit}
          onChangeText={setCreditLimit}
          placeholder={t('cards.labels.limit_placeholder')}
        />
        {fieldErrors.creditLimit ? (
          <Text className="text-xs text-error">{fieldErrors.creditLimit}</Text>
        ) : (
          <Text className="text-xs text-text-muted">{t('cards.new.limit_hint')}</Text>
        )}
      </View>

      <FormError message={formError} />

      <Button onPress={handleSubmit} loading={submitting} disabled={!canSubmit}>
        {t('cards.new.submit')}
      </Button>
    </View>
  )
}
