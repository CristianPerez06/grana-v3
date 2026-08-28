import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronDown } from 'lucide-react-native'
import { colors } from '../../lib/colors'
import { PURPOSE_SEEDS, type Purpose } from '@grana/savings'
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
  purpose: fixedPurpose,
  purposes,
  currency: initialCurrency,
  currencies,
  direction,
  availableFor,
  onCreateSeed,
  onCreateCustom,
  justCreated = false,
  onDone,
  onBack,
}: {
  /** Fijo cuando se llegó desde un propósito. Null: se elige acá mismo. */
  purpose: Purpose | null
  purposes: Purpose[]
  currency: Currency
  /** Las monedas que el usuario tiene en juego. */
  currencies: Currency[]
  direction: 'allocate' | 'unallocate'
  /**
   * Se llegó acá creando el propósito. Cambia el título y suma una línea: es lo
   * que convierte esta pantalla en la CONFIRMACIÓN de la anterior en vez de un
   * paso que aparece de la nada.
   */
  justCreated?: boolean
  /**
   * El piso de CADA moneda. Una función y no un número porque la moneda se
   * elige acá: el detalle dejó de estar partido por moneda, así que la elección
   * bajó al formulario, donde es un dato de la operación.
   */
  availableFor: (currency: Currency) => number
  /** Crea la sugerencia y devuelve el propósito, para dejarlo seleccionado. */
  onCreateSeed: (seedKey: string) => Promise<Purpose | null>
  onCreateCustom: () => void
  onDone: () => void | Promise<void>
  onBack: () => void
}) => {
  const t = useT()
  const [currency, setCurrency] = useState<Currency>(initialCurrency)
  const [chosen, setChosen] = useState<Purpose | null>(fixedPurpose)
  const [creating, setCreating] = useState(false)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const money = (value: number) => (currency === 'USD' ? formatUSD(value) : formatARS(value, true))

  const purpose = chosen
  const available = availableFor(currency)
  const value = parseMoneyInput(amount) ?? 0

  const taken = new Set(purposes.map((x) => x.name.trim().toLowerCase()))
  const suggestions = PURPOSE_SEEDS.filter(
    (seed) => !taken.has(t(`savings.purposes.seeds.${seed.key}`).trim().toLowerCase()),
  )
  const remainder = available - value
  const overLimit = value > available
  const allocating = direction === 'allocate'
  const amountInputWidth = Math.max(1, formatForDisplay(amount).length) * 18 + 2

  const limitError = overLimit
    ? allocating
      ? t('savings.purposes.errors.exceeds_unassigned', { limit: money(available) })
      : t('savings.purposes.errors.exceeds_allocated', {
          limit: money(available),
          purpose: purpose?.name ?? '',
        })
    : null

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      if (purpose == null) return
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
        title={
          justCreated && purpose != null
            ? t('savings.purposes.created_title', { purpose: purpose.name })
            : purpose != null
              ? t(
                  allocating
                    ? 'savings.purposes.allocate_title'
                    : 'savings.purposes.unallocate_title',
                  { purpose: purpose.name },
                )
              : t('savings.purposes.allocate')
        }
        onBack={onBack}
      />

      {/* Lo que el propósito recién creado TODAVÍA no tiene, y la pregunta que
          sigue. */}
      {justCreated && (
        <Text className="mt-3 text-[13px] leading-snug text-text-muted">
          {t('savings.purposes.created_body')}
        </Text>
      )}

      {/* EL héroe de monto de la app: el mismo de «Guardar» y el del alta de
          movimientos. Acá era el mismo bloque con otras medidas —30px contra 34,
          el rótulo más chico, el chip en otro fondo y la calculadora al lado del
          número en vez de abajo del chip— y eso ponía la misma pregunta con dos
          caras distintas en dos vistas del MISMO sheet. */}
      <View className="mt-4 rounded-2xl border border-border bg-card px-4 pb-4 pt-3.5">
        <View className="relative">
          <Text className="absolute left-0 top-0 text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {t('savings.amount_label')}
          </Text>
          {/* La moneda se elige acá: cambiarla cambia el piso, porque lo que
              hay sin destino en pesos no es lo que hay sin destino en dólares. */}
          <View className="absolute right-0 top-0 items-end gap-1.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('savings.currency_label')}
              disabled={currencies.length < 2}
              onPress={() =>
                setCurrency(
                  currencies[(currencies.indexOf(currency) + 1) % currencies.length] ?? currency,
                )
              }
              className="flex-row items-center gap-1 rounded-lg border border-border bg-border-soft px-2.5 py-1"
            >
              <Text className="text-xs font-bold text-text">{currency}</Text>
              {currencies.length > 1 && <ChevronDown size={12} color={colors.text} />}
            </Pressable>
            <MoneyCalculator seed={amount} onResult={setAmount} />
          </View>
          <View className="min-h-[72px] flex-row items-center justify-center">
            <Text className="pl-1 text-[34px] font-bold text-text">
              {CURRENCY_SYMBOL[currency]}
            </Text>
            <MoneyAmountInput
              bare
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              autoFocus
              style={{ width: amountInputWidth, paddingVertical: 0 }}
              className="ml-1 text-[34px] font-bold text-text"
            />
          </View>
        </View>
      </View>

      {/* Elegir para qué EN LA MISMA PANTALLA: cuánto y para qué son dos datos
          de una sola decisión, y separarlos cobraba navegación por no decidir
          nada. Los propósitos son pocos por naturaleza, así que caben como
          chips. */}
      {fixedPurpose == null && (
        <View className="mt-3">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {t('savings.purposes.pick_inline')}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {purposes.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                onPress={() => setChosen(option)}
                accessibilityState={{ selected: chosen?.id === option.id }}
                className={`min-h-[44px] flex-row items-center gap-1.5 rounded-full border px-3 ${
                  chosen?.id === option.id
                    ? 'border-emerald-deep bg-emerald-deep/5'
                    : 'border-border-soft bg-card'
                }`}
              >
                <Text className="text-[15px]">{option.icon ?? '🫙'}</Text>
                <Text className="text-[13px] font-semibold text-text">{option.name}</Text>
              </Pressable>
            ))}
            {suggestions.map((seed) => (
              <Pressable
                key={seed.key}
                accessibilityRole="button"
                disabled={creating}
                onPress={async () => {
                  setCreating(true)
                  try {
                    const created = await onCreateSeed(seed.key)
                    if (created) setChosen(created)
                  } finally {
                    setCreating(false)
                  }
                }}
                className={`min-h-[44px] flex-row items-center gap-1.5 rounded-full border border-dashed border-border px-3 ${
                  creating ? 'opacity-50' : ''
                }`}
              >
                <Text className="text-[15px]">{seed.icon}</Text>
                <Text className="text-[13px] font-semibold text-text-muted">
                  {t(`savings.purposes.seeds.${seed.key}`)}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={onCreateCustom}
              className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-full border border-dashed border-border px-3"
            >
              <Text className="text-[13px] font-bold text-positive">
                + {t('savings.purposes.create_inline')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <View className="mt-2.5 rounded-xl border border-border-soft bg-card px-4 py-3">
        <View className="flex-row justify-between py-1">
          <Text className="text-[13.5px] text-text-muted">
            {allocating
              ? t('savings.purposes.unassigned_available')
              : t('savings.purposes.allocated_in', { purpose: purpose?.name ?? '' })}
          </Text>
          <Text className="text-[13.5px] font-semibold text-text">{money(available)}</Text>
        </View>
        <View className="flex-row justify-between py-1">
          <Text className="text-[13.5px] text-text-muted">
            {t(allocating ? 'savings.purposes.will_allocate' : 'savings.purposes.will_unallocate')}
          </Text>
          <Text className="text-[13.5px] font-semibold text-positive">
            {`${value > 0 ? '−' : ''}${money(value)}`}
          </Text>
        </View>
        <View className="mt-1.5 flex-row justify-between border-t border-border-soft pt-2.5">
          <Text className="text-[13.5px] text-text-muted">
            {t(allocating ? 'savings.purposes.left_unassigned' : 'savings.purposes.stays_allocated')}
          </Text>
          <Text
            className={`text-[16px] font-extrabold ${overLimit ? 'text-negative' : 'text-text'}`}
          >
            {`${remainder < 0 ? '−' : ''}${money(Math.abs(remainder))}`}
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
          disabled={busy || value <= 0 || overLimit || purpose == null}
        />
      </View>

      {/* La salida del acuse: el propósito YA quedó creado, y obligar a destinar
          algo para poder irse convertiría una confirmación en un peaje. */}
      {justCreated && (
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          className="mt-3 min-h-[44px] items-center justify-center"
        >
          <Text className="text-[13px] font-bold text-text-muted">
            {t('savings.purposes.created_skip')}
          </Text>
        </Pressable>
      )}
    </View>
  )
}
