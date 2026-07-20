import { Pressable, Text, View } from 'react-native'
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
  /**
   * Edit affordance. Present ⇒ an "Editar" action renders in the header; it's
   * disabled until the card has loaded (chrome visible from first paint, per the
   * header rule). Absent ⇒ no edit affordance (not-found / loading).
   */
  onEdit?: () => void
}

/**
 * Native detail header. Unlike web (a compound avatar header that's a permitted
 * `PageHeader` exception), mobile keeps the mandated navy `PageHeader` chrome —
 * always visible from first paint with the back-link — carrying the card name as
 * title, the bank as subtitle, and the status pill + Editar action in the actions
 * slot.
 */
export const CardDetailHeader = ({ name, bank, tone, onEdit }: Props) => {
  const t = useT()
  const actions =
    tone || onEdit ? (
      <View className="flex-row items-center gap-3">
        {tone && <CardStatusPill tone={tone} />}
        {onEdit && (
          <Pressable
            onPress={onEdit}
            disabled={!name}
            hitSlop={8}
            accessibilityRole="button"
            className={!name ? 'opacity-40' : undefined}
          >
            <Text className="text-sm font-semibold text-white">{t('cards.actions.edit')}</Text>
          </Pressable>
        )}
      </View>
    ) : undefined
  return (
    <PageHeader
      title={name ?? '…'}
      description={bank ?? undefined}
      backLink={{ href: '/(app)/cards', label: t('cards.title') }}
      actions={actions}
    />
  )
}
