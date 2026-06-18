'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export type CoachmarkStep = {
  /** Valor del atributo `data-tour` del elemento a iluminar */
  target: string
  title: string
  body: string
  /** Paso de cierre: sin contador, el botón principal finaliza el tour */
  finale?: boolean
}

type CoachmarkLabels = {
  step: (current: number, total: number) => string
  next: string
  back: string
  skip: string
  finish: string
}

type CoachmarkTourProps = {
  steps: CoachmarkStep[]
  /** Contenedor donde se resuelven los targets (`[data-tour]`) */
  containerRef: React.RefObject<HTMLElement | null>
  labels: CoachmarkLabels
  onFinish: () => void
  onSkip: () => void
}

type Rect = { top: number; left: number; width: number; height: number }

const PAD = 6
const GAP = 12
const BUBBLE_W = 320

/**
 * CoachmarkTour: recorrido guiado tipo spotlight (estilo "reservas" de MP).
 *
 * Atenúa la pantalla y deja iluminado el elemento del paso actual (resuelto por
 * `data-tour` dentro de `containerRef`), con un globo que explica qué es y para
 * qué sirve. Sin dependencias externas: el "agujero" es un div con un
 * `box-shadow` enorme. Se re-mide ante scroll/resize para seguir al target.
 */
export function CoachmarkTour({ steps, containerRef, labels, onFinish, onSkip }: CoachmarkTourProps) {
  const [mounted, setMounted] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)

  const step = steps[index]
  const numberedTotal = steps.filter((s) => !s.finale).length

  // Intentional: defer the portal until after client mount to avoid SSR mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container || !step) return
    const el = container.querySelector(`[data-tour="${step.target}"]`)
    if (!el) {
      setRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [containerRef, step])

  // Al entrar a un paso: scrollear el target a la vista y medir.
  useLayoutEffect(() => {
    const container = containerRef.current
    const el = container?.querySelector(`[data-tour="${step?.target}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    measure()
    const raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [index, step, containerRef, measure])

  // Seguir al target ante scroll (incluye el del drawer) y resize.
  useEffect(() => {
    const onChange = () => measure()
    window.addEventListener('scroll', onChange, true)
    window.addEventListener('resize', onChange)
    return () => {
      window.removeEventListener('scroll', onChange, true)
      window.removeEventListener('resize', onChange)
    }
  }, [measure])

  // Esc = omitir.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onSkip()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSkip])

  if (!mounted || !step) return null

  const isLast = index === steps.length - 1
  const goNext = () => (isLast ? onFinish() : setIndex((i) => i + 1))
  const goBack = () => setIndex((i) => Math.max(0, i - 1))

  // Posición del globo: debajo del target salvo que esté en la mitad inferior.
  const vw = window.innerWidth
  const vh = window.innerHeight
  const bubbleW = Math.min(BUBBLE_W, vw - 24)
  let bubbleStyle: React.CSSProperties
  if (rect) {
    const placeAbove = rect.top > vh * 0.55
    const left = Math.min(Math.max(12, rect.left), vw - bubbleW - 12)
    const top = placeAbove ? undefined : rect.top + rect.height + GAP
    const bottom = placeAbove ? vh - rect.top + GAP : undefined
    bubbleStyle = { position: 'fixed', left, top, bottom, width: bubbleW, zIndex: 1002 }
  } else {
    // Sin target medible: centrar el globo.
    bubbleStyle = {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: bubbleW,
      zIndex: 1002,
    }
  }

  return createPortal(
    // pointer-events: auto re-habilita clicks: el Drawer (Radix modal) pone
    // pointer-events: none en el body y este portal es hermano del diálogo.
    <div aria-live="polite" role="dialog" aria-modal="true" style={{ pointerEvents: 'auto' }}>
      {/* Capa que bloquea la interacción con el form detrás */}
      <div className="fixed inset-0" style={{ zIndex: 1000 }} />

      {/* Spotlight: agujero iluminado sobre el target */}
      {rect && (
        <div
          style={{
            position: 'fixed',
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(11,26,43,0.55)',
            transition: 'all 0.25s ease',
            pointerEvents: 'none',
            zIndex: 1001,
          }}
        />
      )}

      {/* Globo */}
      <div
        ref={bubbleRef}
        style={bubbleStyle}
        className="rounded-2xl border border-border bg-card p-5 shadow-[0_18px_50px_-12px_rgba(11,26,43,0.45)]"
      >
        <div className="flex items-start justify-between gap-3">
          {!step.finale ? (
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-soft">
              {labels.step(steps.slice(0, index + 1).filter((s) => !s.finale).length, numberedTotal)}
            </span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onSkip}
            aria-label={labels.skip}
            className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-text-muted transition-colors hover:text-text"
          >
            <X size={16} />
          </button>
        </div>

        <h3 className="mt-1.5 text-[18px] font-extrabold leading-tight tracking-[-0.02em] text-text">
          {step.title}
        </h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-text-muted">{step.body}</p>

        {/* Dots de progreso */}
        <div className="mt-4 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s.target}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index ? 18 : 6,
                backgroundColor: i === index ? 'var(--navy, #0B1A2B)' : 'var(--border, #E2E6EC)',
              }}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="text-[13px] font-semibold text-text-muted transition-colors hover:text-text"
          >
            {labels.skip}
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="rounded-[11px] border border-border px-3.5 py-2 text-[14px] font-semibold text-text transition-colors hover:bg-border-soft"
              >
                {labels.back}
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="rounded-[11px] bg-navy px-4 py-2 text-[14px] font-bold text-white shadow-[0_8px_20px_-4px_rgba(11,26,43,0.30)] transition-opacity hover:opacity-90"
            >
              {isLast ? labels.finish : labels.next}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
