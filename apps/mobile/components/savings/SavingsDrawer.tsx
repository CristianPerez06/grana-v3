import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { parseMoneyInput } from '@grana/validation'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import type { AvailableSums, ReserveEntry } from '@grana/savings'
import { useT } from '../../lib/locale-context'
import { useSavingsDetail } from '../../lib/savings/queries'
import { reserveAvailability, releaseAvailability } from '../../lib/savings/mutations'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { DateField } from '../ui/DateField'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { FormSheetBody } from '../layout/FormSheetBody'

type Currency = 'ARS' | 'USD'
type Mode = 'save' | 'release'

const money = (amount: number, currency: Currency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

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
  const queryClient = useQueryClient()
  const [form, setForm] = useState<{ mode: Mode; currency: Currency } | null>(null)
  const { sums, history } = useSavingsDetail(visible)

  // Reset the view when the sheet opens, derived DURING RENDER from the prop
  // rather than in an effect: it is not a synchronization with anything external
  // and an effect would cost a frame with the previous view still up.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) setForm(initialMode ?? null)
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

  const onDone = async () => {
    setForm(null)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['savings'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} ariaLabel={t('savings.title')}>
      {/* FormSheetBody because the form has a text input: an RN Modal renders in
          its own native window, so the keyboard context has to be mounted here. */}
      <FormSheetBody contentClassName="px-4 pb-2 pt-1" maxHeight={560}>
        {form ? (
          <SavingsForm
            mode={form.mode}
            currency={form.currency}
            sums={rowFor(form.currency)}
            onCancel={() => setForm(null)}
            onDone={onDone}
          />
        ) : (
          <View>
            <Text className="text-[19px] font-extrabold text-text">{t('savings.title')}</Text>
            <View className="mt-3 gap-4">
              {currencies.map((currency) => (
                <CurrencyBlock
                  key={currency}
                  currency={currency}
                  sums={rowFor(currency)}
                  entries={history[currency]}
                  onSave={() => setForm({ mode: 'save', currency })}
                  onRelease={() => setForm({ mode: 'release', currency })}
                />
              ))}
            </View>
          </View>
        )}
      </FormSheetBody>
    </BottomSheet>
  )
}

/**
 * One currency: the STOCK, this month's FLOW, and the history — the two numbers
 * users conflate, kept apart. The total is what is set aside right now; "este
 * mes" is what moved in this period, and it can be negative while the total is
 * large.
 */
