'use client'

import { useGuidance } from '@/lib/guidance/hooks'
import { Button } from '@/components/ui/button'
import type { GuidanceId } from '@/lib/guidance/catalog'

type GuideCardProps = {
  guidanceId: GuidanceId
  title: string
  description: string
  primaryCta: {
    label: string
    onClick: () => void
  }
  secondaryCta?: {
    label: string
    onClick: () => void
  }
}

/**
 * GuideCard: Sugerencia educativa con dos CTAs
 *
 * - Fondo subtil
 * - CTA principal marca como "completed"
 * - CTA secundaria marca como "dismissed"
 * - Se oculta si fue dismissido o completado
 */
export function GuideCard({
  guidanceId,
  title,
  description,
  primaryCta,
  secondaryCta,
}: GuideCardProps) {
  const { isVisible, mark } = useGuidance(guidanceId)

  if (!isVisible) {
    return null
  }

  const handlePrimaryCta = async () => {
    await mark('completed')
    primaryCta.onClick()
  }

  const handleSecondaryCta = async () => {
    await mark('dismissed')
    secondaryCta?.onClick()
  }

  return (
    <div className="rounded-lg border border-border bg-surface-soft p-4 flex flex-col gap-3">
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-sm text-text-muted mt-1">{description}</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handlePrimaryCta}>
          {primaryCta.label}
        </Button>
        {secondaryCta && (
          <Button size="sm" variant="ghost" onClick={handleSecondaryCta}>
            {secondaryCta.label}
          </Button>
        )}
      </div>
    </div>
  )
}
