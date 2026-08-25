import { Pressable, Text, View } from 'react-native'
import { Pencil, Trash2 } from 'lucide-react-native'
import { RESERVE_HISTORY_LIMIT, type Purpose } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useT, useLocale } from '../../lib/locale-context'
import { formatShortDate } from '../transactions/detail/format'
import { usePurposeHistory } from '../../lib/savings/queries'
import { Button } from '../ui/Button'
import { colors } from '../../lib/colors'
import { SheetBackHeader } from './SheetBackHeader'

type Currency = 'ARS' | 'USD'

const money = (amount: number, currency: Currency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

/**
 * Un grupo: el mismo bloque que una moneda, un nivel más abajo. Espejo nativo
 * del `GroupBlock` de web.
 *
 * Sus dos acciones llegan con el propósito YA PUESTO: se llegó tocando este
 * grupo, así que preguntar "¿de cuál sale?" sería preguntar algo que el usuario
 * acaba de responder con el dedo.
 *
 * «Sin destino» no se puede editar ni borrar, y no es una restricción: no es una
 * fila. Es el nombre que la app le da a lo que no tiene etiqueta.
 */
export const PurposeGroup = ({
  currency,
  purpose,
  reserved,
  onSave,
  onRelease,
  onAllocate,
  onUnallocate,
  onEdit,
  onDelete,
  onBack,
}: {
  currency: Currency
  purpose: Purpose
  reserved: number
  onSave: () => void
  onRelease: () => void
  /** Desde «Sin destino»: elegir a qué apartar. Desde uno: apartarle más. */
  onAllocate: () => void
  onUnallocate: () => void
  onEdit: () => void
  onDelete: () => void
  onBack: () => void
}) => {
  const t = useT()
  const locale = useLocale()

  // El historial de un propósito son sus REPARTOS, no reservas. Son dos actos
  // distintos —guardar mueve el disponible, apartar no— y mezclarlos obligaría a
  // distinguir a ojo cosas que no se parecen. «Sin destino» no tiene: es el
  // resto, no tiene actos propios.
  const { data } = usePurposeHistory(true, currency, purpose.id)
  const history = data ?? { entries: [], hasMore: false }

  return (
    <View>
      <SheetBackHeader
        title={purpose.name}
        onBack={onBack}
        action={
          <View className="flex-row gap-1">
              <Pressable
                onPress={onEdit}
                accessibilityRole="button"
                accessibilityLabel={t('savings.purposes.edit')}
                className="size-11 items-center justify-center rounded-xl"
              >
                <Pencil size={17} color={colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={onDelete}
                accessibilityRole="button"
                accessibilityLabel={t('savings.purposes.delete')}
                className="size-11 items-center justify-center rounded-xl"
              >
                <Trash2 size={17} color={colors.textMuted} />
              </Pressable>
          </View>
        }
      />

      <View className="mt-4 rounded-2xl border border-border bg-card p-4">
        <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
          {t('savings.purposes.allocated_in', { purpose: purpose.name })}
        </Text>
        <Text className="mt-1.5 text-[24px] font-extrabold text-text">
          {money(reserved, currency)}
        </Text>

        <>
            <Text className="mt-4 text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
              {t('savings.history')}
            </Text>
            {history.entries.length === 0 ? (
              <Text className="mt-1.5 text-[13px] text-text-soft">
                {t('savings.purposes.empty_allocations')}
              </Text>
            ) : (
              <View className="mt-1.5">
                {history.entries.map((entry) => (
                  <View
                    key={entry.id}
                    className="flex-row items-center justify-between border-t border-border-soft py-2.5"
                  >
                    <Text className="text-[14px] font-semibold text-text">
                      {entry.amount >= 0
                        ? t('savings.purposes.entry_allocated')
                        : t('savings.purposes.entry_unallocated')}
                      <Text className="text-[12px] font-medium text-text-soft">
                        {' '}
                        {formatShortDate(entry.date, locale)}
                      </Text>
                    </Text>
                    <Text
                      className={`text-[14px] font-extrabold ${
                        entry.amount >= 0 ? 'text-positive' : 'text-text-muted'
                      }`}
                    >
                      {entry.amount >= 0 ? '+' : '−'}
                      {money(Math.abs(entry.amount), currency)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {history.hasMore && (
              <Text className="mt-2 text-[12px] text-text-soft">
                {t('savings.history_truncated', { count: String(RESERVE_HISTORY_LIMIT) })}
              </Text>
            )}
        </>

        <View className="mt-4 flex-row gap-2">
          <View className="flex-1">
            <Button title={t('savings.save')} onPress={onSave} />
          </View>
          <View className="flex-1">
            <Button
              title={t('savings.release')}
              variant="secondary"
              onPress={onRelease}
              disabled={reserved <= 0}
            />
          </View>
        </View>

        {/* El segundo par de verbos, como enlaces: no tocan ningún total, así
            que no compiten en peso con los dos que sí lo hacen. */}
        <View className="mt-3 flex-row justify-center gap-6">
          <Pressable
            onPress={onAllocate}
            accessibilityRole="button"
            className="min-h-[44px] justify-center"
          >
            <Text className="text-[13px] font-bold text-positive">
              {t('savings.purposes.allocate')}
            </Text>
          </Pressable>
          <Pressable
            onPress={onUnallocate}
            disabled={reserved <= 0}
            accessibilityRole="button"
            className={`min-h-[44px] justify-center ${reserved <= 0 ? 'opacity-40' : ''}`}
          >
            <Text className="text-[13px] font-bold text-positive">
              {t('savings.purposes.unallocate')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
