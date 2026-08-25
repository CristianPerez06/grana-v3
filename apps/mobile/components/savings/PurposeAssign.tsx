import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Plus } from 'lucide-react-native'
import { PURPOSE_SEEDS, type Purpose, type ReserveEntry } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useT } from '../../lib/locale-context'
import { Button } from '../ui/Button'
import { assignPurpose } from '../../lib/savings/mutations'
import { colors } from '../../lib/colors'
import { SheetBackHeader } from './SheetBackHeader'

type Currency = 'ARS' | 'USD'

/**
 * Ponerle nombre a algo que YA guardaste. Espejo nativo del `PurposeAssign` de
 * web, y el segundo par de verbos del modelo: **asignar ⇄ desasignar**.
 *
 * No mueve plata y —a diferencia de guardar y volver a usar— tampoco cambia el
 * disponible ni el total guardado. Es la operación más inofensiva del modelo, y
 * por eso no tiene tope ni piso.
 *
 * Sin ella la fase 2 solo serviría de acá en adelante: todo lo guardado antes
 * quedaría condenado a «Sin destino».
 */
export const PurposeAssign = ({
  entry,
  currency,
  purposes,
  onDone,
  onCreate,
  onBack,
}: {
  entry: ReserveEntry
  currency: Currency
  purposes: Purpose[]
  onDone: () => void | Promise<void>
  onCreate: (seedKey?: string) => void
  onBack: () => void
}) => {
  const t = useT()
  const [selected, setSelected] = useState<string | null>(entry.purposeId)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const money = (amount: number) =>
    currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

  const taken = new Set(purposes.map((p) => p.name.trim().toLowerCase()))
  const suggestions = PURPOSE_SEEDS.filter(
    (seed) => !taken.has(t(`savings.purposes.seeds.${seed.key}`).trim().toLowerCase()),
  )

  const submit = async () => {
    setError(null)
    setPending(true)
    try {
      const result = await assignPurpose(entry.id, selected)
      if (!result.ok) {
        setError(t('savings.purposes.errors.generic'))
        return
      }
      await onDone()
    } finally {
      setPending(false)
    }
  }

  const Option = ({
    id,
    icon,
    name,
  }: {
    id: string | null
    icon: string | null
    name: string
  }) => (
    <Pressable
      onPress={() => setSelected(id)}
      accessibilityRole="button"
      className={`min-h-[52px] flex-row items-center gap-3 rounded-xl border px-3 py-2 ${
        selected === id ? 'border-positive bg-border-soft' : 'border-border bg-card'
      }`}
    >
      <Text className="text-[17px]">{icon ?? '🫙'}</Text>
      <Text className="flex-1 text-[14px] font-semibold text-text" numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  )

  return (
    <View>
      <SheetBackHeader title={t('savings.purposes.assign_title')} onBack={onBack} />

      {/* El movimiento a la vista: sin él, la pantalla preguntaría "¿para qué
          fue?" sobre algo que el usuario no ve. */}
      <View className="mt-4 flex-row items-baseline justify-between rounded-2xl border border-border bg-card px-4 py-3">
        <Text className="text-[14px] font-semibold text-text">
          {entry.amount >= 0 ? t('savings.entry_saved') : t('savings.entry_released')}
        </Text>
        <Text className="text-[15px] font-extrabold text-text">
          {entry.amount >= 0 ? '+' : '−'}
          {money(Math.abs(entry.amount))}
        </Text>
      </View>

      <View className="mt-4 gap-2">
        {purposes.map((purpose) => (
          <Option key={purpose.id} id={purpose.id} icon={purpose.icon} name={purpose.name} />
        ))}
        {/* Desasignar es elegir «Sin destino»: el par de verbos es simétrico y
            se expresa con la misma lista, sin un botón "sacar". */}
        <Option id={null} icon={null} name={t('savings.purposes.none')} />
      </View>

      {suggestions.length > 0 && (
        <View className="mt-3 flex-row flex-wrap gap-2">
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
      )}

      <Pressable
        onPress={() => onCreate()}
        accessibilityRole="button"
        className="mt-3 min-h-[44px] flex-row items-center gap-2 self-start"
      >
        <Plus size={16} color={colors.positive} />
        <Text className="text-[13.5px] font-bold text-positive">{t('savings.purposes.new')}</Text>
      </Pressable>

      <Text className="mt-4 rounded-xl bg-border-soft px-3 py-2.5 text-[12.5px] leading-snug text-text-muted">
        {t('savings.purposes.assign_note')}
      </Text>

      {error != null && (
        <Text className="mt-3 text-[13px] font-semibold text-negative">{error}</Text>
      )}

      <View className="mt-4">
        <Button
          title={t('savings.purposes.assign_cta')}
          onPress={submit}
          loading={pending}
          disabled={pending}
        />
      </View>
    </View>
  )
}
