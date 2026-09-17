'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import type { LinkCandidate } from '@grana/recurrences'
import {
  getRecurrenceLinkCandidates,
  registerRecurrenceAhead,
} from '@/app/_actions/recurrences'
import { LinkCandidatesDrawer } from './link-candidates-drawer'

type Props = {
  recurrenceId: string
  /** El vencimiento. NO se mueve: la fecha de pago es otro hecho. */
  dueDate: string
  ruleAmount: number
  ruleCurrency: string
  shared: boolean
}

/**
 * LAS DOS SALIDAS QUE ANTES NO EXISTÍAN, en la fila del vencimiento que todavía
 * no llegó.
 *
 * Hasta ahora esta tarjeta decía «Solo informativo» y no ofrecía nada: quien
 * pagaba el alquiler el 3 tenía que esperar al 23 o cargar el gasto a mano — y
 * cargarlo a mano es peor, porque el 23 la app se lo vuelve a proponer.
 *
 * Registrar el pago acá NO adelanta el calendario: el próximo vencimiento sigue
 * siendo el que la regla ya preveía.
 */
export const ResolveAheadActions = ({
  recurrenceId,
  dueDate,
  ruleAmount,
  ruleCurrency,
  shared,
}: Props) => {
  const t = useTranslations('recurrences.link')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [candidates, setCandidates] = useState<LinkCandidate[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [widened, setWidened] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // La lectura vive acá, disparada por el click, y no en un efecto del drawer:
  // un efecto que setea estado al abrirse es exactamente el patrón que el lint
  // del repo prohíbe, y además deja la carga atada al montaje en vez de a la
  // intención del usuario.
  const load = (widen: boolean) => {
    setCandidates(null)
    setLoadError(false)
    getRecurrenceLinkCandidates(recurrenceId, dueDate, widen)
      .then(setCandidates)
      .catch(() => {
        // «No hay» y «no sabemos» no son lo mismo: confundirlos manda al usuario
        // a cargar el gasto de nuevo, que es el duplicado que queremos evitar.
        setCandidates([])
        setLoadError(true)
      })
  }

  const openDrawer = () => {
    setWidened(false)
    setDrawerOpen(true)
    load(false)
  }

  const widen = () => {
    setWidened(true)
    load(true)
  }

  const payNow = () => {
    setError(null)
    startTransition(async () => {
      const result = await registerRecurrenceAhead({ recurrenceId, dueDate })
      if (!result.ok) setError(result.formError ?? null)
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onPress={payNow} disabled={pending}>
          {t('already_paid')}
        </Button>
        <Button variant="ghost" onPress={openDrawer} disabled={pending}>
          {t('already_loaded')}
        </Button>
      </div>
      {error ? (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      ) : null}

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
      />
    </>
  )
}
