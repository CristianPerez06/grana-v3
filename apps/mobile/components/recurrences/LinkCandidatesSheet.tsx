import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import type { LinkCandidate } from '@grana/recurrences'
import { SelectSheet } from '../ui/SelectSheet'
import { Button } from '../ui/Button'
import { useLocale, useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { fmtMoney, formatShortDate } from '../transactions/detail/format'

type Props = {
  visible: boolean
  onClose: () => void
  dueDate: string
  ruleAmount: number
  ruleCurrency: string
  /** La regla es compartida: un movimiento personal se convierte al vincularlo. */
  shared: boolean
  /** `null` mientras se lee. Vacío y «todavía no llegó» no son lo mismo. */
  candidates: LinkCandidate[] | null
  loadError: boolean
  widened: boolean
  onWiden: () => void
  onPick: (candidate: LinkCandidate, confirmConversion: boolean) => void
  pending: boolean
  error: string | null
}

/**
 * Paridad nativa del drawer de candidatos de web.
 *
 * NADA de acá adentro repite el margen lateral: `SelectSheet` ya lo pone en el
 * contenedor de su lista (`px-5`), así que ponerlo otra vez en el encabezado, en
 * las filas y en el pie daba 40px de cada lado y el importe quedaba cortado
 * contra el borde.
 *
 * Se compone sobre `SelectSheet` y no sobre un `ScrollView` a mano: esa hoja ya
 * resuelve el tope de altura del scroller EN PÍXELES, que es lo que hace que una
 * lista dentro de una hoja de contenido pueda scrollear — un `maxHeight` en
 * porcentaje sobre el panel sólo recorta, porque el `FlatList` cree que su
 * viewport es todo su contenido. No lleva inputs de texto, así que no necesita el
 * cuerpo con teclado.
 */
export function LinkCandidatesSheet({
  visible,
  onClose,
  dueDate,
  ruleAmount,
  ruleCurrency,
  shared,
  candidates,
  loadError,
  widened,
  onWiden,
  onPick,
  pending,
  error,
}: Props) {
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()
  const [confirming, setConfirming] = useState<LinkCandidate | null>(null)

  const money = (amount: number, currency: string) =>
    fmtMoney(amount, currency as 'ARS' | 'USD', showCents)

  const pick = (candidate: LinkCandidate) => {
    // Convertir un gasto personal en compartido mueve la deuda con la otra
    // persona. Nunca en silencio.
    if (shared && candidate.needs_conversion) {
      setConfirming(candidate)
      return
    }
    onPick(candidate, false)
  }

  // La confirmación de la conversión reemplaza el cuerpo de la hoja en vez de
  // abrir una segunda: dos overlays apilados sobre un `Modal` nativo dejan el de
  // atrás capturando toques.
  if (confirming) {
    return (
      <SelectSheet<LinkCandidate>
        visible={visible}
        onClose={onClose}
        title={t('recurrences.link.convert_title')}
        items={[]}
        keyExtractor={(candidate) => candidate.id}
        renderRow={() => null}
        header={
          <View className="gap-3 py-4">
            <Text className="text-[13.5px] text-text-muted">
              {t('recurrences.link.convert_body')}
            </Text>
            {error ? <Text className="text-[13px] text-terracotta">{error}</Text> : null}
            {/* APILADOS, no en una fila: el `Button` es `w-full`, así que dos en
                la misma línea se llevan media hoja cada uno y el texto de
                confirmar —que es una frase, no una palabra— se desborda. Igual
                que en web. */}
            <View className="gap-2">
              <Button onPress={() => onPick(confirming, true)} disabled={pending}>
                {pending
                  ? t('recurrences.link.linking')
                  : t('recurrences.link.convert_confirm')}
              </Button>
              <Button variant="ghost" onPress={() => setConfirming(null)} disabled={pending}>
                {t('recurrences.link.convert_cancel')}
              </Button>
            </View>
          </View>
        }
      />
    )
  }

  return (
    <SelectSheet<LinkCandidate>
      visible={visible}
      onClose={onClose}
      title={t('recurrences.link.candidates_title')}
      items={candidates ?? []}
      keyExtractor={(candidate) => candidate.id}
      header={
        <View className="gap-1 pb-2">
          <Text className="text-[13px] text-text-muted">
            {t('recurrences.link.candidates_subtitle', {
              date: formatShortDate(dueDate, locale),
            })}
          </Text>
          {error ?? loadError ? (
            <Text className="text-[13px] text-terracotta">
              {error ?? t('recurrences.link.candidates_empty')}
            </Text>
          ) : null}
          {candidates == null ? (
            <View className="items-center py-6">
              <ActivityIndicator />
            </View>
          ) : null}
        </View>
      }
      renderRow={(candidate) => {
        const differs = Math.abs(candidate.amount - ruleAmount) > 0.004
        return (
          <Pressable
            onPress={() => pick(candidate)}
            disabled={pending}
            className="flex-row items-center gap-3 py-3"
          >
            <View className="min-w-0 flex-1">
              <Text className="text-[14.5px] font-semibold text-text" numberOfLines={1}>
                {/* `trim() ||` y no `??`: una descripción de puros espacios no
                    es null, y dejaba la fila con el nombre en blanco. */}
                {candidate.description?.trim() || t('recurrences.link.no_description')}
              </Text>
              <Text className="text-[12.5px] text-text-muted">
                {formatShortDate(candidate.date, locale)}
              </Text>
              {differs ? (
                <Text className="mt-0.5 text-[12px] text-text-soft">
                  {t('recurrences.link.amount_differs', {
                    ruleAmount: money(ruleAmount, ruleCurrency),
                    amount: money(candidate.amount, candidate.currency_code),
                  })}
                </Text>
              ) : null}
            </View>
            {/* El importe NO se achica ni se parte: es el dato con el que se
                elige la fila. `shrink-0` lo protege del nombre largo, y una sola
                línea evita que un monto grande se corte en dos. */}
            <Text
              className="shrink-0 text-[14.5px] font-bold tabular-nums text-text"
              numberOfLines={1}
            >
              {money(candidate.amount, candidate.currency_code)}
            </Text>
          </Pressable>
        )
      }}
      footer={
        <View className="border-t border-border py-3">
          {candidates != null && candidates.length === 0 ? (
            <Text className="pb-3 text-center text-[13.5px] text-text-muted">
              {t('recurrences.link.candidates_empty')}
            </Text>
          ) : null}
          {/* Siempre disponible, no sólo con la lista vacía. */}
          {widened ? (
            <Text className="text-[12.5px] text-text-soft">
              {t('recurrences.link.widened')}
            </Text>
          ) : (
            <Button variant="ghost" onPress={onWiden} disabled={pending}>
              {t('recurrences.link.widen')}
            </Button>
          )}
        </View>
      }
    />
  )
}
