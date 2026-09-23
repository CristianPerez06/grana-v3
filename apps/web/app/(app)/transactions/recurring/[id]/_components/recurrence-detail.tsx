'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowLeftRight,
  Banknote,
  Calendar,
  CalendarClock,
  ChevronRight,
  Receipt,
  Repeat,
  Users,
  Tag,
  Wallet,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { recurrenceTitle } from '@grana/recurrences'
import { useShowCents } from '@/lib/preferences-context'
import { getCategoryName, getSubcategoryName } from '@/lib/categories/display'
import { formatShortDate } from '@/lib/date'
import type { RecurrenceDetail as RecurrenceDetailType } from '@/lib/recurrences/types'
import { DetailTopbar } from '../../../_components/detail-topbar'
import { ResolveAheadActions } from '../../_components/resolve-ahead-actions'
import { RecurrenceActions } from './recurrence-actions'
import { RecurrenceEditDrawer } from './recurrence-edit-drawer'

type Props = {
  rule: RecurrenceDetailType
  /** Adónde vuelve el «‹»: al hub, o al movimiento desde el que se abrió. */
  back: { href: string; label: string }
}

// `created_at` is an instant (ISO timestamp), not a bare calendar date: render
// the AR calendar day it fell on so the date doesn't drift across midnight UTC.
//
// MES DE TRES LETRAS, como el resto de la pantalla y como la ficha nativa. El
// mes entero partía «20 de diciembre de 2026» en tres renglones a ancho de
// teléfono y dejaba esas filas el doble de altas que las demás.
const formatTimestamp = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  })

const iconFor = (key: string): ReactNode => {
  switch (key) {
    case 'frequency':
      return <Repeat size={16} strokeWidth={2} />
    case 'account':
    case 'destination':
      return <Wallet size={16} strokeWidth={2} />
    case 'category':
      return <Tag size={16} strokeWidth={2} />
    case 'next_date':
    case 'end_date':
      return <CalendarClock size={16} strokeWidth={2} />
    case 'origin_movement':
      return <Receipt size={16} strokeWidth={2} />
    case 'amount':
      return <Banknote size={16} strokeWidth={2} />
    default:
      return <Calendar size={16} strokeWidth={2} />
  }
}

/**
 * Read-only summary of a recurring rule, in the interaction language of the
 * transaction detail (`/transactions/[txId]`): the amount leads, actions live
 * in the header, and editing happens in a drawer. The generated-instances list
 * renders below this (owned by the page).
 */
