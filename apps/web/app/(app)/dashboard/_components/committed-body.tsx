'use client'

import { useEffect, useRef, useState } from 'react'
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
  /** Summary-state subtitle: how many items make the total up. */
  sub: string
  ars: number
  usd: number
  rows: { id: string; label: string; amount: number }[]
  emptyMessage: string
  link?: { href: string; label: string }
}

type Props = {
  /** The total block: rendered on the front face, above the group rows. */
  summary: React.ReactNode
  groups: CommittedDetailGroup[]
}

/**
 * The body of "Compromisos": two faces in ONE box that never changes size.
 *
 * ── Why an overlay and not a panel ──────────────────────────────────────────
 * Row 2's two cards share a height and "Cuánto gastaste" has no content to fill
 * extra space with, so every pixel this card grows shows up as a hole in its
 * neighbour. A disclosure that unfolds below is therefore off the table.
 *
 * A scroll container is NOT enough either, and that was the first attempt: a
 * `flex-1` panel with `overflow-y-auto` scrolls, but its INTRINSIC size is still
 * its content, and the grid row sizes on max-content — so the row grew anyway
 * and the list scrolled inside an already-taller card. The box has to be
 * measured off something that cannot change.
 *
 * So the front face stays in flow and keeps the box; the back face is absolutely
 * positioned over it. An absolute element contributes nothing to its parent's
 * size, so opening a detail is provably zero pixels — not "small", zero. It is
 * the same trick the tiles of "Cuánto gastaste" use to flip without resizing.
 *
 * Swapping the WHOLE body (total block included) rather than just the group rows
 * is what makes the back face usable: it inherits the total block's height too,
 * so a list of ten fixed expenses gets real room instead of two visible rows.
 *
 * `invisible` (visibility: hidden) is what hides the front face: it keeps the
 * box, drops the subtree from the accessibility tree, and takes its buttons out
 * of the tab order — three things `opacity-0` would not do.
 *
 * Accessibility: this is not a disclosure, so there is no `aria-expanded` — the
 * control swaps a region's content rather than revealing an adjacent panel.
 * Focus moves to the back control on open and returns to the group's control on
 * close; without that, a keyboard user activates a button that disappears and
 * drops focus to `<body>`.
 */
export const CommittedBody = ({ summary, groups }: Props) => {
  const t = useTranslations('dashboard.committed')
  const [openKey, setOpenKey] = useState<string | null>(null)
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

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Front face — stays in flow, so it is what the box measures. */}
      <div className={cn('flex flex-1 flex-col gap-3', open !== null && 'invisible')}>
        {summary}
        <div className="flex min-h-[130px] flex-1 flex-col gap-2.5">
          {groups.map((group) => (
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
          ))}
        </div>
      </div>

      {/* Back face — absolutely positioned: it cannot resize the box. */}
      {open !== null && (
        <div
          role="group"
          aria-label={open.label}
          className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
        >
          <button
            type="button"
            ref={backRef}
            onClick={() => {
              pendingFocus.current = openKey
              setOpenKey(null)
            }}
            className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border-soft px-3.5 py-2.5 text-left transition-colors hover:bg-border-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <ChevronLeft aria-hidden size={16} className="shrink-0 text-text-soft" />
            {/* The chevron alone does not say what the control does, and the
                label names the group, not the action. */}
            <span className="sr-only">{t('back')}</span>
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-text">
              {open.label}
            </span>
            <span className="shrink-0 text-[15px] font-extrabold tracking-tight text-text">
              <MaskedAmount amount={open.ars} currency="ARS" />
            </span>
          </button>

          {/* Only this list scrolls — never the card, never the row. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3.5">
            {open.rows.length === 0 ? (
              <p className="py-3 text-[12.5px] font-semibold text-text-soft">{open.emptyMessage}</p>
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
              className="shrink-0 rounded px-3.5 py-2.5 text-[12.5px] font-bold text-emerald-deep transition-colors hover:text-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {open.link.label} ›
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
