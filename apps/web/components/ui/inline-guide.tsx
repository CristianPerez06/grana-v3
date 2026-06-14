'use client'

import { X } from 'lucide-react'
import { useGuidance } from '@/lib/guidance/hooks'
import type { GuidanceId } from '@/lib/guidance/catalog'

type InlineGuideProps = {
  guidanceId: GuidanceId
  children: React.ReactNode
}

/**
 * InlineGuide: Hint pequeño debajo de un campo de formulario
 *
 * - Texto gris, 12px
 * - Dismissible con X
 * - Se oculta si fue dismissido o completado
 */
export function InlineGuide({ guidanceId, children }: InlineGuideProps) {
  const { isVisible, mark } = useGuidance(guidanceId)

  if (!isVisible) {
    return null
  }

  return (
    <div className="flex items-start gap-2 mt-2 px-0.5">
      <p className="text-xs text-text-muted flex-1 leading-relaxed">{children}</p>
      <button
        type="button"
        onClick={() => mark('dismissed')}
        className="shrink-0 text-text-muted hover:text-text transition-colors p-0.5"
        aria-label="Dismiss hint"
      >
        <X size={14} />
      </button>
    </div>
  )
}
