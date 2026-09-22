import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { getAccounts } from '@grana/accounts'
import { checkNegativeBalance, getTodayAR, formatDateISO } from '@grana/money-logic'
import { parseMoneyInput } from '@grana/validation'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { MovementFormAccount } from '@grana/movement-form'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { Label } from '../ui/Label'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { DateField } from '../ui/DateField'
import { FormError } from '../ui/FormError'
import { FormSheetBody } from '../layout/FormSheetBody'
import { AccountSelectField } from '../transactions/form-pickers'
import { toMovementFormAccounts } from '../../lib/accounts/form-accounts'
import { registerRecurrenceAhead } from '../../lib/recurrences/mutators'
import { supabase } from '../../lib/supabase'
import { useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'

type Props = {
  visible: boolean
  onClose: () => void
  recurrenceId: string
  /** El vencimiento. NO se toca: la fecha de pago es otro hecho. */
  dueDate: string
  ruleAmount: number
  ruleCurrency: 'ARS' | 'USD'
  movementType: string
  ruleAccountId: string | null
  transferDestinationAccountId: string | null
  /** El acuse lo da quien montó la hoja, donde la fila se queda. */
  onDone: () => void
}

/**
 * «YA LO PAGUÉ», CON LO QUE EL PAGO REALMENTE FUE.
 *
 * Hasta ahora en el teléfono esto registraba de una, con los valores de la
 * regla: el spec fijaba esa divergencia y el QA la encontró primero. No es una
 * divergencia que imponga la plataforma —el sistema operativo no obliga a nada
 * acá—, y el costo caía sobre el caso más común: pagar antes suele venir con
 * OTRO importe (el alquiler aumentó, la boleta vino más cara). El usuario
 * registraba un número que sabía equivocado y después iba a Movimientos a
 * corregirlo. Y se perdía la advertencia de saldo negativo, que en web aparece
 * antes de confirmar.
 *
 * Mismos campos, mismos textos y mismas validaciones que el formulario web. Lo
 * único distinto es la caja: allá es un bloque en la fila, acá una hoja, porque
 * en un teléfono el formulario no entra al lado del vencimiento.
 */
export function PayAheadSheet({
  visible,
  onClose,
  recurrenceId,
  dueDate,
  ruleAmount,
  ruleCurrency,
  movementType,
  ruleAccountId,
  transferDestinationAccountId,
  onDone,
}: Props) {
  const t = useT()
  const showCents = useShowCents()
  const [amount, setAmount] = useState(String(ruleAmount))
  // La FECHA DE PAGO, hoy por defecto. El vencimiento sigue donde estaba.
  const [date, setDate] = useState(() => formatDateISO(getTodayAR()))
  const [accountId, setAccountId] = useState(ruleAccountId ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const accountsQ = useQuery({
    queryKey: ['movement-form', 'accounts'] as const,
    queryFn: () => getAccounts(supabase, { today: getTodayAR() }),
  })
  const accounts = useMemo(() => toMovementFormAccounts(accountsQ.data), [accountsQ.data])

  // El mismo criterio que revalida el servidor: la moneda la fija la regla
  // (bimoneda, nunca se mezcla); un ingreso o el origen de una transferencia no
  // pueden ser una tarjeta; y una transferencia no sale de su propio destino.
  const eligibleAccounts: MovementFormAccount[] = useMemo(
    () =>
      accounts.filter((account) => {
        if (!account.activeCurrencies.includes(ruleCurrency)) return false
        if (movementType !== 'expense' && account.type === 'credit') return false
        if (movementType === 'transfer' && account.id === transferDestinationAccountId) return false
        return true
      }),
    [accounts, ruleCurrency, movementType, transferDestinationAccountId],
  )

  const selectedAccount = eligibleAccounts.find((a) => a.id === accountId) ?? null

  // NO SE CONFIRMA SIN EL SALDO. La advertencia se calcula sobre las cuentas, y
  // mientras la lectura está en vuelo no existen: confirmar en ese hueco
  // registra el pago sin el aviso que el spec exige.
  const accountsReady = accountsQ.isSuccess

  // Aviso blando, no bloqueante: el pago dejaría la cuenta en negativo. Los
  // consumos de tarjeta —fuera del ledger— y los ingresos nunca avisan.
  const warning = (() => {
    if (!accountsReady || !accountId) return null
    if (movementType !== 'expense' && movementType !== 'transfer') return null
    if (movementType === 'expense' && selectedAccount?.type === 'credit') return null
    const parsed = parseMoneyInput(amount)
    const value = parsed !== null && parsed > 0 ? parsed : ruleAmount
    const check = checkNegativeBalance(selectedAccount?.balances[ruleCurrency] ?? 0, value)
    return check.negative ? check.projected : null
  })()

  const fmt = (value: number) =>
    ruleCurrency === 'ARS' ? formatARS(value, showCents) : formatUSD(value, showCents)

  const submit = async () => {
    setFormError(null)
    const parsed = parseMoneyInput(amount)
    if (parsed === null || parsed <= 0) {
      setFormError(t('recurrences.errors.amount_invalid'))
      return
    }
    if (!accountId) {
      setFormError(t('recurrences.pending.account_required'))
      return
    }
    setPending(true)
    const result = await registerRecurrenceAhead(
      { recurrenceId, dueDate, date, amount: parsed, accountId },
      t,
    )
    setPending(false)
    if (!result.ok) {
      setFormError(result.formError)
      return
    }
    onDone()
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} ariaLabel={t('recurrences.link.already_paid')}>
      <FormSheetBody contentClassName="gap-4 px-5 pb-5">
        <Text className="text-[17px] font-bold text-text">
          {t('recurrences.link.already_paid')}
        </Text>

        <View className="gap-1.5">
          <Label>{t('recurrences.labels.amount')}</Label>
          <MoneyAmountInput value={amount} onChangeText={setAmount} />
          <Text className="text-xs text-text-muted">
            {t('recurrences.pending.amount_changes_rule')}
          </Text>
        </View>

        <View className="gap-1.5">
          <AccountSelectField
            label={t('recurrences.labels.account')}
            accounts={eligibleAccounts}
            selectedId={accountId}
            onSelect={setAccountId}
          />
          <Text className="text-xs text-text-muted">
            {t('recurrences.pending.account_instance_only')}
          </Text>
          {warning != null && (
            <Text className="text-xs text-warning-deep">
              {t('transactions.form.negative_warning', { amount: fmt(warning) })}
            </Text>
          )}
        </View>

        <View className="gap-1.5">
          <Label>{t('recurrences.labels_extra.date')}</Label>
          <DateField value={date} onChange={setDate} />
        </View>

        {accountsQ.isError && <FormError message={t('recurrences.link.accounts_unavailable')} />}
        {formError && <FormError message={formError} />}

        <View className="gap-2">
          <Button onPress={submit} disabled={pending || !accountsReady}>
            {pending ? t('recurrences.pending.confirming') : t('recurrences.pending.confirm')}
          </Button>
          <Button variant="ghost" onPress={onClose} disabled={pending}>
            {t('recurrences.link.convert_cancel')}
          </Button>
        </View>
      </FormSheetBody>
    </BottomSheet>
  )
}
