'use client'

import type { ShowCentsToggleProps } from '@grana/ui-contracts'

export const ShowCentsToggle = ({
  value,
  onValueChange,
  disabled = false,
  label,
  description,
}: ShowCentsToggleProps) => {
  const handleClick = () => {
    if (disabled) return
    onValueChange(!value)
  }

  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={handleClick}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
          value ? 'bg-primary' : 'bg-input'
        }`}
      >
        <span
          className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <input
        type="checkbox"
        className="sr-only"
        checked={value}
        onChange={(e) => onValueChange(e.target.checked)}
        aria-hidden="true"
      />
    </label>
  )
}
