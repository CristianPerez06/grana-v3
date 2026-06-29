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
 * exception to `PageHeader`, like CardHero / AccountDetailHeader. The actions
 * (edit/archive icons) sit pinned to the top-right on every width; the identity
 * column shrinks (`min-w-0`) so a long card name truncates instead of pushing
 * them out of place.
 */
export const CardDetailHeader = ({ name, bank, accent, tone, actions }: Props) => (
  <div className="flex items-start gap-3 md:gap-4">
    <div className="flex min-w-0 flex-1 items-start gap-4 md:items-center">
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
        {bank && <p className="mt-1 break-words text-sm text-text-muted md:truncate">{bank}</p>}
      </div>
    </div>
    {actions && (
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    )}
  </div>
)
