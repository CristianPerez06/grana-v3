import type { CardTone } from '@grana/cards'
import { PageHeader } from '../../ui/PageHeader'
import { CardStatusPill } from './CardStatusPill'
import { useT } from '../../../lib/locale-context'

type Props = {
  /** Card name; `null` while the detail is still loading (placeholder shown). */
  name: string | null
  bank: string | null
  /** Status pill tone; `null` while loading or on not-found (no pill). */
  tone: CardTone | null
}

/**
 * Native detail header. Unlike web (a compound avatar header that's a permitted
 * `PageHeader` exception), mobile keeps the mandated navy `PageHeader` chrome —
 * always visible from first paint with the back-link — carrying the card name as
 * title, the bank as subtitle, and the status pill in the actions slot. Read-only
 * v1: no edit affordance.
 */
export const CardDetailHeader = ({ name, bank, tone }: Props) => {
  const t = useT()
  return (
    <PageHeader
      title={name ?? '…'}
      description={bank ?? undefined}
      backLink={{ href: '/(app)/cards', label: t('cards.title') }}
      actions={tone ? <CardStatusPill tone={tone} /> : undefined}
    />
  )
}