export const RecurrenceDetail = ({ rule, back }: Props) => {
  const showCents = useShowCents()
  const t = useTranslations('recurrences')
  const tTx = useTranslations('transactions')
  const tRoot = useTranslations()
  const [editOpen, setEditOpen] = useState(false)

  const fmt = (amount: number) =>
    rule.currency_code === 'ARS'
      ? formatARS(amount, showCents)
      : formatUSD(amount, showCents)

  const { movement_type: type } = rule
  const sign = type === 'income' ? '+' : type === 'transfer' ? '' : '−'
  const amountClass =
    type === 'income' ? 'text-emerald-deep' : type === 'transfer' ? 'text-navy' : 'text-terracotta'

  const typeLabel =
    type === 'income' || type === 'expense' || type === 'transfer'
      ? tTx(`types.${type}`)
      : type

  // No narrowing: `frequency` is `RecurrenceFrequencyLabel`, which is exactly
  // the five keys under `frequencies.*`. The guard that used to stand here
  // listed four of them and printed the raw column value for the fifth, so a
  // custom rule read `custom` on this card while the list and the edit drawer
  // both said "Personalizado" (issue #141). It was written when the row's type
  // claimed `frequency` could be any string; #121 fixed the type, and the guard
  // outlived the reason for it.
  const frequencyLabel = t(`frequencies.${rule.frequency}`)

  // The same name the hub and the review block give this rule. It used to read
  // `rule.category?.name` raw, so a system category showed its stored name
  // instead of the translated one — the same rule under two spellings.
  const heroDesc =
    recurrenceTitle({
      description: rule.description,
      subcategory: rule.subcategory ? getSubcategoryName(rule.subcategory, tRoot) : null,
      category: rule.category ? getCategoryName(rule.category, tRoot) : null,
      type: typeLabel,
    }) ?? typeLabel

  type Row = { key: string; label: string; value: string; href?: string }
  const rows: Row[] = [{ key: 'frequency', label: t('labels.frequency'), value: frequencyLabel }]

  if (type === 'transfer') {
    rows.push(
      { key: 'account', label: t('labels.account'), value: rule.account?.name ?? '—' },
      {
        key: 'destination',
        label: t('labels.destination'),
        value: rule.destination_account?.name ?? '—',
      },
    )
  } else {
    rows.push({ key: 'account', label: t('labels.account'), value: rule.account?.name ?? '—' })
    if (rule.category) {
      rows.push({
        key: 'category',
        label: t('labels.category'),
        value: getCategoryName(rule.category, tRoot),
      })
    }
    // Shown because it NAMES the rule: with no description the title is the
    // subcategoría, and a ficha that listed only the categoría left the name on
    // screen with no visible source.
    if (rule.subcategory) {
      rows.push({
        key: 'subcategory',
        label: t('labels.subcategory'),
        value: getSubcategoryName(rule.subcategory, tRoot),
      })
    }
  }

  if (rule.next_occurrence) {
    rows.push({
      key: 'next_date',
      label: t('labels.next_date'),
      value: formatShortDate(rule.next_occurrence),
    })
  }
  if (rule.end_date) {
    rows.push({
      key: 'end_date',
      label: t('labels.end_date'),
      value: formatShortDate(rule.end_date),
    })
  }

  // WHERE THE RULE IS IN ITS PLAN. A limit decides when a rule stops reminding,
  // and until now it was invisible on every screen that showed the rule: a plan
  // of eleven cuotas recorded as one read «mensual, sin fecha de fin» — it
  // claimed to repeat forever while it had already stopped (#142).
  //
  // Counted in POSITIONS of the calendar, which is what `max_occurrences` caps,
  // and never in rows of `recurrence_instances`: a rule seeded by a movement has
  // no row for its first occurrence.
  const { progress } = rule.lifecycle
  // Null for an active rule: there is nothing to announce about one that is
  // simply running.
  const stateLabel =
    rule.lifecycle.state === 'active'
      ? null
      : rule.lifecycle.state === 'finished-with-pending'
        ? t('limit.finished_with_pending', { count: rule.lifecycle.unresolved })
        : t(`statuses.${rule.lifecycle.state === 'finished' ? 'finished' : rule.status}`)
  // A rule with NEITHER condition says so. It used to say nothing, which reads
  // the same as a rule whose limit is simply not shown — and that is exactly how
  // a plan with a limit of 1 passed for indefinite.
  if (progress == null && !rule.end_date) {
    rows.push({ key: 'no_limit', label: t('limit.end_label'), value: t('limit.no_limit') })
  }
  if (progress != null) {
    rows.push({
      key: 'progress',
      label: t('limit.progress_label'),
      value: t('limit.progress', { spent: progress.spent, total: progress.total }),
    })
    if (progress.remaining > 0) {
      rows.push({
        key: 'remaining',
        label: t('limit.remaining_label'),
        value: t('limit.remaining', { remaining: progress.remaining }),
      })
    }

    // The last occurrence, walked rather than stored — pausing the rule or
    // correcting its day moves it. A paused rule gets a sentence instead of a
    // date: while the pause is open the final date depends on a day that has not
    // happened, and an estimate shown as a fact is the thing this avoids.
    const last = rule.last_expected_occurrence
    if (last.kind === 'date') {
      rows.push({
        key: 'last_expected',
        label: t('limit.last_expected'),
        value: formatShortDate(last.date),
      })
    } else if (last.kind === 'unknown-while-paused') {
      rows.push({
        key: 'last_expected',
        label: t('limit.last_expected'),
        value: t('limit.last_expected_paused'),
      })
    }
  }

  // Provenance: when the rule was created, and — if it was born from a movement —
  // a link back to that movement. `created_from_transaction_id` is null for rules
  // created directly, so the origin row only appears when there's a movement.
  rows.push({
    key: 'created_at',
    label: t('labels.created_at'),
    value: formatTimestamp(rule.created_at),
  })
  if (rule.created_from_transaction_id) {
    rows.push({
      key: 'origin_movement',
      label: t('labels.origin_movement'),
      value: '',
      href: `/transactions/${rule.created_from_transaction_id}`,
    })
  }

  return (
    <div>
      {/* Volver y acciones en UNA fila, como en la ficha de un movimiento. Fuera
          del contenedor con `gap-4`: el topbar trae su propio margen inferior,
          y sumarle el gap devolvía el hueco que esto saca. */}
      <DetailTopbar
        backHref={back.href}
        backLabel={back.label}
        actions={<RecurrenceActions rule={rule} onEdit={() => setEditOpen(true)} />}
      />

    <div className="flex flex-col gap-4">
      {/* Hero: amount leads, with the rule's narrative and type/frequency below */}
      <div className="flex flex-col items-center gap-2 px-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-[11px] font-semibold text-text-muted">
            {type === 'transfer' ? (
              <ArrowLeftRight size={13} aria-hidden />
            ) : (
              <Repeat size={13} aria-hidden />
            )}
            {frequencyLabel}
          </span>
          {/* QUE LA REGLA ES COMPARTIDA, dicho donde se lee. El dato ya estaba
              en la ficha —lo usa para decidir si vincular pide confirmación—
              pero no se mostraba: la única forma de enterarse era abrir la
              edición o intentar vincular algo. Y una regla compartida le genera
              deuda a otra persona cada vez que se confirma un vencimiento, así
              que no es un detalle de configuración. Mismo chip que el feed de
              vencimientos y que la fila de un movimiento compartido. */}
          {rule.household_id != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-soft px-2.5 py-1 text-[11px] font-semibold text-slate">
              <Users size={13} aria-hidden />
              {tTx('list.shared_short')}
            </span>
          )}
          {/* THE DERIVED STATE, not the column. `status` says what the user did
              to the rule — and a rule that spent its limit still says `active`,
              so this chip showed nothing while the list grouped the same rule
              under Finalizada. Two screens, two answers, which is the thing this
              change exists to remove. */}
          {stateLabel != null && (
            <span className="inline-flex items-center rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning-deep">
              {stateLabel}
            </span>
          )}
        </div>
        <span className={`text-[24px] font-bold tabular-nums tracking-tight sm:text-[32px] ${amountClass}`}>
          {sign}
          {fmt(rule.amount)}
        </span>
        <span className="text-sm text-text-muted">{heroDesc}</span>
      </div>

      {/* Detail rows */}
      <div className="flex flex-col overflow-hidden rounded-[15px] border border-border bg-card">
        {rows.map((row) => {
          const label = (
            <span className="flex shrink items-center gap-2 text-sm text-text-muted">
              {iconFor(row.key)}
              {row.label}
            </span>
          )
          const rowClass =
            'flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0'

          if (row.href) {
            return (
              <Link key={row.key} href={row.href} className={`${rowClass} transition-colors hover:bg-page`}>
                {label}
                <ChevronRight className="size-4 shrink-0 text-text-soft/50" aria-hidden />
              </Link>
            )
          }

          return (
            <div key={row.key} className={rowClass}>
              {label}
              <span className="min-w-0 flex-1 text-right text-sm font-semibold text-text">{row.value}</span>
            </div>
          )
        })}
      </div>

      {/* THE TWO WAYS OUT FOR A DUE DATE THAT HAS NOT ARRIVED — the hub's twin,
          on the rule's own page. Without it, someone who pays the rent on the
          3rd has to go back to the hub or wait for the 23rd, and this is the
          screen that names that date. Same commit as the native detail. */}
      {rule.next_occurrence && rule.status === 'active' && (
        <ResolveAheadActions
          recurrenceId={rule.id}
          dueDate={rule.next_occurrence}
          ruleAmount={Number(rule.amount)}
          ruleCurrency={rule.currency_code}
          movementType={rule.movement_type as 'expense' | 'income' | 'transfer'}
          ruleAccountId={rule.account?.id ?? null}
          transferDestinationAccountId={rule.transfer_destination_account_id ?? null}
          shared={rule.household_id != null}
        />
      )}

      <RecurrenceEditDrawer rule={rule} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
    </div>
  )
}
