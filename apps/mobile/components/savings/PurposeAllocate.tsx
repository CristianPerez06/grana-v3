import { useState } from 'react'
import { Text, View } from 'react-native'
import type { Purpose } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import { formatForDisplay, parseMoneyInput } from '@grana/validation'
import { useT } from '../../lib/locale-context'
import { Button } from '../ui/Button'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { MoneyCalculator } from '../ui/MoneyCalculator'
import { allocateToPurpose, unallocateFromPurpose } from '../../lib/savings/mutations'
import { SheetBackHeader } from './SheetBackHeader'

type Currency = 'ARS' | 'USD'

const CURRENCY_SYMBOL: Record<Currency, string> = { ARS: '$', USD: 'U$D' }

/**
 * Repartir lo guardado. Espejo nativo del `PurposeAllocate` de web.
 *
 * Pide un MONTO, y ahí está la corrección: antes esta pantalla pedía tocar un
 * movimiento del historial, y eso ataba el propósito a una fila puntual. La
 * plata guardada es fungible, igual que no está en una cuenta puntual.
 *
 * No mueve plata y, a diferencia de guardar, tampoco cambia el disponible ni el
 * total guardado.
 */
export const PurposeAllocate = ({
  purpose,
  currency,
  direction,
  available,
  onDone,
  onBack,
}: {
  purpose: Purpose
  currency: Currency
  direction: 'allocate' | 'unallocate'
  /** El piso: el resto al apartar, lo apartado al soltar. */
  available: number
  onDone: () => void | Promise<void>
  onBack: () => void
}) => {
  const t = useT()
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const money = (value: number) => (currency === 'USD' ? formatUSD(value) : formatARS(value, true))

  const value = parseMoneyInput(amount) ?? 0
  const remainder = available - value
  const overLimit = value > available
  const allocating = direction === 'allocate'
  const amountInputWidth = Math.max(1, formatForDisplay(amount).length) * 18 + 2

  const limitError = overLimit
    ? allocating
      ? t('savings.purposes.errors.exceeds_unassigned', { limit: money(available) })
      : t('savings.purposes.errors.exceeds_allocated', {
          limit: money(available),
          purpose: purpose.name,
        })
    : null

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      const action = allocating ? allocateToPurpose : unallocateFromPurpose
      const result = await action({
        amount: value,
        currency_code: currency,
        date: new Date(`${formatDateISO(getTodayAR())}T00:00:00`),
        purpose_id: purpose.id,
      })
      if (!result.ok) {
        setError(t('savings.purposes.errors.generic'))
        return
      }
      await onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <View>
      <SheetBackHeader
        title={t(
          allocating
            ? 'savings.purposes.allocate_title'
            : 'savings.purposes.unallocate_title',
          { purpose: purpose.name },
        )}
        onBack={onBack}
      />

      <View className="mt-4 rounded-2xl border border-border bg-card p-4">
        <View className="flex-row items-start justify-between">
          <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
            {t('savings.amount_label')}
          </Text>
          <View className="rounded-lg border border-border bg-surface px-2.5 py-1">
            <Text className="text-[11px] font-bold text-text">{currency}</Text>
          </View>
        </View>
        <View className="mt-2 min-h-[56px] flex-row items-center justify-center">
          <Text className="pl-1 text-[30px] font-bold text-text">
            {CURRENCY_SYMBOL[currency]}
          </Text>
          <MoneyAmountInput
            bare
            value={amount}
            onChangeText={setAmount}
            placeholder="0"
            autoFocus
            style={{ width: amountInputWidth, paddingVertical: 0 }}
            className="ml-1 text-[30px] font-bold text-text"
          />
          <MoneyCalculator seed={amount} onResult={setAmount} />
        </View>
      </View>

      <View className="mt-3 rounded-2xl border border-border bg-card p-4">
        <View className="flex-row justify-between py-1">
          <Text className="text-[14px] text-text-muted">
            {allocating
              ? t('savings.purposes.unassigned_available')
              : t('savings.purposes.allocated_in', { purpose: purpose.name })}
          </Text>
          <Text className="text-[14px] font-semibold text-text">{money(available)}</Text>
        </View>
        <View className="flex-row justify-between py-1">
          <Text className="text-[14px] text-text-muted">
            {t(allocating ? 'savings.purposes.will_allocate' : 'savings.purposes.will_unallocate')}
          </Text>
          <Text className="text-[14px] font-semibold text-positive">
            {`${value > 0 ? '−' : ''}${money(value)}`}
          </Text>
        </View>
        <View className="mt-1.5 flex-row justify-between border-t border-border-soft pt-2.5">
          <Text className="text-[14px] text-text-muted">
            {t(allocating ? 'savings.purposes.left_unassigned' : 'savings.purposes.stays_allocated')}
          </Text>
          <Text
            className={`text-[16px] font-extrabold ${overLimit ? 'text-negative' : 'text-text'}`}
          >
            {money(remainder)}
          </Text>
        </View>
      </View>

      {/* Decirlo en voz alta: esta operación no toca ningún total. Sin la frase,
          ver dos números moverse hace suponer que algo se gastó. */}
      <Text className="mt-3 px-1 text-[12.5px] leading-snug text-text-soft">
        {t('savings.purposes.allocate_note')}
      </Text>

      {(limitError ?? error) != null && (
        <Text className="mt-3 text-[13px] font-semibold text-negative">{limitError ?? error}</Text>
      )}

      <View className="mt-4">
        <Button
          title={t(allocating ? 'savings.purposes.allocate' : 'savings.purposes.unallocate')}
          onPress={submit}
          loading={busy}
          disabled={busy || value <= 0 || overLimit}
        />
      </View>
    </View>
  )
}
