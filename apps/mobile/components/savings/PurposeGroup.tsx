import { Pressable, Text, View } from 'react-native'
import { ChevronRight, Pencil, Trash2 } from 'lucide-react-native'
import { RESERVE_HISTORY_LIMIT, type Purpose, type ReserveEntry } from '@grana/savings'
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
  purposeId,
  purpose,
  reserved,
  onAssign,
  onSave,
  onRelease,
  onEdit,
  onDelete,
  onBack,
}: {
  currency: Currency
  purposeId: string | null
  purpose: Purpose | null
  reserved: number
  onAssign: (entry: ReserveEntry) => void
  onSave: () => void
  onRelease: () => void
  onEdit: (purpose: Purpose) => void
  onDelete: (purpose: Purpose) => void
  onBack: () => void
}) => {
  const t = useT()
  const locale = useLocale()

  // Acotado a ESTE grupo, del mismo read. Filtrar en memoria el historial de la
  // moneda daría una lista recortada de un tope que ya se aplicó arriba.
  const { data } = usePurposeHistory(true, currency, purposeId)
  const history = data ?? { entries: [], hasMore: false }

  return (
    <View>
      <SheetBackHeader
        title={purpose?.name ?? t('savings.purposes.none')}
        onBack={onBack}
        action={
          purpose ? (
            <View className="flex-row gap-1">
              <Pressable
                onPress={() => onEdit(purpose)}
                accessibilityRole="button"
                accessibilityLabel={t('savings.purposes.edit')}
                className="size-11 items-center justify-center rounded-xl"
              >
                <Pencil size={17} color={colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={() => onDelete(purpose)}
                accessibilityRole="button"
                accessibilityLabel={t('savings.purposes.delete')}
                className="size-11 items-center justify-center rounded-xl"
              >
                <Trash2 size={17} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : undefined
        }
      />

      <View className="mt-4 rounded-2xl border border-border bg-card p-4">
        <Text className="text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
          {t('savings.total_label', { currency })}
        </Text>
        <Text className="mt-1.5 text-[24px] font-extrabold text-text">
          {money(reserved, currency)}
        </Text>

        <Text className="mt-4 text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
          {t('savings.history')}
        </Text>
        {history.entries.length === 0 ? (
          <Text className="mt-1.5 text-[13px] text-text-soft">{t('savings.empty_history')}</Text>
        ) : (
          <View className="mt-1.5">
            {history.entries.map((entry) => (
              /* Tocable, y acá es el caso que más importa: parado en «Sin
                 destino» el usuario está mirando la plata que quiere etiquetar. */
              <Pressable
                key={entry.id}
                accessibilityRole="button"
                onPress={() => onAssign(entry)}
                className="min-h-[44px] flex-row items-center justify-between gap-2 border-t border-border-soft py-2.5"
              >
                <Text className="text-[14px] font-semibold text-text">
                  {entry.amount >= 0 ? t('savings.entry_saved') : t('savings.entry_released')}
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
                <ChevronRight size={15} color={colors.textSoft} />
              </Pressable>
            ))}
          </View>
        )}
        {history.hasMore && (
          <Text className="mt-2 text-[12px] text-text-soft">
            {t('savings.history_truncated', { count: String(RESERVE_HISTORY_LIMIT) })}
          </Text>
        )}

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
      </View>
    </View>
  )
}
