'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import {
  getAvailableSums,
  getReserveFlowSums,
  getReserveHistory,
  type AvailableSums,
  type ReserveEntry,
} from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { parseMoneyInput } from '@grana/validation'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { MoneyCalculatorPopover } from '@/components/ui/money-calculator-popover'
import { createClient } from '@/lib/supabase/client'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { cn } from '@/lib/utils'
import { reserveAvailability, releaseAvailability } from '@/app/_actions/savings'

type Currency = 'ARS' | 'USD'
type Mode = 'save' | 'release'

const money = (amount: number, currency: Currency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

/** "25 de ago" — el historial mostraba el ISO crudo, que nadie lee como fecha. */
const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(
    new Date(y, m - 1, d),
  )
}

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

  const today = getTodayAR()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthRange = { from: formatDateISO(monthStart), to: formatDateISO(today) }

  // The reads only run while the drawer is open: they are the detail's data, and
  // a closed drawer has no detail. `staleTime: 0` because the numbers here are
  // the ones the user just changed — a cached stock right after saving would show
  // the previous total on the screen that exists to audit it.
  const [sumsQuery, arsQuery, usdQuery, flowQuery] = useQueries({
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
      {
        // "Este mes" sale de la MISMA lectura normativa que la fila del
        // dashboard. Sumarlo acá a mano —filtrar el historial por prefijo de mes
        // y acumular— era una segunda implementación del mismo número: con
        // floats crudos en vez de `Money`, y sin el corte temporal, así que una
        // reserva fechada mañana la contaba esta pantalla y no la contaba la
        // fila. Dos números distintos para lo mismo, uno al lado del otro.
        queryKey: ['savings', 'flow', monthRange.from, monthRange.to],
        queryFn: () => getReserveFlowSums(createClient(), monthStart, today),
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
  const monthNet = (currency: Currency): number =>
    flowQuery.data?.find((f) => f.currencyCode === currency)?.reservedNet ?? 0

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

  // Al terminar la operación el drawer SE CIERRA, como el resto de los drawers
  // del repo. La confirmación es que el número del que venías cambió: quedarse
  // en el detalle deja al usuario preguntándose si pasó algo, y ese es el peor
  // final posible para una acción sobre plata.
  const onDone = async () => {
    setForm(null)
    onClose()
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
            initialCurrency={form.currency}
            rowFor={rowFor}
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
                  monthNet={monthNet(currency)}
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
  monthNet,
  onSave,
  onRelease,
}: {
  currency: Currency
  sums: AvailableSums
  entries: ReserveEntry[]
  /** Neto del mes, de `get_reserve_flow_sums`. Nunca recompuesto acá. */
  monthNet: number
  onSave: () => void
  onRelease: () => void
}) => {
  const t = useTranslations('savings')

  return (
    <section className="rounded-2xl border border-border-soft bg-card p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
        {t('total_label', { currency })}
      </p>
      <p className="mt-2 text-[26px] font-extrabold leading-none tracking-[-0.04em] text-text">
        {money(sums.reserved, currency)}
      </p>
      {/* Acá el verbo SÍ gira con el signo, y es el lugar donde corresponde: es un
          dato suelto, no un término de ninguna resta. En la card competía con la
          identidad —el número tenía que sumar y a la vez decir una dirección— y
          por eso necesitaba signo, color y verbo coordinados. Acá el verbo solo
          tiene que hacerlo legible. */}
      <p className="mt-3 flex items-baseline justify-between border-t border-border-soft pt-3 text-[13px] text-text-muted">
        <span>{t(monthNet < 0 ? 'this_month_released' : 'this_month_saved')}</span>
        <span className="font-extrabold tabular-nums text-emerald-deep">
          {monthNet < 0 ? '−' : '+'}
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
                <span className="ml-2 text-[12px] font-medium text-text-soft">
                  {shortDate(entry.date)}
                </span>
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
  initialCurrency,
  rowFor,
  onCancel,
  onDone,
}: {
  mode: Mode
  initialCurrency: Currency
  rowFor: (currency: Currency) => AvailableSums
  onCancel: () => void
  onDone: () => Promise<void>
}) => {
  const t = useTranslations('savings')
  const [currency, setCurrency] = useState<Currency>(initialCurrency)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(formatDateISO(getTodayAR()))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // The currency is offered ONLY when there is more than one to offer. Coming
  // from an income it is inherited and never asked; opened loose, a user who
  // only holds pesos should not have to confirm that they hold pesos.
  const currencyOptions = (['ARS', 'USD'] as const).filter((c) => {
    const row = rowFor(c)
    return c === initialCurrency || row.available !== 0 || row.reserved !== 0
  })
  const cycleCurrency = () => {
    if (currencyOptions.length < 2) return
    const next = currencyOptions[(currencyOptions.indexOf(currency) + 1) % currencyOptions.length]
    setCurrency(next)
  }

  const row = rowFor(currency)
  // Opened loose there is no income to take a percentage of, so the field starts
  // EMPTY. A pre-filled number with no anchor would read as an amount Grana is
  // recommending, and Grana does not recommend amounts.
  const value = parseMoneyInput(amount) ?? 0
  const limit = mode === 'save' ? row.available : row.reserved
  const remainder = limit - value
  const overLimit = value > limit
  // El mismo mensaje que devolvería el servidor, con el mismo número. Un botón
  // deshabilitado sin explicación es lo peor de los dos mundos: no podés avanzar
  // y no sabés por qué. Y decirlo acá no reemplaza la validación del write path
  // — la repite en el momento en que sirve.
  const limitError = overLimit
    ? t(mode === 'save' ? 'errors.exceeds_available' : 'errors.exceeds_reserved', {
        limit: money(limit, currency),
      })
    : null

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
      {/* Un solo título: el verbo. La eyebrow decía "Guardar" y el título
          "Guardado" — dos formas de la misma palabra, una arriba de la otra, sin
          agregar nada. La moneda ya la dice el chip del monto. */}
      <h2 className="text-[21px] font-extrabold tracking-[-0.025em] text-text">
        {mode === 'save' ? t('save') : t('release')}
      </h2>

      {/* Same amount hero as "Registrar movimiento" — same radius, same type
          scale, same currency chip, same calculator. Two surfaces that ask for
          an amount should not look like two different apps, and the chip is what
          gives this one its currency selector. */}
      <div className="mt-4 rounded-[18px] border border-border bg-card px-[22px] pb-[22px] pt-5 transition-shadow focus-within:border-[#C9CFD7] focus-within:shadow-[0_0_0_4px_rgba(11,26,43,0.05)]">
        <div className="flex items-start justify-between">
          <label
            htmlFor="savings-amount"
            className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft"
          >
            {t('amount_label')}
          </label>
          <button
            type="button"
            onClick={cycleCurrency}
            disabled={currencyOptions.length < 2}
            className="inline-flex items-center gap-1 rounded-[9px] border border-border bg-[#FAFBFC] px-2.5 py-1 text-xs font-bold text-text disabled:opacity-100"
          >
            {currency}
            {currencyOptions.length > 1 && <ChevronDown className="size-3" aria-hidden />}
          </button>
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-[27px] font-semibold leading-none text-text opacity-50">
            {currency === 'USD' ? 'U$D' : '$'}
          </span>
          <MoneyAmountInput
            id="savings-amount"
            value={amount}
            onChange={setAmount}
            placeholder="0"
            autoFocus
            className="w-full min-w-0 bg-transparent text-[46px] font-bold leading-none tracking-[-0.045em] tabular-nums text-text outline-none placeholder:text-text-soft/40"
          />
          <MoneyCalculatorPopover
            seed={amount}
            onResult={setAmount}
            className="shrink-0 self-center"
          />
        </div>
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
          <span
            className={cn(
              'text-[16px] font-extrabold tabular-nums',
              overLimit ? 'text-negative' : 'text-text',
            )}
          >
            {money(remainder, currency)}
          </span>
        </p>
      </div>

      {/* The copy never suggests a transfer happened. Grana does not invent a
          financial fact to represent an intention. */}
      <p className="mt-3 px-1 text-[13px] leading-snug text-text-muted">
        {mode === 'save' ? t('save_note') : t('release_note')}
      </p>

      {(limitError ?? error) && (
        <p role="alert" className="mt-3 px-1 text-[13px] font-semibold text-negative">
          {limitError ?? error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        {/* Volver al detalle. Era un botón fantasma con un "‹" tipográfico
            suelto: no se veía, y el área táctil quedaba por debajo de los 44px
            que pide el repo para un control. */}
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          aria-label={t('back')}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-text-muted transition-colors hover:bg-border-soft hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <Button className="h-11 flex-1" onClick={submit} disabled={pending || value <= 0 || overLimit}>
          {mode === 'save' ? t('save') : t('release')}
        </Button>
      </div>
    </div>
  )
}
