'use client'

import { useId } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MaskedAmount } from './masked-amount'

export type TileTone = 'spent' | 'paid' | 'pending'

export const TILE_TONE: Record<TileTone, { icon: string; amount: string; rule: string }> = {
  spent: { icon: 'bg-emerald-bg text-emerald-deep', amount: 'text-emerald-deep', rule: 'bg-emerald' },
  paid: { icon: 'bg-slate-soft text-slate', amount: 'text-slate', rule: 'bg-slate' },
  pending: {
    icon: 'bg-warning-soft text-warning-deep',
    amount: 'text-terracotta',
    rule: 'bg-terracotta',
  },
}

export type BreakdownRow = { label: string; amount: number }

type Props = {
  tone: TileTone
  icon: React.ReactNode
  label: string
  ars: number
  usd: number
  showUsd: boolean
  /** Two-line caption shown when the tile does not flip. */
  caption?: { lead: string; emphasis: string }
  /** When present the tile flips and shows these on the back. */
  breakdown?: { title: string; rows: BreakdownRow[]; openLabel: string; backLabel: string }
  flipped: boolean
  onToggle: () => void
}

const Face = ({
  hidden,
  className,
  children,
  back,
}: {
  hidden: boolean
  className?: string
  children: React.ReactNode
  back?: boolean
}) => (
  <div
    // `backface-visibility` hides a face VISUALLY but leaves it in the
    // accessibility tree, so a screen reader would read both sides at once.
    // `aria-hidden` is what actually takes the hidden face out.
    aria-hidden={hidden}
    className={cn(
      'absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-border bg-card [backface-visibility:hidden]',
      className,
    )}
    style={{
      // The opacity flips at mid-turn: some engines paint both faces without it.
      transition: 'opacity 0s .25s',
      opacity: hidden ? 0 : 1,
      transform: back ? 'rotateY(180deg)' : undefined,
    }}
  >
    {children}
  </div>
)

/**
 * One tile of "Cuánto gastaste".
 *
 * Two variants share the same box and the same height, and only the bottom slot
 * differs: a **caption** when the amount needs no opening, or a **flip** to a
 * back face when it does. That slot is the same one in both, so the card keeps
 * its shape whether or not the user has Compartido.
 *
 * The captions are not decoration and they are not interchangeable: "Ya salió de
 * tus cuentas" and "Se paga en los próximos resúmenes" are TRUE exactly when
 * there is no shared activity — which is the variant that shows them. With a
 * partner involved the money may have left someone else's account, or be owed to
 * them, and that is the variant that flips instead.
 *
 * The 3D container is a `div` with `role="button"`, NOT a `<button>`: a button
 * flattens the 3D context and the back face renders mirrored.
 */
export const SpentTile = ({
  tone,
  icon,
  label,
  ars,
  usd,
  showUsd,
  caption,
  breakdown,
  flipped,
  onToggle,
}: Props) => {
  const panelId = useId()
  const flippable = breakdown != null

  const front = (
    <>
      <div className="flex flex-col items-center px-3 pt-3.5 text-center">
        <span
          aria-hidden
          className={cn('flex size-9 items-center justify-center rounded-xl', TILE_TONE[tone].icon)}
        >
          {icon}
        </span>
        <span className="mt-2.5 text-[12.5px] font-extrabold leading-tight text-text-muted">
          {label}
        </span>
        <span
          className={cn('mt-2 text-[19px] font-extrabold tracking-[-0.04em]', TILE_TONE[tone].amount)}
        >
          <MaskedAmount amount={ars} currency="ARS" />
        </span>
        {showUsd && (
          <span className="mt-[3px] text-[10.5px] font-semibold text-text-soft">
            <MaskedAmount amount={usd} currency="USD" showCentsOverride />
          </span>
        )}

        {flippable ? (
          <span className="mt-2.5 inline-flex items-center gap-1 text-[10.5px] font-extrabold text-text-soft">
            {breakdown.openLabel}
            <ChevronRight size={11} strokeWidth={2.6} aria-hidden />
          </span>
        ) : (
          caption && (
            <span className="mt-3 text-[11px] font-bold leading-snug text-text-soft">
              {caption.lead}
              <br />
              <span className="text-[11.5px] font-extrabold text-text">{caption.emphasis}</span>
            </span>
          )
        )}
      </div>
      <span aria-hidden className={cn('mt-auto h-1 w-full', TILE_TONE[tone].rule)} />
    </>
  )

  return (
    <div className="relative h-[172px] [perspective:1000px]">
      <div
        role={flippable ? 'button' : undefined}
        tabIndex={flippable ? 0 : undefined}
        aria-expanded={flippable ? flipped : undefined}
        aria-controls={flippable ? panelId : undefined}
        onClick={flippable ? onToggle : undefined}
        onKeyDown={
          flippable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onToggle()
                }
              }
            : undefined
        }
        className={cn(
          'absolute inset-0 rounded-2xl transition-transform duration-500 ease-[cubic-bezier(.4,.1,.2,1)] [transform-style:preserve-3d] motion-reduce:transition-none',
          flippable &&
            'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        style={{ transform: flipped ? 'rotateY(180deg)' : undefined }}
      >
        <Face hidden={flipped}>{front}</Face>

        {flippable && (
          <Face back hidden={!flipped} className="items-stretch text-left">
            <div id={panelId} className="flex flex-1 flex-col px-3.5 pt-3">
              <span className="flex items-center gap-[7px] text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-text-soft">
                <span aria-hidden className={cn('size-2 rounded-[2px]', TILE_TONE[tone].rule)} />
                {breakdown.title}
              </span>
              <span className="mt-2.5 flex flex-col gap-2.5">
                {breakdown.rows.map((row) => (
                  <span key={row.label} className="block text-[10.5px] font-bold leading-snug text-text-soft">
                    {row.label}
                    <span className="mt-[3px] block text-[13px] font-extrabold tracking-[-0.02em] text-text">
                      <MaskedAmount amount={row.amount} currency="ARS" />
                    </span>
                  </span>
                ))}
              </span>
              <span className="mb-2.5 mt-auto inline-flex items-center gap-1 text-[10.5px] font-extrabold text-text-soft">
                <ChevronLeft size={11} strokeWidth={2.6} aria-hidden />
                {breakdown.backLabel}
              </span>
            </div>
            <span aria-hidden className={cn('h-1 w-full', TILE_TONE[tone].rule)} />
          </Face>
        )}
      </div>
    </div>
  )
}
