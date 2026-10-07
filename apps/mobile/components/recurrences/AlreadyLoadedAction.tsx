import { useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { LinkCandidate } from '@grana/recurrences'
import { useT } from '../../lib/locale-context'
import {
  getRecurrenceLinkCandidates,
  linkMovementToRecurrence,
} from '../../lib/recurrences/mutators'
import { invalidateAfterRecurrenceResolution } from '../../lib/recurrences/invalidate'
import { LinkCandidatesSheet } from './LinkCandidatesSheet'

type Props = {
  recurrenceId: string
  /** El vencimiento. NO se mueve: la fecha de pago es otro hecho. */
  dueDate: string
  ruleAmount: number
  ruleCurrency: string
  /** La regla es compartida: un movimiento personal se convierte al vincularlo. */
  shared: boolean
  /** Quien lo monta dice cómo avisar; la invalidación ya la hace esta pieza. */
  onLinked: () => void
  /**
   * El botón lo dibuja quien lo monta, con la escala de su fila. `busy` está en
   * true mientras se escribe el vínculo, para que la fila no ofrezca otra acción
   * sobre el mismo vencimiento a mitad de camino.
   */
  renderTrigger: (open: () => void, busy: boolean) => ReactNode
}

/**
 * THE TRIGGER GOES THROUGH A COMPONENT, not a call during render. `open` reads
 * the request counter (a ref), and calling `renderTrigger(open)` inline hands a
 * ref-reading function to code that runs while rendering — which the React
 * compiler's lint rejects, rightly. As a prop of a stable component it is an
 * event handler again, and the render-prop API stays the same for the callers.
 */
const TriggerSlot = ({
  render,
  open,
  busy,
}: {
  render: Props['renderTrigger']
  open: () => void
  busy: boolean
}) => <>{render(open, busy)}</>

/**
 * «YA LO TENGO CARGADO», UNA SOLA VEZ PARA TODA LA APP NATIVA — gemelo de web.
 * El hub, el detalle de la regla y el bloque de vencimientos por revisar montan
 * esta pieza, y ninguno copia la lectura de candidatos: una copia que pierda la
 * protección contra respuestas viejas muestra una lista que no es la pedida, y
 * el usuario carga el movimiento de nuevo.
 *
 * LA INVALIDACIÓN VIVE ACÁ, no en quien la monta: cuando la pasaban como prop,
 * una pantalla eligió el helper angosto y el saldo quedó viejo.
 */
export function AlreadyLoadedAction({
  recurrenceId,
  dueDate,
  ruleAmount,
  ruleCurrency,
  shared,
  onLinked,
  renderTrigger,
}: Props) {
  const t = useT()
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
  const [pending, setPending] = useState(false)

  // La lectura la dispara el toque, no un efecto de montaje.
  // SÓLO CONTESTA LA ÚLTIMA BÚSQUEDA PEDIDA, gemelo de web: «ampliar» se ofrece
  // también mientras la primera está en vuelo, y una respuesta angosta tardía
  // pisaba la lista ampliada dejando el cartel diciendo «ampliada» sobre
  // resultados que no lo son.
  const requestRef = useRef(0)

  const load = (widen: boolean) => {
    const token = ++requestRef.current
    setCandidates(null)
    setLoadError(false)
    getRecurrenceLinkCandidates(recurrenceId, dueDate, widen)
      .then((rows) => {
        if (token !== requestRef.current) return
        setCandidates(rows)
      })
      .catch(() => {
        if (token !== requestRef.current) return
        // «No hay» y «no sabemos» no son lo mismo.
        setCandidates([])
        setLoadError(true)
      })
  }

  const open = () => {
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

  // CERRAR ES EMPEZAR DE NUEVO, como el drawer de web: un rechazo se lee dentro
  // de la hoja, y no sobrevive a cerrarla.
  const close = () => {
    setError(null)
    setSheetOpen(false)
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
    invalidateAfterRecurrenceResolution(queryClient)
    onLinked()
  }

  return (
    <>
      <TriggerSlot render={renderTrigger} open={open} busy={pending} />
      <LinkCandidatesSheet
        key={`link-${sheetKey}`}
        visible={sheetOpen}
        onClose={close}
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
        error={error}
      />
    </>
  )
}
