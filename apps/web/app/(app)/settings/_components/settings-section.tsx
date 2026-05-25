import type { SettingsSectionProps } from '@grana/ui-contracts'

export const SettingsSection = ({
  title,
  children,
  className,
}: SettingsSectionProps) => {
  return (
    <section className={`flex flex-col gap-4 ${className ?? ''}`}>
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      <div className="rounded-lg border border-border bg-card p-4">
        {children}
      </div>
    </section>
  )
}
