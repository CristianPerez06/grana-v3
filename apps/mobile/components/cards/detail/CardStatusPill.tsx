import { Text, View } from 'react-native'
import type { CardTone } from '@grana/cards'
import { useT } from '../../../lib/locale-context'

// Native mirror of the web `CardStatusPill`: statement status tone → soft pill.
// Same tone tokens as web (`bg-terracotta-soft text-terracotta`, …), which read
// fine on the navy PageHeader.
const TONE: Record<CardTone, { bg: string; text: string; dot: string }> = {
  due: { bg: 'bg-terracotta-soft', text: 'text-terracotta', dot: 'bg-terracotta' },
  soon: { bg: 'bg-warning-soft', text: 'text-warning-deep', dot: 'bg-warning' },
  ok: { bg: 'bg-emerald-soft', text: 'text-emerald-deep', dot: 'bg-emerald' },
}

export const CardStatusPill = ({ tone }: { tone: CardTone }) => {
  const t = useT()
  const c = TONE[tone]
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full px-2.5 py-1 ${c.bg}`}>
      <View className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      <Text className={`text-xs font-semibold ${c.text}`}>{t(`cards.pill.${tone}`)}</Text>
    </View>
  )
}
