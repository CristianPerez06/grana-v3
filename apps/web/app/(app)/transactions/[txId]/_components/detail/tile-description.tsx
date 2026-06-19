import { FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Tile, Eyebrow } from './glance'

// Tile "Descripción" (texto libre del movimiento). Rótulo "Descripción" (no
// "Nota"). Sin botón de edición inline: la edición vive en la acción global
// "Editar" de la topbar.

export const TileDescription = ({ description }: { description: string | null }) => {
  const t = useTranslations('transactions.detail')
  if (!description?.trim()) return null

  return (
    <Tile span2>
      <div className="flex items-start gap-3.5">
        <span className="grid size-[37px] shrink-0 place-items-center rounded-[11px] bg-warning-soft text-warning">
          <FileText size={18} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Eyebrow className="mb-1.5 block">{t('labels.description')}</Eyebrow>
          <p className="text-[14.5px] font-medium leading-[1.55] text-text">{description}</p>
        </div>
      </div>
    </Tile>
  )
}
