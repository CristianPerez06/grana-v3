'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { CommittedRow } from './committed-row'
import { MaskedAmount } from './masked-amount'

export type CommittedDetailGroup = {
  key: string
  icon: React.ReactNode
  iconClassName: string
  label: string
  /** Closed-state subtitle: how many items make the total up. */
  sub: string
  ars: number
  usd: number
  rows: Array<{ id: string; label: string; amount: number }>
  emptyMessage: string
  link?: { href: string; label: string }
}

type Props = {
  groups: CommittedDetailGroup[]
}

/**
 * The detail zone of "Compromisos": a FIXED-HEIGHT region with two states that
 * occupy the same space — the two group summaries, or one group's list.
 *
 * The detail REPLACES the summary instead of unfolding below it, and that is
 * about the row, not about this card. The two cards of row 2 share a height, so
 * everything that grows here comes out as white space in "Cuánto gastaste" — a
 * disclosure added ~280px in one go and the hole landed in the middle of the
 * neighbouring card. Here the zone takes the leftover height (`flex-1`) and its
 * content scrolls inside it, so opening a detail costs exactly zero pixels.
 *
 * It is also the gesture the neighbouring card already uses: its tiles flip
 * without resizing. Two cards side by side now behave the same way.
 *
 * Accessibility: this is NOT a disclosure, so there is no `aria-expanded` —
 * the control swaps the content of a region rather than revealing an adjacent
 * panel. Focus moves to the back control on open and returns to the group's
 * control on close; without that, a keyboard user activates a button that
 * disappears and drops focus to `<body>`.
 */
export const CommittedDetail = ({ groups }: Props) => {
  const t = useTranslations('dashboard.committed')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const zoneId = useId()
  const backRef = useRef<HTMLButtonElement>(null)
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  // Which control to focus after the swap. `null` means "leave focus alone" —
  // the first render must not steal it.
  const pendingFocus = useRef<'back' | string | null>(null)

  useEffect(() => {
    const target = pendingFocus.current
    if (target === null) return
    pendingFocus.current = null
    if (target === 'back') backRef.current?.focus()
    else triggerRefs.current[target]?.focus()
  }, [openKey])

  const open = groups.find((g) => g.key === openKey) ?? null

  const close = () => {
    pendingFocus.current = openKey
    setOpenKey(null)
  }

  // `flex-1` makes the zone take the card's leftover height, and `min-h` is just
  // the summary's own size — so the zone measures the SAME in both states and
  // swapping costs zero pixels. The row height ends up driven by "Cuánto
  // gastaste", which is the card that has content to fill it.
  return (
    <div
      id={zoneId}
      role="group"
      aria-label={t('detail_region')}
      className="flex min-h-[136px] flex-1 flex-col gap-2.5"
    >
      {open === null
        ? groups.map((group) => (
            <button
              key={group.key}
              type="button"
              ref={(node) => {
                triggerRefs.current[group.key] = node
              }}
              onClick={() => {
                pendingFocus.current = 'back'
                setOpenKey(group.key)
              }}
              className="flex min-h-11 flex-1 items-center gap-3 rounded-2xl border border-border px-3.5 py-3 text-left transition-colors hover:bg-border-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-xl',
                  group.iconClassName,
                )}
              >
                {group.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-extrabold text-text">{group.label}</span>
                <span className="block truncate text-[11.5px] font-semibold text-text-soft">
                  {group.sub}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[16.5px] font-extrabold tracking-tight text-text">
                  <MaskedAmount amount={group.ars} currency="ARS" />
                </span>
                {group.usd !== 0 && (
                  <span className="block text-[11px] font-semibold text-text-soft">
                    <MaskedAmount amount={group.usd} currency="USD" showCentsOverride />
                  </span>
                )}
              </span>
              <ChevronRight aria-hidden size={16} className="shrink-0 text-text-soft" />
            </button>
          ))
        : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border">
              <button
                type="button"
                ref={backRef}
                onClick={close}
                className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border-soft px-3.5 py-2.5 text-left transition-colors hover:bg-border-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <ChevronLeft aria-hidden size={16} className="shrink-0 text-text-soft" />
                {/* The chevron alone does not say what the control does; the
                    label names the group, not the action. */}
                <span className="sr-only">{t('back')}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-text">
                  {open.label}
                </span>
                <span className="shrink-0 text-[13.5px] font-extrabold tracking-tight text-text">
                  <MaskedAmount amount={open.ars} currency="ARS" />
                </span>
              </button>

              {/* Only this list scrolls — never the card, never the row. */}
              <div className="min-h-0 flex-1 overflow-y-auto px-3.5">
                {open.rows.length === 0 ? (
                  <p className="py-3 text-[12.5px] font-semibold text-text-soft">
                    {open.emptyMessage}
                  </p>
                ) : (
                  open.rows.map((row, index) => (
                    <CommittedRow
                      key={row.id}
                      label={row.label}
                      amount={row.amount}
                      currency="ARS"
                      first={index === 0}
                    />
                  ))
                )}
              </div>

              {open.link && (
                <Link
                  href={open.link.href}
                  className="shrink-0 rounded px-3.5 py-2 text-[12.5px] font-bold text-emerald-deep transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  {open.link.label} ›
                </Link>
              )}
            </div>
          )}
    </div>
  )
}
