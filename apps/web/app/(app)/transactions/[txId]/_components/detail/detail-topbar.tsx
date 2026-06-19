import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

// Topbar del detalle: "Volver" a la izquierda + slot de acciones a la derecha.
// En mobile es sticky (la lista vive abajo); en desktop fluye con la página.

type Props = {
  backHref: string
  backLabel: string
  actions?: ReactNode
}

export const DetailTopbar = ({ backHref, backLabel, actions }: Props) => (
  <div className="mb-4 flex items-center justify-between gap-3 max-sm:sticky max-sm:top-0 max-sm:z-20 max-sm:border-b max-sm:border-border-soft max-sm:bg-page max-sm:py-2.5 sm:mb-[22px]">
    <Link
      href={backHref}
      className="inline-flex items-center gap-2 rounded-[10px] py-2 pl-1.5 pr-3 text-[14.5px] font-bold text-text-muted transition-colors hover:bg-border-soft hover:text-text"
    >
      <ChevronLeft size={17} strokeWidth={2.4} aria-hidden />
      {backLabel}
    </Link>
    {actions != null && <div className="flex items-center gap-1.5">{actions}</div>}
  </div>
)
