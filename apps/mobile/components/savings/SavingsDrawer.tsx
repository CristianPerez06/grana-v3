import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronDown, ChevronRight } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import { formatForDisplay, parseMoneyInput } from '@grana/validation'
import {
  PURPOSE_SEEDS,
  RESERVE_HISTORY_LIMIT,
  type AvailableSums,
  type Purpose,
  type PurposeSums,
  type ReserveEntry,
} from '@grana/savings'
import { useT, useLocale } from '../../lib/locale-context'
import { formatShortDate } from '../transactions/detail/format'
import { useSavingsDetail } from '../../lib/savings/queries'
import {
  reserveAvailability,
  releaseAvailability,
  createPurpose,
} from '../../lib/savings/mutations'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { DateField } from '../ui/DateField'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { MoneyCalculator } from '../ui/MoneyCalculator'
import { FormSheetBody } from '../layout/FormSheetBody'
import { SheetBackHeader } from './SheetBackHeader'
import { PurposePicker } from './PurposePicker'
import { PurposeForm } from './PurposeForm'
import { PurposeDelete } from './PurposeDelete'
import { PurposeGroup } from './PurposeGroup'
import { PurposeAllocate } from './PurposeAllocate'
import { colors } from '../../lib/colors'

type Currency = 'ARS' | 'USD'
type Mode = 'save' | 'release'

/**
 * Las vistas que el sheet apila, igual que en web y por la misma razón: con seis
 * vistas y varias alcanzables desde más de un lado, un estado plano obligaría a
 * cada una a recordar a dónde volver — una pila escrita a mano, peor.
 *
 * `SheetView` y no `View` como en web: acá `View` es el componente de React
 * Native y el tipo lo taparía.
 */
type SheetView =
  | { kind: 'detail' }
  | {
      kind: 'group'
      currency: Currency
      /**
       * Siempre un propósito con nombre. «Sin destino» NO tiene vista propia: es
       * el resto, y lo único que se hace con él —darle destino— es la fila misma.
       */
      purpose: Purpose
    }
  | { kind: 'form'; mode: Mode; currency: Currency; purposeId: string | null; locked: boolean }
  | { kind: 'picker'; currency: Currency; intent: 'form' | 'allocate' }
  | { kind: 'purposeForm'; purpose: Purpose | null; name?: string; icon?: string }
  | { kind: 'purposeDelete'; purpose: Purpose }
  | { kind: 'pickSource' }
  | {
      kind: 'allocate'
      currency: Currency
      /** Nulo: se llegó desde el resto y el propósito se elige en la misma pantalla. */
      purpose: Purpose | null
      direction: 'allocate' | 'unallocate'
    }

