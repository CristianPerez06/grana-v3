import { Pressable, Text, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import { PURPOSE_SEEDS, type Purpose, type PurposeSums } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'
import { SheetBackHeader } from './SheetBackHeader'

type Currency = 'ARS' | 'USD'

/**
 * Elegir para qué. Espejo nativo del `PurposePicker` de web.
 *
 * Lo del usuario primero y las sugerencias abajo, que **desaparecen a medida que
 * las adopta**: ofrecer "Viaje" a alguien que ya tiene "Viaje" es empujarlo
 * contra el índice único con el atajo pensado para ahorrarle trabajo.
 *
 * «Sin destino» es una opción más y no "ninguno": es un grupo con las mismas
 * reglas, y presentarlo como ausencia de elección lo volvería invisible justo
 * para quien tiene ahí toda su plata.
 */
export const PurposePicker = ({
  purposes,
  sums,
  currency,
  selectedId,
  onPick,
  onCreate,
  onBack,
}: {
  purposes: Purpose[]
  sums: PurposeSums[]
  currency: Currency
  selectedId: string | null
  onPick: (purposeId: string | null) => void
  /** Sin argumento abre el alta en blanco; con una clave, precargada. */
  onCreate: (seedKey?: string) => void
  onBack: () => void
}) => {
  const t = useT()

  const money = (amount: number) =>
    currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

  const amountOf = (purposeId: string | null): number =>
    sums.find((s) => s.currencyCode === currency && s.purposeId === purposeId)?.reserved ?? 0

  const taken = new Set(purposes.map((p) => p.name.trim().toLowerCase()))
  const suggestions = PURPOSE_SEEDS.filter(
    (seed) => !taken.has(t(`savings.purposes.seeds.${seed.key}`).trim().toLowerCase()),
  )

  return (
    <View>
      <SheetBackHeader title={t('savings.purposes.choose')} onBack={onBack} />

      <Text className="mt-4 text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
        {t('savings.purposes.yours')}
      </Text>
      <View className="mt-2 gap-2">
        {purposes.map((purpose) => (
          <PurposeRow
            key={purpose.id}
            icon={purpose.icon}
            name={purpose.name}
            amount={money(amountOf(purpose.id))}
            selected={selectedId === purpose.id}
            onPress={() => onPick(purpose.id)}
          />
        ))}
        <PurposeRow
          icon={null}
          name={t('savings.purposes.none')}
          amount={money(amountOf(null))}
          selected={selectedId === null}
          onPress={() => onPick(null)}
        />
      </View>

      {suggestions.length > 0 && (
        <>
          <Text className="mt-5 text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
            {t('savings.purposes.suggestions')}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {suggestions.map((seed) => (
              <Pressable
                key={seed.key}
                onPress={() => onCreate(seed.key)}
                accessibilityRole="button"
                className="min-h-[44px] flex-row items-center gap-2 rounded-full border border-border bg-card px-3.5"
              >
                <Text className="text-[15px]">{seed.icon}</Text>
                <Text className="text-[13.5px] font-semibold text-text">
                  {t(`savings.purposes.seeds.${seed.key}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Pressable
        onPress={() => onCreate()}
        accessibilityRole="button"
        className="mt-5 min-h-[44px] flex-row items-center gap-2 self-start"
      >
        <Plus size={16} color={colors.positive} />
        <Text className="text-[13.5px] font-bold text-positive">
          {t('savings.purposes.new')}
        </Text>
      </Pressable>
    </View>
  )
}

const PurposeRow = ({
  icon,
  name,
  amount,
  selected,
  onPress,
}: {
  icon: string | null
  name: string
  amount: string
  selected: boolean
  onPress: () => void
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    className={`min-h-[52px] flex-row items-center gap-3 rounded-xl border px-3 py-2 ${
      selected ? 'border-positive bg-border-soft' : 'border-border bg-card'
    }`}
  >
    <Text className="text-[17px]">{icon ?? '🫙'}</Text>
    <Text className="flex-1 text-[14px] font-semibold text-text" numberOfLines={1}>
      {name}
    </Text>
    <Text className="text-[13px] font-extrabold text-text-muted">{amount}</Text>
  </Pressable>
)
