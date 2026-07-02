import { Text, View } from 'react-native'
import { BarChart3 } from 'lucide-react-native'
import { formatARS } from '@grana/i18n-messages'
import { subtractMoneyValues } from '../../../lib/cards/utils'
import { useT } from '../../../lib/locale-context'
import { detailColors, stripBold } from './format'

type Props = {
  creditLimit: number | null
  /** Committed ARS across the visible statements (ARS-only, Bimoneda + I-CRED-9). */
  committedARS: number
  accent: string
  showCents?: boolean
}

/**
 * Optional credit-limit panel. When the limit is loaded, shows used/total/% and
 * the available remainder. When it is null, shows an informational hint — read-only
 * v1 omits the web "Cargar límite" CTA (editing the card is a follow-up change).
 */
export const CardLimitPanel = ({ creditLimit, committedARS, accent, showCents = false }: Props) => {
  const t = useT()

  if (creditLimit === null || creditLimit <= 0) {
    return (
      <View className="flex-row items-center gap-4 rounded-2xl border border-border-soft bg-card p-5">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-border-soft">
          <BarChart3 size={20} color={detailColors.textMuted} />
        </View>
        <Text className="flex-1 text-sm text-text-muted">
          <Text className="font-semibold text-text">{t('cards.detail.limit_cta_title')}</Text>{' '}
          {t('cards.detail.limit_cta_body')}
        </Text>
      </View>
    )
  }

  const used = Math.max(0, committedARS)
  const pct = Math.min(100, Math.round((used / creditLimit) * 100))
  const available = subtractMoneyValues(creditLimit, used)

  return (
    <View className="flex-col gap-2.5 rounded-2xl border border-border-soft bg-card p-6">
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="flex-1 text-sm text-text-muted">
          {stripBold(
            t('cards.detail.limit_used', {
              used: formatARS(used, showCents),
              total: formatARS(creditLimit, showCents),
            }),
          )}
        </Text>
        <Text className="text-sm font-bold text-text">{pct}%</Text>
      </View>
      <View className="h-2.5 w-full overflow-hidden rounded-full bg-border">
        <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
      </View>
      <Text className="text-sm text-text-muted">
        {stripBold(t('cards.detail.limit_available', { available: formatARS(available, showCents) }))}
      </Text>
    </View>
  )
}
