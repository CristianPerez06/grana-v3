import { Info } from 'lucide-react'

/**
 * Neutral hi-fi form primitives shared by the drawer forms (cards + accounts).
 * They live here — not inside any one module — so the create/edit drawers across
 * modules stay pixel-identical and no module depends on another for its chrome.
 */

// Canonical drawer field surface (#FAFBFC sits between the white card and the
// page bg); no token maps to it exactly, so it stays a shared literal.
export const FIELD_BG = '#FAFBFC'

export const SectionLabel = ({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) => (
  <p
    className={`mx-0.5 mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.09em] text-text-soft ${className}`}
  >
    {children}
  </p>
)

export const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.05em] text-text-soft">{children}</p>
)

export const FieldIcon = ({ children }: { children: React.ReactNode }) => (
  <span
    className="flex size-9 shrink-0 items-center justify-center rounded-[11px] text-text-muted"
    style={{ backgroundColor: FIELD_BG }}
  >
    {children}
  </span>
)

export const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="mx-0.5 mt-[9px] flex items-start gap-1.5 text-xs leading-snug text-text-muted">
    <Info className="mt-0.5 size-3.5 shrink-0 text-text-soft" aria-hidden />
    {children}
  </p>
)
