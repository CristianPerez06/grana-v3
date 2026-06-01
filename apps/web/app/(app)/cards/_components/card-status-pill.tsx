import { useTranslations } from 'next-intl'

/**
 * Statement status as shown on the wallet card and the detail header.
 * Maps to the handoff pill tokens:
 *  - `due`  → terracota (a pagar / urgente): closed or overdue, unpaid, with debt.
 *  - `soon` → amber (cierra pronto): due within ~7 days.
 *  - `ok`   → emerald (al día): everything else.
 */
export type CardPillTone = 'due' | 'soon' | 'ok'

const TONE_CLASS: Record<CardPillTone, string> = {
  due: 'bg-terracotta-soft text-terracotta',
  soon: 'bg-warning-soft text-warning-deep',
  ok: 'bg-emerald-soft text-emerald-deep',
}

const DOT_CLASS: Record<CardPillTone, string> = {
  due: 'bg-terracotta',
  soon: 'bg-warning',
  ok: 'bg-emerald',
}

type Props = {
  tone: CardPillTone
  className?: string
}

export const CardStatusPill = ({ tone, className = '' }: Props) => {
  const t = useTranslations('cards')
  const label = t(`pill.${tone}`)

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[tone]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]}`} aria-hidden />
      {label}
    </span>
  )
}
