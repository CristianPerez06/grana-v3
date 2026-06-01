import { cardMonogram } from './card-presentation'
import { CardStatusPill } from './card-status-pill'
import type { CardPillTone } from './card-status-pill'

type Props = {
  name: string
  bank: string | null
  accent: string
  tone: CardPillTone
}

/**
 * Compound detail header (avatar + name + status pill + bank). A permitted
 * exception to `PageHeader`, like CardHero / AccountDetailHeader.
 */
export const CardDetailHeader = ({ name, bank, accent, tone }: Props) => (
  <div className="flex items-center gap-4">
    <span
      className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[15px] text-2xl font-extrabold text-white"
      style={{ backgroundColor: accent }}
      aria-hidden
    >
      {cardMonogram(name)}
    </span>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-3">
        <h1 className="truncate text-2xl font-extrabold tracking-tight">{name}</h1>
        <CardStatusPill tone={tone} />
      </div>
      {bank && <p className="truncate text-sm text-text-muted">{bank}</p>}
    </div>
  </div>
)
