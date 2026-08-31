'use client'

import { useTranslations } from 'next-intl'
import { ChevronLeft } from 'lucide-react'

/**
 * Encabezado con vuelta atrás, para las vistas que el drawer apila.
 *
 * Mismo control de 44×44 con borde que ya usa el formulario en su pie: la flecha
 * tipográfica suelta que había antes no se veía y su área táctil quedaba por
 * debajo del mínimo del repo. Acá va arriba porque estas vistas no terminan en
 * un CTA — se sale de ellas volviendo, no confirmando.
 */
export function DrawerBackHeader({
  title,
  icon,
  onBack,
  action,
}: {
  title: string
  /**
   * Emblema a la izquierda del título, cuando la vista es de una cosa que ya
   * tenía cara en la pantalla anterior. Es lo que confirma que se entró a donde
   * se quería sin releer el nombre.
   */
  icon?: React.ReactNode
  onBack: () => void
  /** Acción secundaria a la derecha, cuando la vista tiene una. */
  action?: React.ReactNode
}) {
  const t = useTranslations('savings')

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        aria-label={t('back')}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-text-muted transition-colors hover:bg-border-soft hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      {icon}
      <h2 className="min-w-0 flex-1 truncate text-[21px] font-extrabold tracking-[-0.025em] text-text">
        {title}
      </h2>
      {action}
    </div>
  )
}
