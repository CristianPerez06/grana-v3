'use client'

import { forwardRef, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowLeftRight,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Repeat,
  Tag,
  Wallet,
  X,
} from 'lucide-react'
import type { ResolvedAccountAvatar } from '@grana/ui-contracts'
import { Drawer } from '@/components/ui/drawer'
import { Popover } from '@/components/ui/popover'
import { AccountAvatar } from '@/components/ui/account-avatar'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { parseMoneyInput } from '@grana/validation'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { createRecurrence } from '@/app/_actions/recurrences'
import type { CategoryWithSubcategories } from '@/lib/categories/types'

export type RecurrenceAccount = {
  id: string
  name: string
  type: 'cash' | 'bank' | 'credit'
  activeCurrencies: ('ARS' | 'USD')[]
  avatar?: ResolvedAccountAvatar
}

type MovementType = 'income' | 'expense' | 'transfer'
type FrequencyPreset = 'weekly' | 'biweekly' | 'monthly' | 'annual' | 'custom'
type IntervalUnit = 'day' | 'week' | 'month' | 'year'

type Props = {
  open: boolean
  onClose: () => void
  accounts: RecurrenceAccount[]
  categories: CategoryWithSubcategories[]
}

const CURRENCY_SYMBOL: Record<'ARS' | 'USD', string> = { ARS: '$', USD: 'U$D' }
const FIELD_BG = '#FAFBFC'
const ROW_DIVIDER = '#F1F3F6'
const PRESETS: FrequencyPreset[] = ['weekly', 'biweekly', 'monthly', 'annual', 'custom']
const UNITS: IntervalUnit[] = ['day', 'week', 'month', 'year']

const todayISO = () => formatDateISO(getTodayAR())

// Income/transfer live on cash/bank; only an expense can target a credit card.
const eligibleFor = (accounts: RecurrenceAccount[], type: MovementType) =>
  type === 'expense' ? accounts : accounts.filter((a) => a.type !== 'credit')

const avatarOf = (a: RecurrenceAccount): ResolvedAccountAvatar =>
  a.avatar ?? {
    colorKey: null,
    colorOverride: null,
    iconKey: a.type === 'credit' ? 'credit-card' : 'wallet',
    monogram: a.name.charAt(0).toUpperCase(),
  }

// One clickable row in a field-group card: icon chip + label/value + chevron.
type RowProps = {
  icon: ReactNode
  label: string
  value: ReactNode
}
const FieldRow = forwardRef<
  HTMLButtonElement,
  RowProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'>
>(({ icon, label, value, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FBFCFD]"
    {...rest}
  >
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-text-muted"
      style={{ backgroundColor: FIELD_BG }}
    >
      {icon}
    </span>
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">{label}</span>
      <span className="truncate text-[15px] font-semibold leading-snug text-text">{value}</span>
    </span>
    <ChevronRight className="size-4 shrink-0 text-text-soft/60" aria-hidden />
  </button>
))
FieldRow.displayName = 'FieldRow'

const AccountValue = ({ account }: { account: RecurrenceAccount | undefined }) =>
  account ? (
    <span className="flex items-center gap-2">
      <AccountAvatar {...avatarOf(account)} size="sm" />
      <span className="truncate text-text">{account.name}</span>
    </span>
  ) : (
    <span className="text-text-soft">—</span>
  )

