'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { LinkCandidate } from '@grana/recurrences'
import { Drawer } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { linkMovementToRecurrence } from '@/app/_actions/recurrences'

type Props = {
  open: boolean
  onClose: () => void
  recurrenceId: string
  dueDate: string
  /** Lo que la regla suponía, para poder decir en qué difiere el movimiento. */
  ruleAmount: number
  ruleCurrency: string
  /** La regla es compartida: vincular un movimiento personal lo convierte. */
  shared: boolean
  /**
   * `null` mientras se está leyendo. Una lista VACÍA y una lista que todavía no
   * llegó no son lo mismo, y mostrar «no hay nada» mientras se carga es lo que
   * empuja al usuario a cargar el gasto de nuevo.
   */
  candidates: LinkCandidate[] | null
  loadError: boolean
  widened: boolean
  onWiden: () => void
  onLinked?: () => void
}

const money = (amount: number, currency: string) =>
  currency === 'ARS' ? formatARS(amount, false) : formatUSD(amount, false)

const formatDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

/**
 * ELEGIR UN MOVIMIENTO QUE YA EXISTE, sin convertir la pantalla en un buscador.
 *
 * La lista inicial la arma el servidor sobre la ventana del calendario de la
 * regla. «Ampliar la búsqueda» está SIEMPRE, no sólo cuando la lista queda vacía:
 * un movimiento puede estar fuera de la ventana y ser el correcto, y descubrir
 * que no hay forma de llegar a él es lo que empuja a cargarlo de nuevo.
 *
 * El importe distinto se MUESTRA, no se advierte: que el alquiler haya aumentado
 * es el caso normal, y ponerle un triángulo amarillo lo trata como un error.
 */
export const LinkCandidatesDrawer = ({
  open,
  onClose,
  recurrenceId,
  dueDate,
  ruleAmount,
  ruleCurrency,
  shared,
  candidates,
  loadError,
  widened,
  onWiden,
  onLinked,
}: Props) => {
  const t = useTranslations('recurrences.link')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<LinkCandidate | null>(null)
  const [pending, startTransition] = useTransition()

  // CERRAR ES EMPEZAR DE NUEVO. La confirmación de conversión y el error viven
  // dentro de este componente, que no se desmonta al cerrarse: sin limpiarlos,
  // volver a abrir mostraba la confirmación del movimiento anterior —de otro
  // vencimiento, incluso— en lugar de la lista.
  const close = () => {
    setConfirming(null)
    setError(null)
    onClose()
  }

  const commit = (candidate: LinkCandidate, confirmConversion: boolean) => {
    setError(null)
    startTransition(async () => {
      const result = await linkMovementToRecurrence({
        recurrenceId,
        dueDate,
        transactionId: candidate.id,
        confirmConversion,
      })
      if (!result.ok) {
        setError(result.formError ?? null)
        setConfirming(null)
        return
      }
      onLinked?.()
      close()
    })
  }

  const pick = (candidate: LinkCandidate) => {
    // Convertir un movimiento personal en compartido mueve la deuda con la otra
    // persona. Nunca en silencio.
    if (shared && candidate.needs_conversion) {
      setConfirming(candidate)
      return
    }
    commit(candidate, false)
  }

  return (
    <Drawer open={open} onClose={close} ariaLabel={t('candidates_title')}>
      {/* `min-h-0 flex-1`, NO `h-full`. A ancho de teléfono el Drawer es una hoja
          cuya altura la fija su contenido con un tope (`max-h-[90dvh]`), y contra
          un padre de altura automática un `h-full` no vale nada: el cuerpo crece
          con la lista, el panel la recorta y NO HAY NADA QUE SCROLLEAR. Con
          `min-h-0` el cuerpo puede achicarse hasta el tope del panel, y recién
          ahí la región de scroll de abajo recibe una altura y scrollea.

          En escritorio no se notaba porque el panel ocupa toda la altura de la
          pantalla (`md:h-dvh`), así que el `h-full` sí resolvía. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-[17px] font-bold tracking-[-0.01em] text-text">
            {t('candidates_title')}
          </h2>
          <p className="mt-0.5 text-[13px] text-text-muted">
            {t('candidates_subtitle', { date: formatDay(dueDate) })}
          </p>
        </header>

        {confirming ? (
          <div className="flex flex-1 flex-col gap-3 px-5 py-5">
            <h3 className="text-[15px] font-bold text-text">{t('convert_title')}</h3>
            <p className="text-[13.5px] text-text-muted">{t('convert_body')}</p>
            {/* APILADOS, no en una fila: el `Button` es `w-full`, así que dos en
                la misma línea se llevan media hoja cada uno y el texto de
                confirmar —que es una frase, no una palabra— no entra. El gemelo
                nativo hace lo mismo. */}
            <div className="mt-2 flex flex-col gap-2">
              <Button onPress={() => commit(confirming, true)} disabled={pending}>
                {pending ? t('linking') : t('convert_confirm')}
              </Button>
              <Button variant="ghost" onPress={() => setConfirming(null)} disabled={pending}>
                {t('convert_cancel')}
              </Button>
            </div>
            {error ? <Alert variant="error">{error}</Alert> : null}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {error || loadError ? (
              <div className="px-5 pt-4">
                <Alert variant="error">{error ?? t('candidates_empty')}</Alert>
              </div>
            ) : null}

            {candidates == null ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : candidates.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-text-muted">
                {t('candidates_empty')}
              </p>
            ) : (
              <ul>
                {candidates.map((candidate) => {
                  const differs = Math.abs(candidate.amount - ruleAmount) > 0.004
                  return (
                    <li
                      key={candidate.id}
                      className="[&+&]:border-t [&+&]:border-[var(--border-soft)]"
                    >
                      <button
                        type="button"
                        onClick={() => pick(candidate)}
                        disabled={pending}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-page/50 disabled:opacity-60"
                      >
                        <div className="flex min-w-0 flex-1 flex-col">
                          {/* Sin descripción se dice que no la tiene. Caer en la
                              fecha la imprimía dos veces seguidas, una como
                              nombre y otra como subtítulo, y esa fila no decía
                              nada de lo que se está eligiendo. */}
                          <span className="truncate text-[14.5px] font-semibold text-text">
                            {candidate.description?.trim() || t('no_description')}
                          </span>
                          <span className="text-[12.5px] text-text-muted">
                            {formatDay(candidate.date)}
                          </span>
                          {differs ? (
                            <span className="mt-0.5 text-[12px] text-text-soft">
                              {t('amount_differs', {
                                ruleAmount: money(ruleAmount, ruleCurrency),
                                amount: money(candidate.amount, candidate.currency_code),
                              })}
                            </span>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-[14.5px] font-bold tabular-nums text-text">
                          {money(candidate.amount, candidate.currency_code)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {/* Siempre disponible, no sólo cuando la lista queda vacía. */}
            <div className="border-t border-[var(--border-soft)] px-5 py-3">
              {widened ? (
                <p className="text-[12.5px] text-text-soft">{t('widened')}</p>
              ) : (
                <Button variant="ghost" onPress={onWiden} disabled={pending}>
                  {t('widen')}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  )
}
