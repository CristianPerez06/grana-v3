type Props = {
  message: string
}

export const SectionFallback = ({ message }: Props) => (
  <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-text-muted shadow-sm">
    {message}
  </div>
)
