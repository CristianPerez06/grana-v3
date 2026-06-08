import type { ReactNode } from 'react'
import { cardMonogram } from './card-presentation'
import { CardStatusPill } from './card-status-pill'
import type { CardPillTone } from './card-status-pill'

type Props = {
  name: string
  bank: string | null
  accent: string
  tone: CardPillTone
  /** Right-side actions (e.g. register purchase + edit icon). */
  actions?: ReactNode
}

/**
 * Compound detail header (avatar + name + status pill + bank). A permitted
 * exception to `PageHeader`, like CardHero / AccountDetailHeader. On narrow
 * widths the title/pill stack and the actions row moves below the identity so
 * a long card name never squeezes the pill or the buttons.
 */
export const CardDetailHeader = ({ name, bank, accent, tone, actions }: Props) => (
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
    <div className="flex items-start gap-4 md:flex-1 md:items-center">
      <span
        className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[15px] text-2xl font-extrabold text-white"
        style={{ backgroundColor: accent }}
        aria-hidden
      >
        {cardMonogram(name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col items-start gap-1.5 md:flex-row md:items-center md:gap-3">
          <h1 className="break-words text-2xl font-extrabold tracking-tight md:truncate">{name}</h1>
          <CardStatusPill tone={tone} />
        </div>
        {bank && <p className="mt-1 break-words text-sm text-text-muted md:mt-1 md:truncate">{bank}</p>}
      </div>
    </div>
    {actions && (
      <div className="flex items-center gap-2 pl-[70px] md:shrink-0 md:pl-0">
        {actions}
      </div>
    )}
  </div>
)