export const CreateRecurrenceModal = ({ open, onClose, accounts, categories }: Props) => {
  const router = useRouter()
  const tRec = useTranslations('recurrences')
  const tTx = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const [type, setType] = useState<MovementType>('expense')
  const eligibleAccounts = useMemo(() => eligibleFor(accounts, type), [accounts, type])

  const [accountId, setAccountId] = useState(eligibleAccounts[0]?.id ?? '')
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? eligibleAccounts[0]
  const activeCurrencies = selectedAccount?.activeCurrencies ?? ['ARS']

  const [currencyCode, setCurrencyCode] = useState<'ARS' | 'USD'>(activeCurrencies[0] ?? 'ARS')
  const [amount, setAmount] = useState('')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(todayISO())

  const [frequency, setFrequency] = useState<FrequencyPreset>('monthly')
  const [intervalCount, setIntervalCount] = useState(1)
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('month')
  const [hasEndDate, setHasEndDate] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [maxOccurrences, setMaxOccurrences] = useState('')

  // Single open popover at a time: 'account' | 'destination' | 'category' | 'date'.
  const [activePopover, setActivePopover] = useState<string | null>(null)
  const [catDrill, setCatDrill] = useState<string | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  const isCredit = selectedAccount?.type === 'credit'
  const isUSDCard = isCredit && currencyCode === 'USD'

  const categoryList = useMemo(
    () =>
      categories.filter((c) =>
        type === 'income' ? c.type === 'income' || c.type === 'both' : c.type === 'expense' || c.type === 'both',
      ),
    [categories, type],
  )
  const selectedCategory = categoryList.find((c) => c.id === categoryId)
  const subcategoryName =
    selectedCategory?.subcategories.find((s) => s.id === subcategoryId)?.name ?? null
  const transferDestinations = accounts.filter((a) => a.type !== 'credit' && a.id !== accountId)
  const destinationAccount = transferDestinations.find((a) => a.id === destinationAccountId)

  const signChar = type === 'income' ? '+' : type === 'expense' ? '−' : '↔'
  const amountColor = type === 'income' ? 'text-emerald-deep' : 'text-text'

  const handleTypeChange = (next: MovementType) => {
    setType(next)
    setCategoryId('')
    setSubcategoryId('')
    setCatDrill(null)
    setFormError(null)
    const eligible = eligibleFor(accounts, next)
    if (!eligible.some((a) => a.id === accountId)) {
      const first = eligible[0]
      setAccountId(first?.id ?? '')
      if (first && !first.activeCurrencies.includes(currencyCode)) {
        setCurrencyCode(first.activeCurrencies[0] ?? 'ARS')
      }
    }
  }

  const handleAccountChange = (id: string) => {
    setAccountId(id)
    const account = accounts.find((a) => a.id === id)
    if (account && !account.activeCurrencies.includes(currencyCode)) {
      setCurrencyCode(account.activeCurrencies[0] ?? 'ARS')
    }
  }

  const cycleCurrency = () => {
    if (activeCurrencies.length < 2) return
    const idx = activeCurrencies.indexOf(currencyCode)
    setCurrencyCode(activeCurrencies[(idx + 1) % activeCurrencies.length])
  }

  const pickCategory = (catId: string, subId: string) => {
    setCategoryId(catId)
    setSubcategoryId(subId)
    setCatDrill(null)
    setActivePopover(null)
  }

  const reset = () => {
    setType('expense')
    setAccountId(eligibleFor(accounts, 'expense')[0]?.id ?? '')
    setCurrencyCode('ARS')
    setAmount('')
    setDestinationAccountId('')
    setCategoryId('')
    setSubcategoryId('')
    setDescription('')
    setStartDate(todayISO())
    setFrequency('monthly')
    setIntervalCount(1)
    setIntervalUnit('month')
    setHasEndDate(false)
    setEndDate('')
    setMaxOccurrences('')
    setActivePopover(null)
    setCatDrill(null)
    setFormError(null)
  }

  const close = () => {
    reset()
    onClose()
  }

  const formatDateValue = (d: string) => {
    const [y, m, day] = d.split('-').map(Number)
    const label = new Date(y, m - 1, day).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    return d === todayISO() ? `${tRec('create.today')} · ${label}` : label
  }

  const freqLabel = tRec(`frequencies.${frequency}`)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) {
      setFormError(tRec('errors.amount_invalid'))
      return
    }
    if ((type === 'income' || type === 'expense') && !categoryId) {
      setFormError(tRec('create.errors.category_required'))
      return
    }
    if (type === 'transfer') {
      if (!destinationAccountId) {
        setFormError(tRec('create.errors.destination_required'))
        return
      }
      if (destinationAccountId === accountId) {
        setFormError(tRec('create.errors.destination_same'))
        return
      }
    }

    const trimmedEnd = hasEndDate ? endDate.trim() : ''
    const trimmedMax = maxOccurrences.trim()

    const payload = {
      movement_type: type,
      account_id: accountId,
      currency_code: currencyCode,
      amount: parsedAmount,
      description: description.trim() || undefined,
      frequency,
      ...(frequency === 'custom' ? { interval_count: intervalCount, interval_unit: intervalUnit } : {}),
      start_date: startDate,
      ...(trimmedEnd !== '' ? { end_date: trimmedEnd } : {}),
      ...(trimmedMax !== '' ? { max_occurrences: Number(trimmedMax) } : {}),
      ...(type === 'transfer'
        ? { transfer_destination_account_id: destinationAccountId }
        : { category_id: categoryId, subcategory_id: subcategoryId || undefined }),
    }

    startTransition(async () => {
      const result = await createRecurrence(payload)
      if (!result.ok) {
        const formMsg = 'formError' in result ? result.formError : undefined
        setFormError(formMsg ?? tRec('create.errors.create_failed'))
        return
      }
      router.refresh()
      close()
    })
  }

  // ── Account picker list (origin / destination) ──────────────────────────────
  const renderAccountPicker = (
    list: RecurrenceAccount[],
    selectedId: string,
    onPick: (id: string) => void,
  ) => (
    <div className="flex flex-col gap-0.5">
      {list.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onPick(a.id)}
          className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-page"
        >
          <AccountAvatar {...avatarOf(a)} size="sm" />
          <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-text">
            {a.name}
            {a.type === 'credit' && (
              <span
                className="rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-terracotta"
                style={{ backgroundColor: 'var(--terracotta-soft)' }}
              >
                {tTx('drawer.credit_badge')}
              </span>
            )}
          </span>
          {selectedId === a.id && <Check className="ml-auto size-4 shrink-0 text-emerald" aria-hidden />}
        </button>
      ))}
    </div>
  )

  // ── Category picker with one level of subcategory drill ─────────────────────
  const drillCategory = catDrill ? categoryList.find((c) => c.id === catDrill) ?? null : null
  const categoryPickerContent = drillCategory ? (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setCatDrill(null)}
        className="flex items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-left text-sm font-semibold text-text-muted transition-colors hover:bg-page"
      >
        <ChevronLeft className="size-4" aria-hidden />
        <span>{drillCategory.icon ? `${drillCategory.icon} ` : ''}{drillCategory.name}</span>
      </button>
      <button
        type="button"
        onClick={() => pickCategory(drillCategory.id, '')}
        className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-page"
      >
        <span className="flex-1 text-sm font-medium text-text">{tRec('create.placeholders.whole_category')}</span>
        {categoryId === drillCategory.id && !subcategoryId && <Check className="size-4 text-emerald" aria-hidden />}
      </button>
      {drillCategory.subcategories.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => pickCategory(drillCategory.id, s.id)}
          className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-page"
        >
          <span className="flex-1 truncate text-sm text-text">{s.name}</span>
          {subcategoryId === s.id && <Check className="size-4 text-emerald" aria-hidden />}
        </button>
      ))}
    </div>
  ) : (
    <div className="flex flex-col gap-0.5">
      {categoryList.map((c) => {
        const drillable = c.subcategories.length > 0
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => (drillable ? setCatDrill(c.id) : pickCategory(c.id, ''))}
            className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-page"
          >
            <span className="flex-1 truncate text-sm font-medium text-text">
              {c.icon ? `${c.icon} ` : ''}{c.name}
            </span>
            {drillable ? (
              <ChevronRight className="size-4 shrink-0 text-text-soft" aria-hidden />
            ) : (
              categoryId === c.id && <Check className="size-4 shrink-0 text-emerald" aria-hidden />
            )}
          </button>
        )
      })}
    </div>
  )

  const categoryValue = selectedCategory ? (
    <span className="flex items-center gap-1.5">
      <span className="truncate">{selectedCategory.icon ? `${selectedCategory.icon} ` : ''}{selectedCategory.name}</span>
      {subcategoryName && (
        <>
          <span className="text-text-soft">›</span>
          <span className="truncate text-text-muted">{subcategoryName}</span>
        </>
      )}
    </span>
  ) : (
    <span className="text-text-soft">{tRec('create.placeholders.select_category')}</span>
  )

  return (
    <Drawer open={open} onClose={close} ariaLabel={tRec('create.title')}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        {/* Header */}
        <header className="shrink-0 border-b border-border bg-card px-7 pb-4 pt-[22px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-soft">
                {tRec('create.eyebrow')}
              </p>
              <h2 className="truncate text-[25px] font-extrabold leading-tight tracking-[-0.03em] text-text">
                {tRec('create.title')}
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={tCommon('cancel')}
              className="inline-flex size-[38px] shrink-0 items-center justify-center rounded-[11px] border border-border text-text-muted transition-colors hover:bg-border-soft"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
          <div className="flex flex-col gap-5">
            {/* Type pills */}
            <div className="flex gap-2">
              {(['income', 'expense', 'transfer'] as MovementType[]).map((k) => {
                const on = type === k
                const sign = k === 'income' ? '+' : k === 'expense' ? '−' : '↔'
                const onClass =
                  k === 'income'
                    ? 'border-transparent bg-[var(--emerald-soft)] text-emerald-deep'
                    : 'border-transparent bg-navy text-white'
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleTypeChange(k)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border py-2.5 text-sm font-bold transition-colors ${
                      on ? onClass : 'border-border bg-card text-text-muted hover:text-text'
                    }`}
                  >
                    <span className="text-base font-extrabold">{sign}</span>
                    {tTx(`types.${k}`)}
                  </button>
                )
              })}
            </div>

            {/* Amount hero */}
            <div className="rounded-[16px] border border-border bg-card px-5 py-[18px]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
                  {tRec('labels.amount')}
                </span>
                <button
                  type="button"
                  onClick={cycleCurrency}
                  disabled={activeCurrencies.length < 2}
                  className="inline-flex items-center gap-1 rounded-[9px] border border-border px-2.5 py-1 text-xs font-bold text-text disabled:opacity-100"
                  style={{ backgroundColor: FIELD_BG }}
                >
                  {currencyCode}
                  {activeCurrencies.length > 1 && <ChevronDown className="size-3" aria-hidden />}
                </button>
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className={`text-[30px] font-extrabold leading-none ${amountColor}`}>{signChar}</span>
                <span className={`text-[22px] font-bold leading-none opacity-50 ${amountColor}`}>
                  {CURRENCY_SYMBOL[currencyCode]}
                </span>
                <MoneyAmountInput
                  ref={amountRef}
                  id="rec-amount"
                  required
                  value={amount}
                  onChange={setAmount}
                  placeholder="0"
                  className={`w-full min-w-0 bg-transparent text-[30px] font-extrabold leading-none tracking-[-0.02em] tabular-nums outline-none placeholder:text-text-soft/40 ${amountColor}`}
                />
              </div>
            </div>

            {/* Movimiento */}
            <div className="flex flex-col gap-2">
              <span className="px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
                {tRec('create.section_movement')}
              </span>
              <div className="overflow-hidden rounded-[15px] border border-border bg-card [&>*+*]:border-t [&>*+*]:border-[#F1F3F6]">
                {/* Source account */}
                <Popover
                  open={activePopover === 'account'}
                  onOpenChange={(o) => setActivePopover(o ? 'account' : null)}
                  trigger={
                    <FieldRow
                      icon={isCredit ? <CreditCard className="size-[18px]" /> : <Wallet className="size-[18px]" />}
                      label={type === 'income' ? tRec('create.account_to') : tRec('create.account_from')}
                      value={<AccountValue account={selectedAccount} />}
                    />
                  }
                >
                  {renderAccountPicker(eligibleAccounts, accountId, (id) => {
                    handleAccountChange(id)
                    setActivePopover(null)
                  })}
                </Popover>

                {/* Destination (transfer) */}
                {type === 'transfer' && (
                  <Popover
                    open={activePopover === 'destination'}
                    onOpenChange={(o) => setActivePopover(o ? 'destination' : null)}
                    trigger={
                      <FieldRow
                        icon={<ArrowLeftRight className="size-[18px]" />}
                        label={tRec('create.account_toward')}
                        value={<AccountValue account={destinationAccount} />}
                      />
                    }
                  >
                    {renderAccountPicker(transferDestinations, destinationAccountId, (id) => {
                      setDestinationAccountId(id)
                      setActivePopover(null)
                    })}
                  </Popover>
                )}

                {/* Category (income / expense) */}
                {(type === 'income' || type === 'expense') && (
                  <Popover
                    open={activePopover === 'category'}
                    onOpenChange={(o) => {
                      setActivePopover(o ? 'category' : null)
                      if (!o) setCatDrill(null)
                    }}
                    trigger={
                      <FieldRow icon={<Tag className="size-[18px]" />} label={tRec('create.category')} value={categoryValue} />
                    }
                  >
                    {categoryPickerContent}
                  </Popover>
                )}

                {/* Description (inline) */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-text-muted"
                    style={{ backgroundColor: FIELD_BG }}
                  >
                    <FileText className="size-[18px]" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <label htmlFor="rec-description" className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
                      {tRec('labels.description')}
                    </label>
                    <input
                      id="rec-description"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={tRec('create.placeholders.description')}
                      className="w-full bg-transparent text-[15px] font-semibold text-text outline-none placeholder:font-normal placeholder:text-text-soft/60"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Cuándo se repite */}
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
                <Repeat className="size-3.5" aria-hidden />
                {tRec('create.section_when')}
              </span>
              <div className="rounded-[15px] border border-border bg-card p-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-text-soft">
                  {tRec('labels.frequency')}
                </span>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {PRESETS.map((f) => {
                    const on = frequency === f
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFrequency(f)}
                        className={`rounded-[10px] px-3 py-1.5 text-sm font-bold transition-colors ${
                          on ? 'bg-navy text-white' : 'text-text-muted'
                        }`}
                        style={on ? undefined : { backgroundColor: FIELD_BG }}
                      >
                        {tRec(`frequencies.${f}`)}
                      </button>
                    )
                  })}
                </div>

                {frequency === 'custom' && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-text-muted">{tRec('custom_interval.every')}</span>
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={intervalCount}
                      onChange={(e) => setIntervalCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                      aria-label={tRec('custom_interval.every')}
                      className="w-16 rounded-[10px] border border-border bg-card px-2 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <select
                      value={intervalUnit}
                      onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)}
                      aria-label={tRec('labels.frequency')}
                      className="rounded-[10px] border border-border bg-card px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {tRec(`custom_interval.units.${u}`, { count: intervalCount })}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="-mx-4 mt-4 border-t" style={{ borderColor: ROW_DIVIDER }} />

                {/* Start date row */}
                <Popover
                  open={activePopover === 'date'}
                  onOpenChange={(o) => setActivePopover(o ? 'date' : null)}
                  trigger={
                    <button
                      type="button"
                      className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#FBFCFD]"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-text-muted"
                        style={{ backgroundColor: FIELD_BG }}
                      >
                        <Calendar className="size-[18px]" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
                          {tRec('create.start_date')}
                        </span>
                        <span className="truncate text-[15px] font-semibold text-text">{formatDateValue(startDate)}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-text-soft/60" aria-hidden />
                    </button>
                  }
                >
                  <div className="flex w-[252px] flex-col gap-2 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate(todayISO())
                        setActivePopover(null)
                      }}
                      className="flex items-center justify-between rounded-[10px] px-2.5 py-2 text-sm font-semibold text-text transition-colors hover:bg-page"
                    >
                      {tRec('create.today')}
                      {startDate === todayISO() && <Check className="size-4 text-emerald" aria-hidden />}
                    </button>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-[10px] border border-border bg-card px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </Popover>

                {/* End-date toggle row */}
                <div className="-mx-4 flex items-center gap-3 border-t px-4 py-3" style={{ borderColor: ROW_DIVIDER }}>
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-text-muted"
                    style={{ backgroundColor: FIELD_BG }}
                  >
                    <Calendar className="size-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-text">{tRec('create.has_end_date')}</p>
                    {!hasEndDate && <p className="text-xs text-text-muted">{tRec('create.no_end_hint')}</p>}
                  </div>
                  <input
                    type="checkbox"
                    checked={hasEndDate}
                    onChange={(e) => setHasEndDate(e.target.checked)}
                    aria-label={tRec('create.has_end_date')}
                    className="size-4 accent-navy"
                  />
                </div>
                {hasEndDate && (
                  <div className="-mx-4 flex flex-wrap items-end gap-4 px-4 pb-1 pt-3">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="rec-end" className="text-xs text-text-muted">{tRec('create.repeat_until')}</label>
                      <input
                        id="rec-end"
                        type="date"
                        value={endDate}
                        min={startDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-44 rounded-[10px] border border-border bg-card px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="rec-max" className="text-xs text-text-muted">{tRec('create.max_occurrences')}</label>
                      <input
                        id="rec-max"
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={maxOccurrences}
                        onChange={(e) => setMaxOccurrences(e.target.value)}
                        placeholder="—"
                        className="w-28 rounded-[10px] border border-border bg-card px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Credit-card USD note */}
            {isUSDCard && (
              <p className="rounded-[11px] border border-border px-3 py-2 text-xs text-text-muted">
                {tRec('create.credit_fx_note')}
              </p>
            )}

            {/* Preview block (brand emerald) */}
            <div
              className="flex gap-3 rounded-[16px] border px-4 py-4"
              style={{ backgroundColor: 'var(--emerald-soft)', borderColor: 'rgba(16,185,129,0.22)' }}
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-card text-emerald-deep shadow-[0_2px_6px_rgba(16,185,129,0.2)]"
              >
                <Repeat className="size-[18px]" aria-hidden />
              </span>
              <p className="text-[14px] font-medium leading-relaxed text-emerald-deep">
                {tRec('create.preview', {
                  type: tTx(`types.${type}`),
                  frequency: freqLabel.toLowerCase(),
                  date: formatDateValue(startDate),
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="shrink-0 border-t border-border bg-card px-7 py-4">
          {formError && <p className="mb-3 text-sm text-destructive">{formError}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="flex h-[52px] w-full items-center justify-center rounded-[14px] bg-emerald text-[15px] font-bold text-white shadow-[0_10px_26px_-4px_rgba(16,185,129,0.4)] transition-opacity disabled:opacity-50"
          >
            {isPending ? tCommon('saving') : tRec('actions.create')}
          </button>
        </footer>
      </form>
    </Drawer>
  )
}
