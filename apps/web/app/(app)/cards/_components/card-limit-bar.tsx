/**
 * Credit-limit usage bar, tinted with the card's accent color (`--cc-accent`).
 * Pure presentational: the caller passes the already-computed percentage.
 * Rendered only when the card has a limit loaded (the caller guards `null`).
 */
type Props = {
  /** Used percentage, 0–100 (already clamped by the caller). */
  percent: number
  /** Accent CSS color for the fill (per-card, from resolveAccountAvatar). */
  accent: string
  className?: string
}

export const CardLimitBar = ({ percent, accent, className = '' }: Props) => (
  <div className={`h-1.5 w-full overflow-hidden rounded-full bg-border-soft ${className}`}>
    <div
      className="h-full rounded-full transition-all"
      style={{ width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: accent }}
    />
  </div>
)
