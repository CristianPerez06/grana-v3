import { useState } from 'react'
import { Pressable, Text, useWindowDimensions, View } from 'react-native'
import { ChevronDown, Plus } from 'lucide-react-native'
import { colors } from '../../lib/colors'
import { PURPOSE_SEEDS, fitChipCount, type Purpose } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import { formatForDisplay, parseMoneyInput } from '@grana/validation'
import { useT } from '../../lib/locale-context'
import { Button } from '../ui/Button'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { MoneyCalculator } from '../ui/MoneyCalculator'
import { allocateToPurpose, unallocateFromPurpose } from '../../lib/savings/mutations'
import { SheetBackHeader } from './SheetBackHeader'
import { CHIP_SLOP, TAP_SLOP } from './tap-slop'

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
  allocatedIn,
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
  /**
   * Lo destinado a un propósito en esta moneda. Solo para ORDENAR los chips:
   * los que ya tienen plata primero, que son los que se buscan. Sin esto la
   * lista queda alfabética y lo que se pliega son los últimos del abecedario.
   */
  allocatedIn: (currency: Currency, purposeId: string) => number
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
  const [showAllPurposes, setShowAllPurposes] = useState(false)
  const { width: windowWidth } = useWindowDimensions()

  /** Dos filas de chips, igual que el formulario de guardar: se topea el ALTO. */
  const chipRowWidth = windowWidth - 32
  const PURPOSE_CHIP_ROWS = 2
  // Por saldo descendente y, a igualdad, por nombre: lo que se pliega son los
  // que menos tienen, no los últimos del abecedario.
  const sortedPurposes = [...purposes].sort(
    (a, b) =>
      allocatedIn(currency, b.id) - allocatedIn(currency, a.id) || a.name.localeCompare(b.name),
  )
  /**
   * El elegido entra SIEMPRE, aunque caiga fuera del corte: un chip seleccionado
   * que se esconde al plegar deja la pantalla diciendo que se destina a otro
   * lado del que se eligió.
   */
  const chipFit = fitChipCount(
    sortedPurposes.map((x) => x.name),
    chipRowWidth,
    PURPOSE_CHIP_ROWS,
  )
  const shownPurposes = showAllPurposes
    ? sortedPurposes
    : (() => {
        const head = sortedPurposes.slice(0, chipFit)
        if (chosen == null || head.some((x) => x.id === chosen.id)) return head
        return [...head.slice(0, Math.max(1, chipFit - 1)), chosen]
      })()
  const hiddenPurposes = sortedPurposes.length - shownPurposes.length

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
  const amountInputWidth = Math.max(1, formatForDisplay(amount).length) * 16 + 2

  const limitError = overLimit
    ? allocating
      ? t('savings.purposes.errors.exceeds_unassigned', { limit: money(available) })
      : t('savings.purposes.errors.exceeds_allocated', { limit: money(available) })
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
      <View className="mt-2.5 rounded-2xl border border-border bg-card px-4 pb-3 pt-3">
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
          <View className="min-h-[54px] flex-row items-center justify-center">
            <Text className="pl-1 text-[27px] font-bold text-text">
              {CURRENCY_SYMBOL[currency]}
            </Text>
            <MoneyAmountInput
              bare
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              autoFocus
              style={{ width: amountInputWidth, paddingVertical: 0 }}
              className="ml-1 text-[27px] font-bold text-text"
            />
          </View>
        </View>
      </View>

      {/* Elegir para qué EN LA MISMA PANTALLA: cuánto y para qué son dos datos
          de una sola decisión, y separarlos cobraba navegación por no decidir
          nada. Los propósitos son pocos por naturaleza, así que caben como
          chips. */}
      {fixedPurpose == null && (
        <View className="mt-2.5">
          {/* La puerta para crear va a la DERECHA del rótulo, igual que en el
              formulario de guardar, que en la página y que en web: al final de
              los chips caía sola en su fila cuando la última estaba llena, y ahí
              no se lee como acción sino como un chip cortado. Acá había quedado
              como chip. */}
          <View className="flex-row items-center justify-between gap-3">
            <Text className="shrink text-[11px] font-bold uppercase tracking-wider text-text-soft">
              {t('savings.purposes.pick_inline')}
            </Text>
            <View className="shrink-0 flex-row items-center gap-3">
              {hiddenPurposes > 0 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAllPurposes(true)}
                  hitSlop={TAP_SLOP}
                  className="shrink-0 justify-center"
                >
                  <Text className="text-[12px] font-extrabold text-text-muted">
                    {t('savings.purposes.show_more', { count: String(hiddenPurposes) })}
                  </Text>
                </Pressable>
              )}
              {showAllPurposes && sortedPurposes.length > chipFit && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowAllPurposes(false)}
                  hitSlop={TAP_SLOP}
                  className="shrink-0 justify-center"
                >
                  <Text className="text-[12px] font-extrabold text-text-muted">
                    {t('savings.purposes.show_less')}
                  </Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={onCreateCustom}
                hitSlop={TAP_SLOP}
                className="shrink-0 flex-row items-center gap-1"
              >
                <Plus size={13} color={colors.emeraldDeep} strokeWidth={2.5} />
                <Text className="text-[12px] font-extrabold text-positive">
                  {t('savings.purposes.new')}
                </Text>
              </Pressable>
            </View>
          </View>
          {/* Mismo techo que en guardar: con diez propósitos, la lista completa
              empujaba el resumen y el CTA fuera de la pantalla. */}
          <View className="mt-1.5 flex-row flex-wrap gap-1.5">
            {shownPurposes.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                onPress={() => setChosen(option)}
                accessibilityState={{ selected: chosen?.id === option.id }}
                hitSlop={CHIP_SLOP}
                className={`flex-row items-center gap-1.5 rounded-full border px-3 py-2 ${
                  chosen?.id === option.id
                    ? 'border-emerald-deep bg-emerald-deep/5'
                    : 'border-border-soft bg-card'
                }`}
              >
                <Text className="text-[15px]">{option.icon ?? '🫙'}</Text>
                <Text className="text-[13px] font-semibold text-text">{option.name}</Text>
              </Pressable>
            ))}
            {/* Las sugerencias solo cuando NO hay propósitos plegados: son un
                atajo para quien todavía no armó los suyos, y ofrecerlas al lado
                de un «+3» sería empujar a crear mientras se esconde lo que ya
                existe. */}
            {hiddenPurposes === 0 &&
              suggestions.map((seed) => (
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
                hitSlop={CHIP_SLOP}
                className={`flex-row items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-2 ${
                  creating ? 'opacity-50' : ''
                }`}
              >
                <Text className="text-[15px]">{seed.icon}</Text>
                <Text className="text-[13px] font-semibold text-text-muted">
                  {t(`savings.purposes.seeds.${seed.key}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View className="mt-2.5 rounded-xl border border-border-soft bg-card px-4 py-2.5">
        <View className="flex-row justify-between py-0.5">
          <Text className="text-[13.5px] text-text-muted">
            {allocating
              ? t('savings.purposes.unassigned_available')
              : t('savings.purposes.allocated_in', { purpose: purpose?.name ?? '' })}
          </Text>
          <Text className="text-[13.5px] font-semibold text-text">{money(available)}</Text>
        </View>
        <View className="flex-row justify-between py-0.5">
          <Text className="text-[13.5px] text-text-muted">
            {t(allocating ? 'savings.purposes.will_allocate' : 'savings.purposes.will_unallocate')}
          </Text>
          <Text className="text-[13.5px] font-semibold text-positive">
            {`${value > 0 ? '−' : ''}${money(value)}`}
          </Text>
        </View>
        <View className="mt-1.5 flex-row justify-between border-t border-border-soft pt-2">
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
      <Text className="mt-2 px-1 text-[12.5px] leading-snug text-text-soft">
        {t('savings.purposes.allocate_note')}
      </Text>

      {(limitError ?? error) != null && (
        <Text className="mt-3 text-[13px] font-semibold text-negative">{limitError ?? error}</Text>
      )}

      <View className="mt-3">
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
