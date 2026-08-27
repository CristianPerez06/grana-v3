import { useState } from 'react'
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
  amounts,
  onRelease,
  onAllocate,
  onUnallocate,
  onEdit,
  onDelete,
  onBack,
}: {
  currency: Currency
  purpose: Purpose
  /** Lo de ESTA moneda: es el piso de las acciones, que son por moneda. */
  reserved: number
  /** Lo de todas las monedas, para responder "cuánto tengo para esto". */
  amounts: { currency: Currency; reserved: number }[]
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

  /**
   * Cuántos repartos se leen sin desplegar.
   *
   * Cinco entran sin empujar las dos acciones fuera de la pantalla, que es para
   * lo que se entra acá. El historial se consulta de vez en cuando; las acciones
   * son de todos los días.
   */
  const HISTORY_PREVIEW = 5
  const [showAllHistory, setShowAllHistory] = useState(false)
  const shownEntries = showAllHistory ? history.entries : history.entries.slice(0, HISTORY_PREVIEW)
  const moreEntries = history.entries.length - shownEntries.length

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
          {t('savings.purposes.totals')}
        </Text>
        {/* Las dos monedas, sin un total que las sume: eso exigiría convertir, y
            Grana no convierte. La grande es la de la moneda en la que se opera. */}
        <Text className="mt-1.5 text-[24px] font-extrabold text-text">
          {money(reserved, currency)}
        </Text>
        {amounts
          .filter((a) => a.currency !== currency && a.reserved !== 0)
          .map((a) => (
            <Text key={a.currency} className="mt-1 text-[15px] font-bold text-text-muted">
              {money(a.reserved, a.currency)}
            </Text>
          ))}

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
                {shownEntries.map((entry) => (
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
            {/* El resto, detrás de un control: el historial crecía sin límite y
                empujaba fuera de pantalla justo las acciones para las que se
                entra acá. */}
            {moreEntries > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowAllHistory(true)}
                className="min-h-[44px] justify-center"
              >
                <Text className="text-[12.5px] font-bold text-text-muted">
                  {t('savings.history_more', { count: String(moreEntries) })}
                </Text>
              </Pressable>
            )}
            {history.hasMore && (
              <Text className="mt-2 text-[12px] text-text-soft">
                {t('savings.history_truncated', { count: String(RESERVE_HISTORY_LIMIT) })}
              </Text>
            )}
        </>

        {/* Los BOTONES son lo que se le hace a ESTE propósito: sumarle y
            sacarle. Los dos mueven su reparto y ninguno mueve el total guardado.

            «Guardar» no está, y es separación de niveles: cambia el TOTAL, así
            que vive un nivel arriba, donde el total está a la vista (D18).
            «Volver a usar» tampoco está acá abajo por la misma razón —también
            cambia el total— y bajó a enlace. Tenerlo como botón hacía que esta
            pantalla se contradijera: excluía a Guardar por cambiar el total e
            incluía, con el mismo peso, otra que también lo cambia. */}
        <View className="mt-4 flex-row gap-2">
          <View className="flex-1">
            <Button title={t('savings.purposes.allocate_more')} onPress={onAllocate} />
          </View>
          <View className="flex-1">
            <Button
              title={t('savings.purposes.unallocate')}
              variant="secondary"
              onPress={onUnallocate}
              disabled={reserved <= 0}
            />
          </View>
        </View>

        {/* «Volver a usar», como enlace y no como botón.

            Es la única salida de acá que vuelve la plata GASTABLE, y por eso no
            comparte peso con las dos de arriba, que no tocan el total. Pero
            tampoco se va de la pantalla: parado en Viaje, querer usar esos pesos
            es un caso real, y mandarlo al total le cobraría dos taps y
            re-elegir un propósito que ya tenía delante.

            Separado por un divisor y no pegado a los botones: lo que lo
            distingue no es la forma, es que hace otra cosa. */}
        <View className="mt-4 border-t border-border-soft pt-3">
          <Text className="text-[12.5px] leading-[1.45] text-text-muted">
            {t('savings.purposes.unallocate_note')}
          </Text>
          <Pressable
            onPress={onRelease}
            disabled={reserved <= 0}
            accessibilityRole="button"
            className={`mt-2 min-h-[44px] justify-center ${reserved <= 0 ? 'opacity-40' : ''}`}
          >
            <Text className="text-[13px] font-bold text-emerald-deep underline">
              {t('savings.release')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
