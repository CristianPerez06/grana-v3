type Props = {
  className?: string
}

export const EstimatedDateBadge = ({ className = '' }: Props) => (
  <span
    className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className}`}
    title="Fechas estimadas"
  >
    <span>📅</span>
    <span>Estimado</span>
  </span>
)