const money = (amount: number, currency: Currency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

const CURRENCY_SYMBOL: Record<Currency, string> = { ARS: '$', USD: 'U$D' }

/** Ayer, en fecha financiera AR. */
const yesterdayISO = (): string => {
  const d = getTodayAR()
  d.setDate(d.getDate() - 1)
  return formatDateISO(d)
}

/**
 * Native mirror of the web `SavingsDrawer` — same export name per the mirror
 * convention, and a BOTTOM SHEET underneath, which is the idiomatic overlay on a
 * phone. Only the implementation differs; the contract does not.
 *
 * It is a sheet, not a route.
 *
 * The reasoning is the same on both platforms: you tap the number, read, and
 * close, and the number you tapped is still there. Nothing navigates, so there
 * is no address a menu could point at — which is why "Guardado" not entering the
 * navigation is a consequence of the shape, not a product stance.
 *
 * The view switches in place between the detail and the form instead of opening
 * a second sheet: the form is a step of the same conversation.
 */
export const SavingsDrawer = ({
  visible,
  onClose,
  initialMode,
}: {
  visible: boolean
  onClose: () => void
  /** The dashboard row opens straight into the form when nothing is saved yet. */
  initialMode?: { mode: Mode; currency: Currency }
}) => {
  const t = useT()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [bankOpen, setBankOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [stack, setStack] = useState<SheetView[]>([{ kind: 'detail' }])
  const view = stack[stack.length - 1]
  const push = (next: SheetView) => setStack((s) => [...s, next])
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  const today = getTodayAR()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const { sums, history, monthNet, purposeSums, purposes } = useSavingsDetail(
    visible,
    monthStart,
    today,
  )

  // Reset the view when the sheet opens, derived DURING RENDER from the prop
  // rather than in an effect: it is not a synchronization with anything external
  // and an effect would cost a frame with the previous view still up.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) {
      setStack(
        initialMode
          ? [
              { kind: 'detail' },
              { ...initialMode, kind: 'form', purposeId: null, locked: false },
            ]
          : [{ kind: 'detail' }],
      )
    }
  }

  const rowFor = (currency: Currency): AvailableSums =>
    sums?.find((s) => s.currencyCode === currency) ?? {
      currencyCode: currency,
      accountsNet: 0,
      reserved: 0,
      available: 0,
    }

  // ARS always renders — it is the primary currency and an empty sheet reads as
  // broken. USD only when it has something to say, per the bimoneda rule.
  const currencies = (['ARS', 'USD'] as const).filter((c) => {
    const row = rowFor(c)
    return c === 'ARS' || row.reserved !== 0 || row.available !== 0
  })

  // Al terminar, el sheet SE CIERRA. La confirmación es que el número del que
  // venías cambió; quedarse en el detalle deja al usuario preguntándose si pasó
  // algo, que es el peor final para una acción sobre plata.
  const onDone = async () => {
    setStack([{ kind: 'detail' }])
    onClose()
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['savings'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }

  const purposeById = (id: string | null): Purpose | null =>
    id == null ? null : (purposes.find((p) => p.id === id) ?? null)

  const CURRENCIES = ['ARS', 'USD'] as const

  /**
   * Los grupos con sus montos EN LAS DOS MONEDAS y «Sin destino» al final.
   *
   * La lectura es por propósito y no por moneda: partirla en dos pantallas
   * obliga a recordar un número mientras se mira el otro. Los montos conviven en
   * la fila y NO se suman.
   */
  const groupsUnified = () => {
    const keys = [...new Set(purposeSums.map((r) => r.purposeId ?? 'none'))]
    const built = keys.map((key) => {
      const any = purposeSums.find((r) => (r.purposeId ?? 'none') === key)!
      return {
        purposeId: any.purposeId,
        name: any.purposeName,
        icon: any.purposeIcon,
        amounts: CURRENCIES.map((c) => ({
          currency: c as Currency,
          reserved: groupAmount(c, any.purposeId),
        })),
      }
    })
    const amountIn = (g: (typeof built)[number], c: Currency) =>
      g.amounts.find((a) => a.currency === c)?.reserved ?? 0
    const named = built
      .filter((g) => g.purposeId != null)
      .sort(
        (a, b) => amountIn(b, 'ARS') - amountIn(a, 'ARS') || amountIn(b, 'USD') - amountIn(a, 'USD'),
      )
    return [...named, ...built.filter((g) => g.purposeId == null)]
  }

  /** Un número de la card, en las dos monedas. Nunca sumadas. */
  const totals = (field: 'reserved' | 'available') =>
    currencies.map((c) => ({ currency: c as Currency, reserved: rowFor(c)[field] }))

  const currencyWithMoney = (purposeId: string | null): Currency =>
    (CURRENCIES.find((c) => groupAmount(c, purposeId) > 0) ?? 'ARS') as Currency

  const groupAmount = (currency: Currency, purposeId: string | null): number =>
    purposeSums.find((s) => s.currencyCode === currency && s.purposeId === purposeId)?.reserved ?? 0

  /** Refresca sin cerrar: tocar una etiqueta no termina ninguna operación. */
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['savings'] })

  /**
   * Elegir un propósito vuelve AL FORMULARIO que lo pidió, con el propósito ya
   * puesto — no al detalle. Perder el monto tipeado por haber ido a elegir una
   * etiqueta sería cobrarle al usuario haber querido ser prolijo.
   */
  const pickPurpose = (purposeId: string | null, known?: Purpose) =>
    setStack((prev) => {
      const picker = [...prev].reverse().find((v) => v.kind === 'picker') as
        | Extract<SheetView, { kind: 'picker' }>
        | undefined

      if (picker?.intent === 'allocate') {
        // `known` viene de quien ACABA de crear el propósito: la lista de acá es
        // la del render anterior y todavía no lo tiene. Buscarlo y no
        // encontrarlo devolvía al detalle sin decir nada.
        const target = known ?? purposes.find((p) => p.id === purposeId)
        if (!target) return prev.slice(0, 1)
        // Reemplaza al selector en vez de apilarse encima: volver desde apartar
        // lleva al grupo, no a la lista que ya cumplió su función.
        const at = prev.indexOf(picker)
        return [
          ...prev.slice(0, at),
          { kind: 'allocate', currency: picker.currency, purpose: target, direction: 'allocate' },
        ]
      }

      const at = prev.map((v) => v.kind).lastIndexOf('form')
      if (at < 0) return prev.slice(0, 1)
      const target = prev[at] as Extract<SheetView, { kind: 'form' }>
      return [...prev.slice(0, at), { ...target, purposeId }]
    })

  /**
   * Tocar una sugerencia CREA el propósito y sigue: el nombre y el ícono ya son
   * los que el usuario eligió al tocar, así que el formulario intermedio no
   * decide nada y cobra dos toques por confirmarse a sí mismo. Quien quiera otro
   * nombre tiene «Nuevo propósito» al lado.
   */
  /**
   * Crea una sugerencia y devuelve el propósito ARMADO: la lista de este render
   * es la de antes de crearlo, y buscarlo ahí ya rompió la navegación una vez.
   */
  const createFromSeed = async (seedKey: string): Promise<Purpose | null> => {
    const seed = PURPOSE_SEEDS.find((x) => x.key === seedKey)
    const name = t(`savings.purposes.seeds.${seedKey}`)
    const result = await createPurpose({ name, icon: seed?.icon ?? null })

    if (!result.ok || result.id == null) return null

    void refresh()
    return { id: result.id, name, icon: seed?.icon ?? null }
  }

  /** Desde el selector: crea y sigue al paso que lo pidió. */
  const createFromSeedAndPick = async (seedKey: string) => {
    const created = await createFromSeed(seedKey)
    if (created) pickPurpose(created.id, created)
    else push({ kind: 'purposeForm', purpose: null })
  }

  const openRelease = () => {
    const withMoney = groupsUnified().filter((g) => g.amounts.some((a) => a.reserved > 0))
    // Con un solo grupo la pregunta tiene una única respuesta: es puro paso.
    if (withMoney.length > 1) return push({ kind: 'pickSource' })
    const only = withMoney[0]
    push({
      kind: 'form',
      mode: 'release',
      currency: currencyWithMoney(only?.purposeId ?? null),
      purposeId: only?.purposeId ?? null,
      locked: true,
    })
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} ariaLabel={t('savings.title')}>
      {/* FormSheetBody because the form has a text input: an RN Modal renders in
          its own native window, so the keyboard context has to be mounted here. */}
      <FormSheetBody contentClassName="px-4 pb-2 pt-1" maxHeight={560}>
        {view.kind === 'form' && (
          <SavingsForm
            mode={view.mode}
            initialCurrency={view.currency}
            rowFor={rowFor}
            purpose={purposeById(view.purposeId)}
            purposeId={view.purposeId}
            purposeAmount={groupAmount(view.currency, view.purposeId)}
            lockedPurpose={view.locked}
            purposes={purposes}
            onSetPurpose={(purposeId: string | null) =>
              setStack((prev) => {
                const at = prev.length - 1
                const target = prev[at] as Extract<SheetView, { kind: 'form' }>
                return [...prev.slice(0, at), { ...target, purposeId }]
              })
            }
            onPickPurpose={() => push({ kind: 'purposeForm', purpose: null })}
            onCancel={back}
            onDone={onDone}
          />
        )}

        {view.kind === 'picker' && (
          <PurposePicker
            purposes={purposes}
            sums={purposeSums}
            currency={view.currency}
            allowNone={view.intent === 'form'}
            selectedId={
              (stack.find((v) => v.kind === 'form') as Extract<SheetView, { kind: 'form' }>)
                ?.purposeId ?? null
            }
            onPick={pickPurpose}
            onCreate={(seedKey) =>
              seedKey != null
                ? createFromSeedAndPick(seedKey)
                : push({ kind: 'purposeForm', purpose: null })
            }
            onBack={back}
          />
        )}

        {view.kind === 'purposeForm' && (
          <PurposeForm
            purpose={view.purpose}
            initialName={view.name}
            initialIcon={view.icon}
            onDone={async (created) => {
              if (view.purpose != null) {
                back()
              } else if (stack.some((v) => v.kind === 'form' || v.kind === 'picker')) {
                pickPurpose(created.id, created)
              } else {
                back()
              }
              void refresh()
            }}
            onBack={back}
          />
        )}

        {view.kind === 'purposeDelete' && (
          <PurposeDelete
            purpose={view.purpose}
            sums={purposeSums}
            onDone={() => {
              setStack([{ kind: 'detail' }])
              void refresh()
            }}
            onBack={back}
          />
        )}

        {view.kind === 'allocate' && (
          <PurposeAllocate
            purpose={view.purpose}
            purposes={purposes}
            currency={view.currency}
            currencies={currencies as Currency[]}
            direction={view.direction}
            availableFor={(c: Currency) =>
              view.direction === 'allocate'
                ? groupAmount(c, null)
                : groupAmount(c, view.purpose?.id ?? null)
            }
            onCreateSeed={createFromSeed}
            onCreateCustom={() => push({ kind: 'purposeForm', purpose: null })}
            onDone={() => {
              // Navegar PRIMERO. Refrescar antes dejaba la pantalla un instante
              // con los datos nuevos y el monto todavía escrito: el tope pasaba
              // a estar cruzado y se pintaba el error en rojo, sobre una
              // operación que había salido bien. Un destello que acusa un
              // problema inexistente.
              back()
              void refresh()
            }}
            onBack={back}
          />
        )}

        {view.kind === 'pickSource' && (
          <View>
            <SheetBackHeader title={t('savings.purposes.choose')} onBack={back} />
            <View className="mt-4 gap-2">
              {groupsUnified()
                .filter((g) => g.amounts.some((a) => a.reserved > 0))
                .map((group) => (
                  <Pressable
                    key={group.purposeId ?? 'none'}
                    accessibilityRole="button"
                    onPress={() =>
                      push({
                        kind: 'form',
                        mode: 'release',
                        currency: currencyWithMoney(group.purposeId),
                        purposeId: group.purposeId,
                        locked: true,
                      })
                    }
                    className="min-h-[52px] flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
                  >
                    <Text className="text-[17px]">{group.icon ?? '🫙'}</Text>
                    <Text className="flex-1 text-[14px] font-semibold text-text" numberOfLines={1}>
                      {group.name ?? t('savings.purposes.none')}
                    </Text>
                    <GroupAmounts amounts={group.amounts} />
                  </Pressable>
                ))}
            </View>
            {/* No hay "repartir": sería inventar una imputación. */}
          </View>
        )}

        {view.kind === 'group' && (
          <PurposeGroup
            currency={view.currency}
            purpose={view.purpose}
            reserved={groupAmount(view.currency, view.purpose.id)}
            amounts={(['ARS', 'USD'] as const).map((c) => ({
              currency: c,
              reserved: groupAmount(c, view.purpose.id),
            }))}
            onAllocate={() =>
              push({
                kind: 'allocate',
                currency: view.currency,
                purpose: view.purpose,
                direction: 'allocate',
              })
            }
            onUnallocate={() =>
              push({
                kind: 'allocate',
                currency: view.currency,
                purpose: view.purpose,
                direction: 'unallocate',
              })
            }
            onRelease={() =>
              push({
                kind: 'form',
                mode: 'release',
                currency: view.currency,
                purposeId: view.purpose.id,
                locked: true,
              })
            }
            onEdit={() => push({ kind: 'purposeForm', purpose: view.purpose })}
            onDelete={() => push({ kind: 'purposeDelete', purpose: view.purpose })}
            onBack={back}
          />
        )}

        {view.kind === 'detail' && (
          <View>
            <Text className="text-[19px] font-extrabold text-text">{t('savings.title')}</Text>

            {/* UN solo número protagonista, en las dos monedas y sin sumarlas.
                Sin "Para gastar" al lado: dos tarjetas gemelas no dejan
                protagonista a ninguna, y esta pantalla contesta "cuánto tengo
                guardado y para qué". El disponible es el número del dashboard,
                que está justo detrás, y acá aparece donde significa algo: como
                resultado de la resta, adentro de "Cómo se ve en tu banco". */}
            <View className="mt-3 flex-row">
              <Headline label={t('savings.total_saved')} amounts={totals('reserved')} />
            </View>

            <Text className="mt-4 text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
              {t('savings.purposes.label')}
            </Text>
            <View className="mt-1.5 gap-1">
              {groupsUnified().map((group) => (
                <Pressable
                  key={group.purposeId ?? 'none'}
                  accessibilityRole="button"
                  onPress={() =>
                    group.purposeId == null
                      ? push({
                          kind: 'allocate',
                          currency: currencyWithMoney(null),
                          purpose: null,
                          direction: 'allocate',
                        })
                      : push({
                          kind: 'group',
                          currency: currencyWithMoney(group.purposeId),
                          purpose: purposeById(group.purposeId)!,
                        })
                  }
                  className="min-h-[44px] flex-row items-center gap-2.5 rounded-xl px-1 py-1.5"
                >
                  <Text className="text-[15px]">{group.icon ?? '🫙'}</Text>
                  <Text className="flex-1 text-[14px] font-semibold text-text" numberOfLines={1}>
                    {group.name ?? t('savings.purposes.none')}
                  </Text>
                  <GroupAmounts amounts={group.amounts} />
                  <ChevronRight size={15} color={colors.textSoft} />
                </Pressable>
              ))}
            </View>

            <View className="mt-4 flex-row gap-2">
              <View className="flex-1">
                <Button
                  title={t('savings.save')}
                  onPress={() =>
                    push({
                      kind: 'form',
                      mode: 'save',
                      currency: 'ARS',
                      purposeId: null,
                      locked: false,
                    })
                  }
                />
              </View>
              <View className="flex-1">
                <Button
                  title={t('savings.release')}
                  variant="secondary"
                  onPress={openRelease}
                  disabled={totals('reserved').every((a) => a.reserved <= 0)}
                />
              </View>
            </View>

            {/* Plegado: era el centro de la fase 1, cuando la idea nueva era "tu
                banco muestra otro número". Ya no lo es, pero no se borra — es lo
                que evita que alguien abra su home banking, vea otra cifra y le
                crea al banco. */}
            <Pressable
              accessibilityRole="button"
              onPress={() => setBankOpen((v) => !v)}
              className="mt-4 min-h-[44px] flex-row items-center gap-1.5"
            >
              <ChevronRight
                size={13}
                color={colors.textSoft}
                style={{ transform: [{ rotate: bankOpen ? '90deg' : '0deg' }] }}
              />
              <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
                {t('savings.bank_fold')}
              </Text>
            </Pressable>
            {bankOpen && (
              <View className="mt-1.5 gap-2.5">
                {currencies.map((currency) => (
                  <BankBridge
                    key={currency}
                    currency={currency}
                    sums={rowFor(currency)}
                    monthNet={monthNet(currency)}
                  />
                ))}
                <Text className="px-1 text-[12.5px] leading-snug text-text-soft">
                  {t('savings.gap_note')}
                </Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={() => setHistoryOpen((v) => !v)}
              className="mt-3 min-h-[44px] flex-row items-center gap-1.5"
            >
              <ChevronRight
                size={13}
                color={colors.textSoft}
                style={{ transform: [{ rotate: historyOpen ? '90deg' : '0deg' }] }}
              />
              <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
                {t('savings.history_count', { count: String(history.entries.length) })}
              </Text>
            </Pressable>
            {historyOpen && (
              <View className="mt-1.5">
                {history.entries.length === 0 ? (
                  <Text className="text-[13px] text-text-soft">
                    {t('savings.empty_history')}
                  </Text>
                ) : (
                  history.entries.map((entry) => (
                    <View
                      key={entry.id}
                      className="flex-row items-center justify-between border-t border-border-soft py-2.5"
                    >
                      <Text className="text-[14px] font-semibold text-text">
                        {entry.amount >= 0
                          ? t('savings.entry_saved')
                          : t('savings.entry_released')}
                        <Text className="text-[12px] font-medium text-text-soft">
                          {' '}
                          {formatShortDate(entry.date, locale)}
                        </Text>
                      </Text>
                      <Text
                        className={`text-[14px] font-extrabold ${
                          entry.amount >= 0 ? 'text-positive' : 'text-text-muted'
                        }`}
                      >
                        {entry.amount >= 0 ? '+' : '−'}
                        {money(Math.abs(entry.amount), entry.currencyCode)}
                      </Text>
                    </View>
                  ))
                )}
                {history.hasMore && (
                  <Text className="mt-2 text-[12px] text-text-soft">
                    {t('savings.history_truncated', { count: String(RESERVE_HISTORY_LIMIT) })}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      </FormSheetBody>
    </BottomSheet>
  )
}

/**
 * Un número de la card, en las dos monedas.
 *
 * Sin total que las sume: eso exige convertir, y Grana no convierte. La segunda
 * línea aparece SOLO si hay algo — la mayoría tiene pesos y nada más, y una
 * línea vacía de dólares les cobraría altura por un dato que no tienen.
 */
const Headline = ({
  label,
  amounts,
}: {
  label: string
  amounts: { currency: Currency; reserved: number }[]
}) => {
  const shown = amounts.filter((a, i) => a.reserved !== 0 || i === 0)

  return (
    <View className="flex-1 rounded-2xl border border-border bg-card p-3">
      <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
        {label}
      </Text>
      {shown.map((a, i) => (
        <Text
          key={a.currency}
          className={
            i === 0
              ? 'mt-1.5 text-[19px] font-extrabold text-text'
              : 'mt-0.5 text-[13px] font-bold text-text-muted'
          }
          numberOfLines={1}
        >
          {money(a.reserved, a.currency)}
        </Text>
      ))}
    </View>
  )
}

/** Los montos de un grupo en las dos monedas, apilados y sin sumar. */
const GroupAmounts = ({ amounts }: { amounts: { currency: Currency; reserved: number }[] }) => {
  // Solo las monedas con algo: la fila crece únicamente cuando el dato lo pide.
  const shown = amounts.filter((a) => a.reserved !== 0)
  const list = shown.length > 0 ? shown : [amounts[0]]

  return (
    <View className="items-end">
      {list.map((a, i) => (
        <Text
          key={a.currency}
          className={`text-[14px] font-extrabold ${i === 0 ? 'text-text' : 'text-text-muted'}`}
        >
          {money(a.reserved, a.currency)}
        </Text>
      ))}
    </View>
  )
}

/**
 * El puente entre el número del banco y el de Grana.
 *
 * Sin esto, quien abre su cuenta y ve un total distinto al de acá no tiene dónde
 * entender la diferencia — y le cree al banco. Va plegado porque se entiende una
 * vez, no porque haya dejado de importar.
 */
const BankBridge = ({
  currency,
  sums,
  monthNet,
}: {
  currency: Currency
  sums: AvailableSums
  /** Neto del mes, de `get_reserve_flow_sums`. Nunca recompuesto acá. */
  monthNet: number
}) => {
  const t = useT()

  return (
    <View className="rounded-xl bg-border-soft px-3 py-2.5">
      <View className="flex-row justify-between py-0.5">
        <Text className="text-[13px] text-text-muted">
          {t('savings.accounts_total', { currency })}
        </Text>
        <Text className="text-[13px] font-semibold text-text">
          {money(sums.accountsNet, currency)}
        </Text>
      </View>
      <View className="flex-row justify-between py-0.5">
        <Text className="text-[13px] text-text-muted">{t('savings.title')}</Text>
        <Text className="text-[13px] font-semibold text-positive">
          {`−${money(sums.reserved, currency)}`}
        </Text>
      </View>
      <View className="mt-1 flex-row justify-between border-t border-border pt-1.5">
        <Text className="text-[13px] text-text-muted">{t('savings.to_spend')}</Text>
        <Text className="text-[13px] font-extrabold text-text">
          {money(sums.available, currency)}
        </Text>
      </View>
      {monthNet !== 0 && (
        <View className="mt-1.5 flex-row justify-between border-t border-border pt-1.5">
          <Text className="text-[13px] text-text-muted">
            {t(monthNet < 0 ? 'savings.this_month_released' : 'savings.this_month_saved')}
          </Text>
          {/* Sin signo: el VERBO ya lleva la dirección. "Volviste a usar
              −$110.000" es una doble negación. */}
          <Text
            className={`text-[13px] font-extrabold ${
              monthNet >= 0 ? 'text-positive' : 'text-text-muted'
            }`}
          >
            {money(Math.abs(monthNet), currency)}
          </Text>
        </View>
      )}
    </View>
  )
}

/**
 * The act. The amount field takes a POSITIVE number in both modes: the direction
 * comes from the verb the user tapped, never from a sign typed into the field.
 *
 * The maths shown is the maths OF THIS MOMENT — never a calculation against the
 * income the sheet may have come from, which would say the reserve belongs to
 * that movement. A reserve is fungible and belongs to no movement.
 */
const SavingsForm = ({
  mode,
  initialCurrency,
  rowFor,
  purpose,
  purposeId,
  purposeAmount,
  lockedPurpose,
  purposes,
  onSetPurpose,
  onPickPurpose,
  onCancel,
  onDone,
}: {
  mode: Mode
  initialCurrency: Currency
  rowFor: (currency: Currency) => AvailableSums
  /** El propósito elegido, ya resuelto. `null` es «Sin destino». */
  purpose: Purpose | null
  purposeId: string | null
  /** Lo guardado en ese grupo y esa moneda: es el piso cuando se vuelve a usar. */
  purposeAmount: number
  /** Se llegó desde un grupo: el propósito se hereda y no se ofrece cambiarlo. */
  lockedPurpose: boolean
  /** Los propósitos del usuario, como chips: elegir no debería costar pantalla. */
  purposes: Purpose[]
  onSetPurpose: (purposeId: string | null) => void
  /** Crear uno nuevo, que sí necesita su pantalla. */
  onPickPurpose: () => void
  onCancel: () => void
  onDone: () => Promise<void>
}) => {
  const t = useT()
  const [currency, setCurrency] = useState<Currency>(initialCurrency)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(formatDateISO(getTodayAR()))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // The currency is offered ONLY when there is more than one to offer: coming
  // from an income it is inherited, and a user who only holds pesos should not
  // have to confirm that they hold pesos.
  const currencyOptions = (['ARS', 'USD'] as const).filter((c) => {
    const row = rowFor(c)
    return c === initialCurrency || row.available !== 0 || row.reserved !== 0
  })
  const cycleCurrency = () => {
    if (currencyOptions.length < 2) return
    setCurrency(
      currencyOptions[(currencyOptions.indexOf(currency) + 1) % currencyOptions.length],
    )
  }

  const sums = rowFor(currency)
  // Opened loose there is no income to take a percentage of, so the field starts
  // EMPTY: a pre-filled number with no anchor would read as an amount Grana is
  // recommending, and Grana does not recommend amounts.
  const value = parseMoneyInput(amount) ?? 0
  // El tope de guardar es el disponible de la MONEDA; el piso de volver a usar
  // es el de ESTE GRUPO. La misma asimetría que aplica el write path: un
  // propósito no tiene objetivo, así que guardar no tiene contra qué toparse,
  // pero volver a usar no puede dejar un grupo en negativo aunque el total
  // guardado —visible en la pantalla anterior— lo cubra.
  const limit = mode === 'save' ? sums.available : purposeAmount
  const remainder = limit - value
  const overLimit = value > limit
  // El mismo mensaje que devolvería el servidor, con el mismo número: un botón
  // deshabilitado sin explicación no deja avanzar y tampoco dice por qué.
  const limitError = overLimit
    ? mode === 'save'
      ? t('savings.errors.exceeds_available', { limit: money(limit, currency) })
      : purpose != null
        ? t('savings.errors.exceeds_purpose_reserved', {
            limit: money(limit, currency),
            purpose: purpose.name,
          })
        : t('savings.errors.exceeds_reserved', { limit: money(limit, currency) })
    : null
  const amountInputWidth = Math.max(1, formatForDisplay(amount).length) * 20 + 2

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      const action = mode === 'save' ? reserveAvailability : releaseAvailability
      const result = await action({
        amount: value,
        currency_code: currency,
        date: new Date(`${date}T00:00:00`),
        purpose_id: purposeId,
      })
      if (!result.ok) {
        const limitText = money(result.limit ?? 0, currency)
        setError(
          result.messageKey
            ? t(result.messageKey, { limit: limitText })
            : t('savings.errors.generic'),
        )
        return
      }
      await onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <View>
      {/* Un solo título: el verbo. La eyebrow decía "Guardar" y el título
          "Guardado" — dos formas de la misma palabra sin agregar nada. */}
      {/* La vuelta atrás va ACÁ, como en el resto de la app y como en las demás
          vistas de este mismo sheet. En el pie competía con el CTA: dos
          controles juntos, uno que avanza y otro que retrocede, y el que
          retrocede no es una alternativa a confirmar. */}
      <SheetBackHeader
        title={mode === 'save' ? t('savings.save') : t('savings.release')}
        onBack={onCancel}
      />

      {/* Same amount hero as the native "Registrar movimiento": eyebrow top-left,
          currency chip and calculator pinned top-right (both absolute, so they
          don't drag the number down), and the big number centered inside a
          min-height. Two surfaces that ask for an amount should not look like two
          different apps — and the chip is what gives this one its currency
          selector. */}
      <View className="mt-3 rounded-2xl border border-border bg-card px-4 pb-4 pt-3.5">
        <View className="relative">
          <Text className="absolute left-0 top-0 text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {t('savings.amount_label')}
          </Text>
          <View className="absolute right-0 top-0 items-end gap-1.5">
            <Pressable
              onPress={cycleCurrency}
              disabled={currencyOptions.length < 2}
              accessibilityRole="button"
              accessibilityLabel={t('savings.currency_label')}
              className="flex-row items-center gap-1 rounded-lg border border-border bg-border-soft px-2.5 py-1"
            >
              <Text className="text-xs font-bold text-text">{currency}</Text>
              {currencyOptions.length > 1 && <ChevronDown size={12} color={colors.text} />}
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

      {/* La fecha, compacta y con atajos: el mismo patrón que el alta de
          movimientos. Como card entera pesaba igual que el monto, y acá la fecha
          es casi siempre hoy — el foco es cuánto y para qué. */}
      <View className="mt-3 flex-row items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
        <View className="min-w-0 flex-1">
          <DateField value={date} onChange={setDate} />
        </View>
        <View className="flex-row items-center gap-1.5">
          {[
            { label: t('transactions.form.date_today'), value: formatDateISO(getTodayAR()) },
            { label: t('transactions.form.date_yesterday'), value: yesterdayISO() },
          ].map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => setDate(option.value)}
              className={`rounded-lg px-2.5 py-1.5 ${
                date === option.value ? 'bg-navy' : 'border border-border'
              }`}
            >
              <Text
                className={`text-[11px] font-bold ${
                  date === option.value ? 'text-white' : 'text-text-muted'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Para qué, COMO CHIPS y no como una fila que abre otra pantalla: decir
          "guardo $10.000 para Casa" no debería costar tres pantallas, y los
          propósitos son pocos por naturaleza. El selector aparte queda para
          crear uno nuevo.

          Solo al guardar: al volver a usar el propósito viene heredado del
          grupo desde el que se entró. */}
      {mode === 'save' && !lockedPurpose && (
        <View className="mt-3">
          <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
            {t('savings.purposes.label')}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {[null, ...purposes].map((option) => {
              const id = option?.id ?? null
              return (
                <Pressable
                  key={id ?? 'none'}
                  accessibilityRole="button"
                  onPress={() => onSetPurpose(id)}
                  className={`min-h-[44px] flex-row items-center gap-2 rounded-full border px-3.5 ${
                    purposeId === id ? 'border-positive bg-border-soft' : 'border-border bg-card'
                  }`}
                >
                  <Text className="text-[15px]">{option?.icon ?? '🫙'}</Text>
                  <Text className="text-[13.5px] font-semibold text-text">
                    {option?.name ?? t('savings.purposes.none')}
                  </Text>
                </Pressable>
              )
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('savings.purposes.new')}
              onPress={onPickPurpose}
              className="size-11 items-center justify-center rounded-full border border-dashed border-border"
            >
              <Text className="text-[16px] font-bold text-positive">+</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Heredado desde un grupo: se muestra, no se ofrece cambiar. */}
      {(mode === 'release' || lockedPurpose) && (
        <View className="mt-3 min-h-[52px] flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2">
          <Text className="text-[13px] text-text-muted">{t('savings.purposes.label')}</Text>
          <Text className="ml-auto text-[15px]">{purpose?.icon ?? '🫙'}</Text>
          <Text className="text-[14px] font-semibold text-text" numberOfLines={1}>
            {purpose?.name ?? t('savings.purposes.none')}
          </Text>
        </View>
      )}

      <View className="mt-3 rounded-2xl border border-border bg-card p-4">
        <View className="flex-row justify-between py-1">
          <Text className="text-[14px] text-text-muted">
            {mode === 'save'
              ? t('savings.available_now')
              : purpose != null
                ? t('savings.saved_in', { purpose: purpose.name })
                : t('savings.saved_total')}
          </Text>
          <Text className="text-[14px] font-semibold text-text">{money(limit, currency)}</Text>
        </View>
        <View className="flex-row justify-between py-1">
          <Text className="text-[14px] text-text-muted">
            {mode === 'save' ? t('savings.you_will_save') : t('savings.you_will_release')}
          </Text>
          <Text className="text-[14px] font-semibold text-positive">
            {`${value > 0 ? '−' : ''}${money(value, currency)}`}
          </Text>
        </View>
        <View className="mt-1.5 flex-row justify-between border-t border-border-soft pt-2.5">
          <Text className="text-[14px] text-text-muted">
            {mode === 'save'
              ? t('savings.left_to_spend')
              : purpose != null
                ? t('savings.stays_in', { purpose: purpose.name })
                : t('savings.stays_saved')}
          </Text>
          <Text
            className={`text-[16px] font-extrabold ${overLimit ? 'text-negative' : 'text-text'}`}
          >
            {money(remainder, currency)}
          </Text>
        </View>
      </View>

      {/* The copy never suggests a transfer happened. */}
      <Text className="mt-3 px-1 text-[13px] leading-snug text-text-muted">
        {mode === 'save' ? t('savings.save_note') : t('savings.release_note')}
      </Text>

      {(limitError ?? error) != null && (
        <Text className="mt-3 px-1 text-[13px] font-semibold text-negative">
          {limitError ?? error}
        </Text>
      )}

      <View className="mt-4">
        <Button
          title={mode === 'save' ? t('savings.save') : t('savings.release')}
          onPress={submit}
          loading={busy}
          disabled={busy || value <= 0 || overLimit}
        />
      </View>
    </View>
  )
}
