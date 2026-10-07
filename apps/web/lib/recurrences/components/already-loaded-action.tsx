'use client'

import { useRef, useState, type ReactNode } from 'react'
import type { LinkCandidate } from '@grana/recurrences'
import { getRecurrenceLinkCandidates } from '@/app/_actions/recurrences'
import { LinkCandidatesDrawer } from './link-candidates-drawer'

type Props = {
  recurrenceId: string
  /** El vencimiento. NO se mueve: la fecha de pago es otro hecho. */
  dueDate: string
  ruleAmount: number
  ruleCurrency: string
  /** La regla es compartida: vincular un movimiento personal lo convierte. */
  shared: boolean
  /** Quien lo monta dice cómo avisar, e invalida lo que su pantalla lee. */
  onLinked: () => void
  /**
   * El botón lo dibuja quien lo monta, con la escala de su fila: el hub usa
   * botones `xs` de media fila, el bloque de por revisar los `sm` de sus filas.
   */
  renderTrigger: (open: () => void) => ReactNode
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
}: {
  render: Props['renderTrigger']
  open: () => void
}) => <>{render(open)}</>

/**
 * «YA LO TENGO CARGADO», UNA SOLA VEZ PARA TODA LA APP WEB: el hub, la ficha de
 * la regla y el bloque de vencimientos por revisar montan esta pieza. Lo que
 * importa que no se copie es la lectura de candidatos —con su protección contra
 * respuestas viejas—, porque una copia que la pierda muestra una lista que no
 * es la pedida y el usuario carga el movimiento de nuevo: el duplicado que esta
 * acción existe para evitar.
 *
 * Toma la regla y el vencimiento, no una fila de ocurrencia: vincular resuelve
 * igual un vencimiento que todavía no existe que uno que ya está pendiente.
 */
export const AlreadyLoadedAction = ({
  recurrenceId,
  dueDate,
  ruleAmount,
  ruleCurrency,
  shared,
  onLinked,
  renderTrigger,
}: Props) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [candidates, setCandidates] = useState<LinkCandidate[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [widened, setWidened] = useState(false)

  // La lectura vive acá, disparada por el click, y no en un efecto del drawer:
  // un efecto que setea estado al abrirse es exactamente el patrón que el lint
  // del repo prohíbe, y además deja la carga atada al montaje en vez de a la
  // intención del usuario.
  // SÓLO CONTESTA LA ÚLTIMA BÚSQUEDA PEDIDA. «Ampliar» se ofrece también
  // mientras la primera está en vuelo, así que las dos pueden convivir: si la
  // angosta llega después, pisa la lista ampliada y el cartel sigue diciendo
  // «ampliada» sobre resultados que no lo son. El usuario no ve su movimiento y
  // lo carga de nuevo — el duplicado que esta pantalla existe para evitar.
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
        // «No hay» y «no sabemos» no son lo mismo: confundirlos manda al usuario
        // a cargar el gasto de nuevo, que es el duplicado que queremos evitar.
        setCandidates([])
        setLoadError(true)
      })
  }

  const open = () => {
    setWidened(false)
    setDrawerOpen(true)
    load(false)
  }

  const widen = () => {
    setWidened(true)
    load(true)
  }

  return (
    <>
      <TriggerSlot render={renderTrigger} open={open} />
      <LinkCandidatesDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        recurrenceId={recurrenceId}
        dueDate={dueDate}
        ruleAmount={ruleAmount}
        ruleCurrency={ruleCurrency}
        shared={shared}
        candidates={candidates}
        loadError={loadError}
        widened={widened}
        onWiden={widen}
        onLinked={onLinked}
      />
    </>
  )
}
