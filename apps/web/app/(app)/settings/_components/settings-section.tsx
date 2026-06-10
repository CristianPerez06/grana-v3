import type { SettingsSectionProps } from '@grana/ui-contracts'

export const SettingsSection = ({
  title,
  children,
  className,
}: SettingsSectionProps) => {
  return (
    <section className={`flex flex-col gap-2.5 ${className ?? ''}`}>
      <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-text-muted">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {children}
      </div>
    </section>
  )
}
