'use client'

import { useId } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type AmountDensity } from '@grana/dashboard'
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

/**
 * Headline size per density step. The tile is a third of a card wide and has to
 * hold up to ten digits plus cents; clipping a money amount is the worst failure
 * this card could have, because a cut "$ 1.020.283,17" reads as another number.
 */
const AMOUNT_SIZE: Record<AmountDensity, string> = {
  normal: 'text-[19px]',
  tight: 'text-[17px]',
  tighter: 'text-[15px]',
  tightest: 'text-[13px]',
}

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
  /**
   * Type step for the amount, decided ONCE for the three tiles by the card, not
   * per tile: three peer amounts that shrink at different points stop lining up,
   * and the headline ends up rendering smaller than the figure derived from it.
   */
  density: AmountDensity
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
 * The two variants share the same box and the same height as each other — the
 * tile never resizes when it turns — and only the bottom slot differs: a **caption** when the amount needs no opening, or a **flip** to a
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
  density,
}: Props) => {
  const panelId = useId()
  const flippable = breakdown != null

  const front = (
    <>
      <div className="flex flex-1 flex-col items-center justify-center px-3 py-3.5 text-center">
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
          className={cn(
            'mt-2 whitespace-nowrap font-extrabold tracking-[-0.04em]',
            AMOUNT_SIZE[density],
            TILE_TONE[tone].amount,
          )}
        >
          <MaskedAmount amount={ars} currency="ARS" />
        </span>
        {showUsd && (
          <span className="mt-[3px] text-[10.5px] font-semibold text-text-soft">
            <MaskedAmount amount={usd} currency="USD" showCentsOverride />
          </span>
        )}

        {/* ONE slot with ONE height, whatever goes in it. The caption is two
            lines and the flip invitation is one, and since the content is
            vertically centred, letting the slot size itself dropped the flipping
            tiles ~8px below their neighbour and the row stopped reading as a
            row. `justify-start` so both variants hang from the same line. */}
        <span className="mt-3 flex min-h-[32px] flex-col items-center justify-start">
          {flippable ? (
            <span className="inline-flex items-center gap-1 text-[10.5px] font-extrabold text-text-soft">
              {breakdown.openLabel}
              <ChevronRight size={11} strokeWidth={2.6} aria-hidden />
            </span>
          ) : (
            caption && (
              <span className="text-[11px] font-bold leading-snug text-text-soft">
                {caption.lead}
                <br />
                <span className="text-[11.5px] font-extrabold text-text">{caption.emphasis}</span>
              </span>
            )
          )}
        </span>
      </div>
      <span aria-hidden className={cn('h-1 w-full', TILE_TONE[tone].rule)} />
    </>
  )

  return (
    // `h-full` + `min-h`, not a fixed height: the tiles are what absorbs the
    // card's leftover height. Row 2's two cards share a height, and this card
    // used to be rigid (fixed tiles + a pace strip pinned with `mt-auto`), so any
    // height the row gave it beyond its content pooled into a hole in the middle.
    // Elastic tiles turn that leftover into breathing room inside the tile. The
    // growth is bounded because the neighbouring card no longer changes size.
    <div className="relative h-full min-h-[184px] [perspective:1000px]">
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
            <div id={panelId} className="flex flex-1 flex-col px-3.5 py-3">
              {/* Centered like the front face, so a taller tile grows evenly on
                  both faces instead of pooling above the back link. */}
              <span className="flex flex-1 flex-col justify-center">
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
              </span>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[10.5px] font-extrabold text-text-soft">
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