const CurrencyBlock = ({
  currency,
  sums,
  entries,
  onSave,
  onRelease,
}: {
  currency: Currency
  sums: AvailableSums
  entries: ReserveEntry[]
  onSave: () => void
  onRelease: () => void
}) => {
  const t = useT()
  const monthPrefix = formatDateISO(getTodayAR()).slice(0, 7)
  const monthNet = entries
    .filter((e) => e.date.startsWith(monthPrefix))
    .reduce((acc, e) => acc + e.amount, 0)

  return (
    <View className="rounded-2xl border border-border bg-card p-4">
      <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
        {t('savings.total_label', { currency })}
      </Text>
      <Text className="mt-1.5 text-[24px] font-extrabold text-text">
        {money(sums.reserved, currency)}
      </Text>
      <View className="mt-3 flex-row items-baseline justify-between border-t border-border-soft pt-3">
        <Text className="text-[13px] text-text-muted">{t('savings.this_month')}</Text>
        <Text className="text-[14px] font-extrabold text-positive">
          {monthNet >= 0 ? '+' : '−'}
          {money(Math.abs(monthNet), currency)}
        </Text>
      </View>

      <Text className="mt-4 text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
        {t('savings.history')}
      </Text>
      {entries.length === 0 ? (
        <Text className="mt-1.5 text-[13px] text-text-soft">{t('savings.empty_history')}</Text>
      ) : (
        <View className="mt-1.5">
          {entries.map((entry) => (
            <View
              key={entry.id}
              className="flex-row items-center justify-between border-t border-border-soft py-2.5"
            >
              <Text className="text-[14px] font-semibold text-text">
                {entry.amount >= 0 ? t('savings.entry_saved') : t('savings.entry_released')}
                <Text className="text-[12px] font-medium text-text-soft"> {entry.date}</Text>
              </Text>
              <Text
                className={`text-[14px] font-extrabold ${
                  entry.amount >= 0 ? 'text-positive' : 'text-text-muted'
                }`}
              >
                {entry.amount >= 0 ? '+' : '−'}
                {money(Math.abs(entry.amount), currency)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View className="mt-4 flex-row gap-2">
        <View className="flex-1">
          <Button title={t('savings.save')} onPress={onSave} />
        </View>
        <View className="flex-1">
          <Button
            title={t('savings.release')}
            variant="secondary"
            onPress={onRelease}
            disabled={sums.reserved <= 0}
          />
        </View>
      </View>
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
  currency,
  sums,
  onCancel,
  onDone,
}: {
  mode: Mode
  currency: Currency
  sums: AvailableSums
  onCancel: () => void
  onDone: () => Promise<void>
}) => {
  const t = useT()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(formatDateISO(getTodayAR()))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Opened loose there is no income to take a percentage of, so the field starts
  // EMPTY: a pre-filled number with no anchor would read as an amount Grana is
  // recommending, and Grana does not recommend amounts.
  const value = parseMoneyInput(amount) ?? 0
  const limit = mode === 'save' ? sums.available : sums.reserved
  const remainder = limit - value

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      const action = mode === 'save' ? reserveAvailability : releaseAvailability
      const result = await action({
        amount: value,
        currency_code: currency,
        date: new Date(`${date}T00:00:00`),
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
      <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
        {t('savings.total_label', { currency })}
      </Text>
      <Text className="mt-0.5 text-[19px] font-extrabold text-text">
        {mode === 'save' ? t('savings.save') : t('savings.release')}
      </Text>

      <View className="mt-3 rounded-2xl border border-border bg-card p-4">
        <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
          {t('savings.amount_label')}
        </Text>
        <MoneyAmountInput value={amount} onChangeText={setAmount} placeholder="0" autoFocus />
      </View>

      <View className="mt-3 rounded-2xl border border-border bg-card p-4">
        <Text className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
          {t('savings.date_label')}
        </Text>
        <DateField value={date} onChange={setDate} />
      </View>

      <View className="mt-3 rounded-2xl border border-border bg-card p-4">
        <View className="flex-row justify-between py-1">
          <Text className="text-[14px] text-text-muted">
            {mode === 'save' ? t('savings.available_now') : t('savings.saved_total')}
          </Text>
          <Text className="text-[14px] font-semibold text-text">{money(limit, currency)}</Text>
        </View>
        <View className="flex-row justify-between py-1">
          <Text className="text-[14px] text-text-muted">
            {mode === 'save' ? t('savings.you_will_save') : t('savings.you_will_release')}
          </Text>
          <Text className="text-[14px] font-semibold text-positive">
            − {money(value, currency)}
          </Text>
        </View>
        <View className="mt-1.5 flex-row justify-between border-t border-border-soft pt-2.5">
          <Text className="text-[14px] text-text-muted">
            {mode === 'save' ? t('savings.left_to_spend') : t('savings.stays_saved')}
          </Text>
          <Text className="text-[16px] font-extrabold text-text">
            {money(remainder, currency)}
          </Text>
        </View>
      </View>

      {/* The copy never suggests a transfer happened. */}
      <Text className="mt-3 px-1 text-[13px] leading-snug text-text-muted">
        {mode === 'save' ? t('savings.save_note') : t('savings.release_note')}
      </Text>

      {error != null && (
        <Text className="mt-3 px-1 text-[13px] font-semibold text-negative">{error}</Text>
      )}

      <View className="mt-4 flex-row gap-2">
        <Pressable
          onPress={onCancel}
          disabled={busy}
          className="items-center justify-center rounded-xl border border-border px-4"
        >
          <Text className="text-[15px] font-bold text-text-muted">‹</Text>
        </Pressable>
        <View className="flex-1">
          <Button
            title={mode === 'save' ? t('savings.save') : t('savings.release')}
            onPress={submit}
            loading={busy}
            disabled={busy || value <= 0 || value > limit}
          />
        </View>
      </View>
    </View>
  )
}
