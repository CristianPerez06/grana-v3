import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type CurvedNavyHeaderProps = {
  title: string
  subtitle?: string
  showBack?: boolean
  backHref?: string
  backLabel?: string
  className?: string
}

const CurvedNavyHeader = ({
  title,
  subtitle,
  showBack,
  backHref,
  backLabel = 'Volver',
  className,
}: CurvedNavyHeaderProps) => (
  <header className={cn('relative bg-navy text-white pt-8 pb-10 px-5', className)}>
    <div className="mx-auto w-full max-w-[430px]">
      {showBack && backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1 text-navy-muted text-sm font-medium hover:text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>{backLabel}</span>
        </Link>
      )}
      <h1 className="text-2xl font-bold leading-tight">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-sm text-navy-muted leading-snug">{subtitle}</p>
      )}
    </div>
    <svg
      viewBox="0 0 380 32"
      preserveAspectRatio="none"
      aria-hidden
      className="absolute inset-x-0 -bottom-[3px] block h-8 w-full"
    >
      <path d="M0,0 Q190,42 380,0 L380,32 L0,32 Z" fill="var(--page)" />
    </svg>
  </header>
)

export { CurvedNavyHeader }
export type { CurvedNavyHeaderProps }
