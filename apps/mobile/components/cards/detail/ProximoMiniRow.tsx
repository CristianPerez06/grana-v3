import { Pressable, Text } from 'react-native'
import { ChevronRight } from 'lucide-react-native'
import { formatARS } from '@grana/i18n-messages'
import type { LifecyclePeriod } from '@grana/cards'
import { formatDayMonth } from '@grana/cards'
import { useT } from '../../../lib/locale-context'
import { detailColors } from './format'

type Props = {
  period: LifecyclePeriod
  selected: boolean
  accent: string
  showCents?: boolean
  onSelect: () => void
}

/** Dashed mini-row for the "próximo" statement (already committed in installments). */
export const ProximoMiniRow = ({ period, selected, accent, showCents = false, onSelect }: Props) => {
  const t = useT()
  const isZero = period.pendingAmountARS === 0 && period.pendingAmountUSD === 0
  const note = isZero ? t('cards.detail.prox_note_empty') : t('cards.detail.prox_note_installments')

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-4 py-3"
      style={selected ? { borderStyle: 'solid', borderColor: accent } : undefined}
    >
      <Text className="text-[11px] font-extrabold uppercase tracking-wider text-text-soft">
        {t('cards.detail.prox_label')}
      </Text>
      <Text numberOfLines={1} className="flex-1 text-sm text-text-muted">
        {t('cards.detail.prox_info', {
          date: `${period.is_estimated ? '~' : ''}${formatDayMonth(period.end_date)}`,
          note,
        })}
      </Text>
      <Text className={`text-sm font-bold ${isZero ? 'text-text-soft' : 'text-text'}`}>
        {formatARS(period.pendingAmountARS, showCents)}
      </Text>
      <ChevronRight size={18} color={detailColors.textSoft} />
    </Pressable>
  )
}
