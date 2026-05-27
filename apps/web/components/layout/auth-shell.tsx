import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { GranaLogo } from '@/components/ui/grana-logo'

type AuthShellProps = {
  title: string
  subtitle?: string
  children: ReactNode
  contentClassName?: string
}

/**
 * Shell del grupo de rutas `(auth)`: una tarjeta centrada minimalista sobre un
 * fondo limpio. La tarjeta se funde con el fondo (sin borde ni sombra) bajo
 * `sm` y se muestra como tarjeta con hairline + sombra suave en `sm+`.
 */
const AuthShell = ({
  title,
  subtitle,
  children,
  contentClassName,
}: AuthShellProps) => (
  <div className="min-h-screen flex flex-col bg-page">
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div
        className={cn(
          'w-full max-w-[420px] rounded-[var(--radius-4xl)] bg-card px-6 py-9',
          'sm:border sm:border-border sm:px-10 sm:py-11',
          'sm:shadow-[0_1px_2px_rgba(11,26,43,0.04),0_12px_32px_rgba(11,26,43,0.06)]',
          contentClassName,
        )}
      >
        <div className="flex flex-col items-center text-center">
          <GranaLogo width={104} className="mb-6" />
          <h1 className="text-2xl font-bold tracking-tight text-text">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm leading-snug text-text-muted">{subtitle}</p>
          )}
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </main>
  </div>
)

export { AuthShell }
export type { AuthShellProps }
