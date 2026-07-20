import { Text, View } from 'react-native'
import type { PeriodVariant } from '@grana/cards'
import { useT } from '../../lib/locale-context'

// Statement status → soft pill. Native mirror of the web periods list pill.
// Structural tokens (web's blue/amber/green map to the mobile slate/warning/
// emerald soft pairs). `actual` reads neutral-blue via slate.
const VARIANT: Record<PeriodVariant, { bg: string; text: string; key: string }> = {
  futuro: { bg: 'bg-border-soft', text: 'text-text-muted', key: 'cards.period.future' },
  tarjeta_nueva: {
    bg: 'bg-border-soft',
    text: 'text-text-muted',
    key: 'cards.period.no_movements',
  },
  actual: { bg: 'bg-slate-soft', text: 'text-slate-deep', key: 'cards.period.current' },
  cerrado_esperando_pago: {
    bg: 'bg-warning-soft',
    text: 'text-warning-deep',
    key: 'cards.period.pending_payment',
  },
  vencido: { bg: 'bg-terracotta-soft', text: 'text-terracotta', key: 'cards.period.overdue' },
  pagado: { bg: 'bg-emerald-soft', text: 'text-emerald-deep', key: 'cards.period.paid' },
}

export function PeriodStatusPill({ variant }: { variant: PeriodVariant }) {
  const t = useT()
  const c = VARIANT[variant] ?? VARIANT.futuro
  return (
    <View className={`self-start rounded-full px-2.5 py-0.5 ${c.bg}`}>
      <Text className={`text-[11px] font-semibold ${c.text}`}>{t(c.key)}</Text>
    </View>
  )
}
