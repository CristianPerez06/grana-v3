import { useEffect, useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react-native'
import { parseMoneyInput } from '@grana/validation'
import type { Institution } from '@grana/accounts'
import { resolveEditCycle } from '@grana/cards'
import type { CreditCardDetail, CardNetwork } from '../../lib/cards/queries'
import {
  archiveCard,
  deleteCard,
  updateCreditCard,
  updatePeriodDates,
} from '../../lib/cards/mutations'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { Button } from '../ui/Button'
import { FormError } from '../ui/FormError'
import { Label } from '../ui/Label'
import { Input } from '../ui/Input'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { DateField } from '../ui/DateField'
import { BankSelector } from '../accounts/BankSelector'

type Props = {
  cardId: string
  card: CreditCardDetail
  institutions: Institution[]
  networks: CardNetwork[]
  todayISO: string
  /** Reports the dirty state up so the screen can guard the back gesture. */
  onDirtyChange?: (dirty: boolean) => void
}

type PickerKey = 'currentEnd' | 'currentDue' | 'nextEnd' | 'nextDue' | null

// Native twin of web's edit-card-form.tsx (page variant). Same fields/validation,
// idiomatic RN. Name/bank/limit persist via `updateCreditCard`; the cycle dates
// via `updatePeriodDates` (current-then-next, only the dates that changed). The
// network is immutable (read-only chip). Archive is debt-guarded; delete is only
// offered when the card never had movements.
export function EditCardForm({
  cardId,
  card,
  institutions,
  networks,
  todayISO,
  onDirtyChange,
}: Props) {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()

  const cycle = resolveEditCycle(card.periods, todayISO)
  const cardHasHistory = card.periods.some((p) => p.has_payment || p.tx_count > 0)

  const network = card.network_id
    ? networks.find((n) => n.id === card.network_id) ?? null
    : null
  const networkLabel = network?.name ?? card.other_network_name ?? t('cards.labels.network_custom')
  const networkColor = network?.brand_color ?? colors.navy

  const initialName = card.name
  const initialInstitutionId = card.institution_id ?? ''
  const initialLimit = card.credit_limit

  const [name, setName] = useState(initialName)
  const [institutionId, setInstitutionId] = useState<string | null>(card.institution_id ?? null)
  const [creditLimit, setCreditLimit] = useState(initialLimit != null ? String(initialLimit) : '')
  const [currentEnd, setCurrentEnd] = useState(cycle.currentEndDate ?? '')
  const [currentDue, setCurrentDue] = useState(cycle.currentDueDate ?? '')
  const [nextEnd, setNextEnd] = useState(cycle.nextEndDate ?? '')
  const [nextDue, setNextDue] = useState(cycle.nextDueDate ?? '')
  const [openPicker, setOpenPicker] = useState<PickerKey>(null)

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [busy, setBusy] = useState(false)

  const parsedLimit = creditLimit ? parseMoneyInput(creditLimit) : null

  const cycleDirty =
    currentEnd !== (cycle.currentEndDate ?? '') ||
    currentDue !== (cycle.currentDueDate ?? '') ||
    nextEnd !== (cycle.nextEndDate ?? '') ||
    nextDue !== (cycle.nextDueDate ?? '')
  const dirty =
    name.trim() !== initialName.trim() ||
    (institutionId ?? '') !== initialInstitutionId ||
    (creditLimit ? parseMoneyInput(creditLimit) : null) !== initialLimit ||
    cycleDirty

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const pickerProps = (key: Exclude<PickerKey, null>) => ({
    open: openPicker === key,
    onOpenChange: (o: boolean) => setOpenPicker(o ? key : null),
  })

  const validate = () => {
    const errs: Record<string, string> = {}
    const trimmed = name.trim()
    if (trimmed.length < 1) errs.name = t('common.required_short')
    else if (trimmed.length > 50) errs.name = t('cards.errors.name_too_long')
    if (parsedLimit !== null && parsedLimit <= 0) errs.creditLimit = t('cards.errors.limit_invalid')
    if (cycle.currentPeriodId) {
      if (!currentEnd) errs.currentEnd = t('common.required_short')
      if (!currentDue) errs.currentDue = t('common.required_short')
      if (currentEnd && currentDue && currentDue <= currentEnd)
        errs.currentDue = t('cards.errors.due_after_close')
    }
    if (cycle.nextPeriodId) {
      if (!nextEnd) errs.nextEnd = t('common.required_short')
      if (!nextDue) errs.nextDue = t('common.required_short')
      if (currentEnd && nextEnd && nextEnd <= currentEnd)
        errs.nextEnd = t('cards.errors.next_close_after_current')
      if (nextEnd && nextDue && nextDue <= nextEnd)
        errs.nextDue = t('cards.errors.next_due_after_close')
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    setFormError(null)
    if (!validate()) return
    setSubmitting(true)
    try {
      const result = await updateCreditCard(queryClient, cardId, {
        name: name.trim() || undefined,
        institution_id: institutionId || undefined,
        credit_limit: parsedLimit ?? null,
      })
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        else setFormError(t(result.errorKey))
        return
      }

      // Cycle dates persist per period. Current period FIRST: it can cascade the
      // boundary (shifting the next period's start), so the next period's own
      // end/due must be written after that settles. Only the changed dates.
      if (
        cycle.currentPeriodId &&
        (currentEnd !== (cycle.currentEndDate ?? '') || currentDue !== (cycle.currentDueDate ?? ''))
      ) {
        const r = await updatePeriodDates(queryClient, cycle.currentPeriodId, {
          end_date: currentEnd,
          due_date: currentDue,
        })
        if (!r.ok) {
          setFormError(t(r.errorKey))
          return
        }
      }
      if (
        cycle.nextPeriodId &&
        (nextEnd !== (cycle.nextEndDate ?? '') || nextDue !== (cycle.nextDueDate ?? ''))
      ) {
        const r = await updatePeriodDates(queryClient, cycle.nextPeriodId, {
          end_date: nextEnd,
          due_date: nextDue,
        })
        if (!r.ok) {
          setFormError(t(r.errorKey))
          return
        }
      }

      router.back()
    } finally {
      setSubmitting(false)
    }
  }

  const handleArchive = () => {
    Alert.alert(t('cards.actions.archive'), t('cards.edit.archive_sub'), [
      { text: t('common.back'), style: 'cancel' },
      {
        text: t('cards.actions.archive'),
        onPress: async () => {
          setBusy(true)
          const result = await archiveCard(queryClient, cardId)
          setBusy(false)
          if (result.ok) {
            router.back()
            return
          }
          if (result.reason === 'pending_debt') {
            Alert.alert(
              t('cards.deactivate_block.title'),
              t('cards.deactivate_block.description'),
              [{ text: t('cards.actions.got_it') }],
            )
          } else {
            Alert.alert(t(result.errorKey))
          }
        },
      },
    ])
  }

  const handleDelete = () => {
    Alert.alert(t('cards.actions.delete'), t('cards.confirmations.delete_body'), [
      { text: t('common.back'), style: 'cancel' },
      {
        text: t('cards.actions.delete'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          const result = await deleteCard(queryClient, cardId)
          setBusy(false)
          if (result.ok) router.replace('/(app)/cards')
          else Alert.alert(t(result.errorKey))
        },
      },
    ])
  }

  return (
    <View className="flex-col gap-5">
      {/* Nombre */}
      <View className="flex-col gap-1.5">
        <Label>{t('cards.edit.name_field_label')}</Label>
        <Input
          value={name}
          onChangeText={setName}
          maxLength={50}
          invalid={Boolean(fieldErrors.name)}
        />
        {fieldErrors.name && <Text className="text-xs text-error">{fieldErrors.name}</Text>}
      </View>

      {/* Banco */}
      <View className="flex-col gap-1.5">
        <Label>{t('cards.edit.bank_field_label')}</Label>
        <BankSelector
          institutions={institutions}
          selectedId={institutionId}
          onSelect={(inst) => setInstitutionId(inst.id)}
        />
      </View>

      {/* Red — chip read-only con candado (inmutable) */}
      <View className="flex-col gap-1.5">
        <Label>{t('cards.edit.section_network')}</Label>
        <View
          className="flex-row items-center gap-1.5 self-start rounded-full px-4 py-2"
          style={{ backgroundColor: networkColor }}
        >
          <Lock size={13} color={colors.white} />
          <Text className="text-[13px] font-bold text-white">{networkLabel}</Text>
        </View>
        <Text className="text-xs text-text-muted">{t('cards.edit.network_locked_hint')}</Text>
      </View>

      {/* Ciclo — actual + próximo, cada par visible solo si el período existe */}
      {cycle.currentPeriodId ? (
        <View className="flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {t('cards.labels.current_period')}
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1 flex-col gap-1.5">
              <Text className="text-xs font-medium text-text-muted">
                {t('cards.labels.close_date')}
              </Text>
              <DateField
                value={currentEnd}
                onChange={setCurrentEnd}
                invalid={Boolean(fieldErrors.currentEnd)}
                {...pickerProps('currentEnd')}
              />
              {fieldErrors.currentEnd && (
                <Text className="text-xs text-error">{fieldErrors.currentEnd}</Text>
              )}
            </View>
            <View className="flex-1 flex-col gap-1.5">
              <Text className="text-xs font-medium text-text-muted">
                {t('cards.labels.due_date')}
              </Text>
              <DateField
                value={currentDue}
                onChange={setCurrentDue}
                invalid={Boolean(fieldErrors.currentDue)}
                {...pickerProps('currentDue')}
              />
              {fieldErrors.currentDue && (
                <Text className="text-xs text-error">{fieldErrors.currentDue}</Text>
              )}
            </View>
          </View>

          {cycle.nextPeriodId && (
            <View className="flex-col gap-3 border-t border-border-soft pt-3.5">
              <View className="flex-row items-center gap-2">
                <Text className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
                  {t('cards.labels.next_period')}
                </Text>
                {cycle.nextPeriodIsEstimated && (
                  <View className="rounded-full bg-border-soft px-2 py-0.5">
                    <Text className="text-[10px] font-semibold text-text-muted">
                      {t('cards.payment.estimated_badge')}
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 flex-col gap-1.5">
                  <Text className="text-xs font-medium text-text-muted">
                    {t('cards.labels.close_date')}
                  </Text>
                  <DateField
                    value={nextEnd}
                    onChange={setNextEnd}
                    invalid={Boolean(fieldErrors.nextEnd)}
                    {...pickerProps('nextEnd')}
                  />
                  {fieldErrors.nextEnd && (
                    <Text className="text-xs text-error">{fieldErrors.nextEnd}</Text>
                  )}
                </View>
                <View className="flex-1 flex-col gap-1.5">
                  <Text className="text-xs font-medium text-text-muted">
                    {t('cards.labels.due_date')}
                  </Text>
                  <DateField
                    value={nextDue}
                    onChange={setNextDue}
                    invalid={Boolean(fieldErrors.nextDue)}
                    {...pickerProps('nextDue')}
                  />
                  {fieldErrors.nextDue && (
                    <Text className="text-xs text-error">{fieldErrors.nextDue}</Text>
                  )}
                </View>
              </View>
            </View>
          )}

          <Text className="text-xs text-text-muted">
            {cycle.nextPeriodIsPaid
              ? t('cards.edit.cycle_next_paid_hint')
              : cycle.nextPeriodIsEstimated
                ? t('cards.edit.cycle_estimated_hint')
                : t('cards.edit.cycle_hint')}
          </Text>
        </View>
      ) : (
        <View className="rounded-2xl border border-border bg-card px-4 py-3.5">
          <Text className="text-sm text-text-muted">{t('cards.edit.cycle_unknown')}</Text>
        </View>
      )}

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
          <Text className="text-xs text-text-muted">{t('cards.edit.limit_hint')}</Text>
        )}
      </View>

      <FormError message={formError} />

      <Button onPress={handleSubmit} loading={submitting} disabled={!dirty || busy}>
        {t('cards.actions.save')}
      </Button>

      {/* Acciones de ciclo de vida */}
      <View className="flex-col gap-3 border-t border-border-soft pt-5">
        <Button onPress={handleArchive} variant="secondary" disabled={busy || submitting}>
          {t('cards.actions.archive')}
        </Button>
        {!cardHasHistory && (
          <Button onPress={handleDelete} variant="destructive" disabled={busy || submitting}>
            {t('cards.actions.delete')}
          </Button>
        )}
        <Text className="text-xs text-text-muted">
          {cardHasHistory ? t('cards.edit.delete_sub_blocked') : t('cards.edit.delete_sub_ok')}
        </Text>
      </View>
    </View>
  )
}
