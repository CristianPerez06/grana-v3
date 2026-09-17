import { useState } from 'react'
import { Text, View } from 'react-native'
import type { LinkCandidate } from '@grana/recurrences'
import { Button } from '../ui/Button'
import { useT } from '../../lib/locale-context'
import {
  getRecurrenceLinkCandidates,
  linkMovementToRecurrence,
  registerRecurrenceAhead,
} from '../../lib/recurrences/mutators'
import { LinkCandidatesSheet } from './LinkCandidatesSheet'

type Props = {
  recurrenceId: string
  /** El vencimiento. NO se mueve: la fecha de pago es otro hecho. */
  dueDate: string
  ruleAmount: number
  ruleCurrency: string
  shared: boolean
  onResolved: () => void
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
  onResolved,
}: Props) {
  const t = useT()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [candidates, setCandidates] = useState<LinkCandidate[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [widened, setWidened] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    setSheetOpen(true)
    load(false)
  }

  const widen = () => {
    setWidened(true)
    load(true)
  }

  const payNow = async () => {
    setError(null)
    setPending(true)
    const result = await registerRecurrenceAhead({ recurrenceId, dueDate }, t)
    setPending(false)
    if (!result.ok) {
      setError(result.formError)
      return
    }
    onResolved()
  }

  const pick = async (candidate: LinkCandidate, confirmConversion: boolean) => {
    setError(null)
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
    onResolved()
  }

  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        <Button variant="secondary" onPress={payNow} disabled={pending}>
          {t('recurrences.link.already_paid')}
        </Button>
        <Button variant="ghost" onPress={openSheet} disabled={pending}>
          {t('recurrences.link.already_loaded')}
        </Button>
      </View>
      {error && !sheetOpen ? (
        <Text className="text-[13px] text-terracotta">{error}</Text>
      ) : null}

      <LinkCandidatesSheet
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
