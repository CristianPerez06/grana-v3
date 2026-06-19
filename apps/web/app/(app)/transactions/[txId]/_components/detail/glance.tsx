import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// Primitivas de la grilla "de un vistazo". Valores portados de
// detalle-movimiento/panel.css: grilla 2-col desktop / 1-col mobile, tiles en
// cards blancos (radius 18→20px, padding 20/18 → 24/26), eyebrow uppercase.

export const Glance = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">{children}</div>
)

type TileProps = {
  children: ReactNode
  /** Full-width tile (spans both columns on desktop). */
  span2?: boolean
  className?: string
}

export const Tile = ({ children, span2, className }: TileProps) => (
  <section
    className={cn(
      'rounded-[18px] border border-border bg-card px-[18px] py-5 sm:rounded-[20px] sm:px-[26px] sm:py-6',
      span2 && 'sm:col-span-2',
      className,
    )}
  >
    {children}
  </section>
)

export const Eyebrow = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span
    className={cn(
      'text-[11px] font-extrabold uppercase tracking-[0.13em] text-text-muted',
      className,
    )}
  >
    {children}
  </span>
)

type TileHeadProps = {
  eyebrow: ReactNode
  /** Right-aligned secondary text (e.g. "$ 180.000 / mes"). */
  aside?: ReactNode
  asideMuted?: boolean
}

export const TileHead = ({ eyebrow, aside, asideMuted }: TileHeadProps) => (
  <div className="mb-[18px] flex items-center gap-2.5">
    <Eyebrow>{eyebrow}</Eyebrow>
    {aside != null && (
      <span
        className={cn(
          'ml-auto text-[13px] tabular-nums',
          asideMuted ? 'font-semibold text-text-muted' : 'font-bold text-text',
        )}
      >
        {aside}
      </span>
    )}
  </div>
)

// ── Chip (hero + inline) ─────────────────────────────────────────────────────
// .hchip: 13.5px/700, pill, bg field; variante `tone` con bg/tinte del tono.

export const Chip = ({
  children,
  tone,
  className,
}: {
  children: ReactNode
  /** Tonal variant: tinted bg + deep text from the active `--tone`. */
  tone?: boolean
  className?: string
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold sm:text-[13.5px]',
      tone ? 'bg-[var(--tone-soft)] text-[var(--tone-deep)]' : 'bg-border-soft text-text',
      className,
    )}
  >
    {children}
  </span>
)

// ── DetailRow: fila clave/valor del tile "Detalle" ───────────────────────────
// .drow: ícono cuadrado 33px (bg field, ícono slate) + clave (13px muted) +
// valor (14.5px/700). Valor opcional a la derecha (`right`).

type DetailRowProps = {
  icon: ReactNode
  label: ReactNode
  value: ReactNode
  /** Optional right-aligned secondary pair (label + value). */
  rightLabel?: ReactNode
  rightValue?: ReactNode
  /** Drop the top border (first row of a stack). */
  first?: boolean
}

export const DetailRow = ({ icon, label, value, rightLabel, rightValue, first }: DetailRowProps) => (
  <div
    className={cn(
      'flex items-start gap-3 py-3',
      !first && 'border-t border-border',
    )}
  >
    <span className="mt-0.5 grid size-[33px] shrink-0 place-items-center rounded-[10px] bg-border-soft text-slate">
      {icon}
    </span>
    {/* En celular el valor de la derecha se apila debajo; en desktop va a la derecha. */}
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-text-muted">{label}</div>
        <div className="mt-px text-[14.5px] font-bold tracking-[-0.1px] text-text">{value}</div>
      </div>
      {rightValue != null && (
        <div className="min-w-0 sm:ml-auto sm:text-right">
          {rightLabel != null && (
            <div className="text-[13px] font-semibold text-text-muted">{rightLabel}</div>
          )}
          <div className="mt-px text-[14.5px] font-bold tracking-[-0.1px] text-text tabular-nums">
            {rightValue}
          </div>
        </div>
      )}
    </div>
  </div>
)

// Estado real (Reintegrado / Acreditado / Completada): punto verde + label. Solo
// se usa cuando el estado informa algo real — no existe "confirmado".
export const StatusDot = ({ label }: { label: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 text-[14.5px] font-bold text-emerald-deep">
    <Check size={15} strokeWidth={2.6} aria-hidden />
    {label}
  </span>
)
