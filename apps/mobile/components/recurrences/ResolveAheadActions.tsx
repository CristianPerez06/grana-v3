import { useState } from 'react'
import { Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import type { LinkCandidate } from '@grana/recurrences'
import { Button } from '../ui/Button'
import { useT } from '../../lib/locale-context'
import {
  getRecurrenceLinkCandidates,
  linkMovementToRecurrence,
  registerRecurrenceAhead,
} from '../../lib/recurrences/mutators'
import { invalidateAfterRecurrenceResolution } from '../../lib/recurrences/invalidate'
import { LinkCandidatesSheet } from './LinkCandidatesSheet'

type Props = {
  recurrenceId: string
  /** El vencimiento. NO se mueve: la fecha de pago es otro hecho. */
  dueDate: string
  ruleAmount: number
  ruleCurrency: string
  shared: boolean
}

/**
 * Paridad nativa de las dos salidas para un vencimiento que todavía no llegó.
 *
 * Registrar el pago acá NO adelanta el calendario: el próximo vencimiento sigue
 * siendo el que la regla preveía.
 */
export function ResolveAheadActions({
  recurrenceId,
  dueDate,
  ruleAmount,
  ruleCurrency,
  shared,
}: Props) {
  const t = useT()
  // LA INVALIDACIÓN VIVE ACÁ, no en cada pantalla que monta el componente. Las
  // dos que lo montan —el hub y el detalle— la pasaban como prop, y una de las
  // dos podía elegir mal: elegían el helper angosto y el saldo quedaba viejo.
  // Acá no hay nada que elegir.
  const queryClient = useQueryClient()
  const [sheetOpen, setSheetOpen] = useState(false)
  // Cada apertura monta una hoja NUEVA. Cerrarla ya limpia su confirmación, pero
  // vincular con éxito la cierra desde acá, sin pasar por ese cierre: sin esto,
  // el estado interno de la hoja sobreviviría a la apertura siguiente.
  const [sheetKey, setSheetKey] = useState(0)
  const [candidates, setCandidates] = useState<LinkCandidate[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [widened, setWidened] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // EL ACUSE. Sin él la pantalla cambia en silencio y el usuario no sabe si pasó
  // algo. Acá la regla sigue en la lista —sólo se corre su próxima fecha—, así
  // que el mensaje puede quedarse donde estaban los botones.
  const [done, setDone] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // La lectura la dispara el toque, no un efecto de montaje: es la misma razón
  // que en web, y además deja la carga atada a la intención del usuario.
  const load = (widen: boolean) => {
    setCandidates(null)
    setLoadError(false)
    getRecurrenceLinkCandidates(recurrenceId, dueDate, widen)
      .then(setCandidates)
      .catch(() => {
        // «No hay» y «no sabemos» no son lo mismo.
        setCandidates([])
        setLoadError(true)
      })
  }

  const openSheet = () => {
    setError(null)
    setWidened(false)
    setSheetKey((n) => n + 1)
    setSheetOpen(true)
    load(false)
  }

  const widen = () => {
    setWidened(true)
    load(true)
  }

  const payNow = async () => {
    setError(null)
    setDone(null)
    setPending(true)
    const result = await registerRecurrenceAhead({ recurrenceId, dueDate }, t)
    setPending(false)
    if (!result.ok) {
      setError(result.formError)
      return
    }
    setDone(t('recurrences.link.recorded_success'))
    invalidateAfterRecurrenceResolution(queryClient)
  }

  const pick = async (candidate: LinkCandidate, confirmConversion: boolean) => {
    setError(null)
    setDone(null)
    setPending(true)
    const result = await linkMovementToRecurrence(
      { recurrenceId, dueDate, transactionId: candidate.id, confirmConversion },
      t,
    )
    setPending(false)
    if (!result.ok) {
      setError(result.formError)
      return
    }
    setSheetOpen(false)
    setDone(t('recurrences.link.linked_success'))
    invalidateAfterRecurrenceResolution(queryClient)
  }

  return (
    <View className="gap-2">
      {/* Una sola fila, mitad y mitad, y las dos con el mismo peso — el gemelo
          de web. El `Button` nativo es `w-full` igual que el de web, así que sin
          la mitad cada uno se comería la fila entera. Y las dos `secondary`
          porque son caminos equivalentes: una llena y la otra fantasma hacía que
          la primera pareciera ya elegida. */}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button variant="secondary" size="xs" onPress={payNow} disabled={pending}>
            {t('recurrences.link.already_paid')}
          </Button>
        </View>
        <View className="flex-1">
          <Button variant="secondary" size="xs" onPress={openSheet} disabled={pending}>
            {t('recurrences.link.already_loaded')}
          </Button>
        </View>
      </View>
      {error && !sheetOpen ? (
        <Text className="text-[13px] text-terracotta">{error}</Text>
      ) : null}
      {done ? <Text className="text-[13px] text-emerald-deep">{done}</Text> : null}

      <LinkCandidatesSheet
        key={sheetKey}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        dueDate={dueDate}
        ruleAmount={ruleAmount}
        ruleCurrency={ruleCurrency}
        shared={shared}
        candidates={candidates}
        loadError={loadError}
        widened={widened}
        onWiden={widen}
        onPick={pick}
        pending={pending}
        error={sheetOpen ? error : null}
      />
    </View>
  )
}
