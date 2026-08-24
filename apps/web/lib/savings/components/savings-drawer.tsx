'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import {
  getAvailableSums,
  getReserveHistory,
  type AvailableSums,
  type ReserveEntry,
} from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { parseMoneyInput } from '@grana/validation'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { createClient } from '@/lib/supabase/client'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { cn } from '@/lib/utils'
import { reserveAvailability, releaseAvailability } from '@/app/_actions/savings'

type Currency = 'ARS' | 'USD'
type Mode = 'save' | 'release'

const money = (amount: number, currency: Currency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

/**
 * "Guardado" — the single surface for the act and for auditing it. Mirrored on
 * native as `SavingsDrawer` (a `BottomSheet` there, a `Drawer` here).
 *
 * It is an OVERLAY over the dashboard, not a page, and it has no route: you tap
 * the number, read, and close, and the number you tapped is still there. That is
 * also why "it does not enter the navigation" is not a stance — there is no
 * address to put in a menu. Same mechanism as editing an account from the list.
 *
 * The view switches in place between the detail and the form instead of stacking
 * a second drawer: the form is a step of the same conversation, not a new one.
 */
export function SavingsDrawer({
  open,
  onClose,
  initialMode,
}: {
  open: boolean
  onClose: () => void
  /** The dashboard row opens straight into the form when nothing is saved yet. */
  initialMode?: { mode: Mode; currency: Currency }
}) {
  const t = useTranslations('savings')
  const [form, setForm] = useState<{ mode: Mode; currency: Currency } | null>(null)
  const queryClient = useQueryClient()

  // The reads only run while the drawer is open: they are the detail's data, and
  // a closed drawer has no detail. `staleTime: 0` because the numbers here are
  // the ones the user just changed — a cached stock right after saving would show
  // the previous total on the screen that exists to audit it.
  const [sumsQuery, arsQuery, usdQuery] = useQueries({
    queries: [
      {
        queryKey: ['savings', 'sums'],
        queryFn: () => getAvailableSums(createClient()),
        enabled: open,
        staleTime: 0,
      },
      {
        queryKey: ['savings', 'history', 'ARS'],
        queryFn: () => getReserveHistory(createClient(), 'ARS'),
        enabled: open,
        staleTime: 0,
      },
      {
        queryKey: ['savings', 'history', 'USD'],
        queryFn: () => getReserveHistory(createClient(), 'USD'),
        enabled: open,
        staleTime: 0,
      },
    ],
  })

  const sums: AvailableSums[] | null = sumsQuery.data ?? null
  const history: Record<Currency, ReserveEntry[]> = {
    ARS: arsQuery.data ?? [],
    USD: usdQuery.data ?? [],
  }

  // Reset the view when the drawer opens, adjusting state DURING RENDER rather
  // than in an effect: the reset is derived from a prop changing, not a
  // synchronization with an external system, and doing it in an effect costs a
  // second render with the previous view still on screen.
  //
  // `initialMode` is read once per opening on purpose — reacting to it would
  // yank the user back to the form after they navigated to the detail.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setForm(initialMode ?? null)
  }

  const currencies: Currency[] = (['ARS', 'USD'] as const).filter((c) => {
    const row = sums?.find((s) => s.currencyCode === c)
    // ARS is always shown: it is the primary currency and the drawer would look
    // broken empty. USD only appears when there is something to say about it —
    // the same bimoneda rule the rest of the app follows.
    return c === 'ARS' || (row != null && (row.reserved !== 0 || row.available !== 0))
  })

  const rowFor = (currency: Currency): AvailableSums =>
    sums?.find((s) => s.currencyCode === currency) ?? {
      currencyCode: currency,
      accountsNet: 0,
      reserved: 0,
      available: 0,
    }

  const onDone = async () => {
    setForm(null)
    // Both trees change with every save: this drawer's stock and history, and
    // the dashboard's disponible and month flow.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['savings'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }

  return (
    <Drawer open={open} onClose={onClose} ariaLabel={t('title')} widthPx={480}>
      <div className="flex h-full flex-col overflow-y-auto bg-page px-5 pb-6 pt-5">
        {form ? (
          <SavingsForm
            mode={form.mode}
            currency={form.currency}
            sums={rowFor(form.currency)}
            onCancel={() => setForm(null)}
            onDone={onDone}
          />
        ) : (
          <>
            <h2 className="text-[21px] font-extrabold tracking-[-0.025em] text-text">
              {t('title')}
            </h2>
            <div className="mt-4 flex flex-col gap-5">
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
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}

/**
 * One currency's block: the STOCK, this month's FLOW, and the history.
 *
 * The two numbers are kept apart on purpose — they are the pair users conflate.
 * The total is what is set aside right now; "este mes" is what moved in this
 * period, and it can be negative while the total is large.
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
  const t = useTranslations('savings')
  const monthPrefix = formatDateISO(getTodayAR()).slice(0, 7)
  const monthNet = entries
    .filter((e) => e.date.startsWith(monthPrefix))
    .reduce((acc, e) => acc + e.amount, 0)

  return (
    <section className="rounded-2xl border border-border-soft bg-card p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
        {t('total_label', { currency })}
      </p>
      <p className="mt-2 text-[26px] font-extrabold leading-none tracking-[-0.04em] text-text">
        {money(sums.reserved, currency)}
      </p>
      <p className="mt-3 flex items-baseline justify-between border-t border-border-soft pt-3 text-[13px] text-text-muted">
        <span>{t('this_month')}</span>
        <span className="font-extrabold tabular-nums text-emerald-deep">
          {monthNet >= 0 ? '+' : '−'}
          {money(Math.abs(monthNet), currency)}
        </span>
      </p>

      <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
        {t('history')}
      </p>
      {entries.length === 0 ? (
        <p className="mt-2 text-[13px] text-text-soft">{t('empty_history')}</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-border-soft">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[14px] font-semibold text-text">
                {entry.amount >= 0 ? t('entry_saved') : t('entry_released')}
                <span className="ml-2 text-[12px] font-medium text-text-soft">{entry.date}</span>
              </span>
              <span
                className={cn(
                  'text-[14px] font-extrabold tabular-nums',
                  entry.amount >= 0 ? 'text-emerald-deep' : 'text-text-muted',
                )}
              >
                {entry.amount >= 0 ? '+' : '−'}
                {money(Math.abs(entry.amount), currency)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={onSave}>
          {t('save')}
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={onRelease}
          disabled={sums.reserved <= 0}
        >
          {t('release')}
        </Button>
      </div>
    </section>
  )
}

/**
 * The act itself.
 *
 * The amount field takes a POSITIVE number in both modes: the direction comes
 * from the verb the user tapped, never from a sign typed into the field. The
 * write path is what persists it signed.
 *
 * The maths shown is the maths OF THIS MOMENT — the disponible right now, the
 * amount, what is left — and never a calculation against the income the drawer
 * may have come from: that framing would say the reserve belongs to that
 * movement, and a reserve is fungible and belongs to no movement.
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
  const t = useTranslations('savings')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(formatDateISO(getTodayAR()))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Opened loose there is no income to take a percentage of, so the field starts
  // EMPTY. A pre-filled number with no anchor would read as an amount Grana is
  // recommending, and Grana does not recommend amounts.
  const value = parseMoneyInput(amount) ?? 0
  const limit = mode === 'save' ? sums.available : sums.reserved
  const remainder = mode === 'save' ? sums.available - value : sums.reserved - value
  const overLimit = value > limit

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const action = mode === 'save' ? reserveAvailability : releaseAvailability
      const result = await action({
        amount: value,
        currency_code: currency,
        date: new Date(`${date}T00:00:00`),
      })
      if (!result.ok) {
        setError(result.formError ?? t('errors.generic'))
        return
      }
      await onDone()
    })
  }

  return (
    <div className="flex flex-col">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
        {t('total_label', { currency })}
      </p>
      <h2 className="mt-1 text-[21px] font-extrabold tracking-[-0.025em] text-text">
        {mode === 'save' ? t('save') : t('release')}
      </h2>

      <div className="mt-4 rounded-2xl border border-border-soft bg-card p-4">
        <label
          htmlFor="savings-amount"
          className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft"
        >
          {t('amount_label')}
        </label>
        <MoneyAmountInput
          id="savings-amount"
          value={amount}
          onChange={setAmount}
          className="mt-2 w-full border-0 bg-transparent p-0 text-[30px] font-semibold tracking-[-0.03em] text-text outline-none placeholder:text-border"
          placeholder="0"
          autoFocus
        />
      </div>

      <div className="mt-3 rounded-2xl border border-border-soft bg-card p-4">
        <DatePicker
          value={date}
          onChange={setDate}
          label={t('date_label')}
          max={formatDateISO(getTodayAR())}
        />
      </div>

      <div className="mt-3 rounded-2xl border border-border-soft bg-card p-4 text-[14px]">
        <p className="flex justify-between py-1 text-text-muted">
          <span>{mode === 'save' ? t('available_now') : t('saved_total')}</span>
          <span className="font-semibold tabular-nums text-text">{money(limit, currency)}</span>
        </p>
        <p className="flex justify-between py-1 text-text-muted">
          <span>{mode === 'save' ? t('you_will_save') : t('you_will_release')}</span>
          <span className="font-semibold tabular-nums text-emerald-deep">
            − {money(value, currency)}
          </span>
        </p>
        <p className="mt-1.5 flex justify-between border-t border-border-soft pt-2.5 text-text-muted">
          <span>{mode === 'save' ? t('left_to_spend') : t('stays_saved')}</span>
          <span className="text-[16px] font-extrabold tabular-nums text-text">
            {money(remainder, currency)}
          </span>
        </p>
      </div>

      {/* The copy never suggests a transfer happened. Grana does not invent a
          financial fact to represent an intention. */}
      <p className="mt-3 px-1 text-[13px] leading-snug text-text-muted">
        {mode === 'save' ? t('save_note') : t('release_note')}
      </p>

      {error && (
        <p role="alert" className="mt-3 px-1 text-[13px] font-semibold text-negative">
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          ‹
        </Button>
        <Button className="flex-1" onClick={submit} disabled={pending || value <= 0 || overLimit}>
          {mode === 'save' ? t('save') : t('release')}
        </Button>
      </div>
    </div>
  )
}
