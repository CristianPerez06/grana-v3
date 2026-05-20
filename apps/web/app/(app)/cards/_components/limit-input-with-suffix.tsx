'use client'

import { MoneyAmountInput } from '@/components/ui/money-amount-input'

type Props = {
  value: string
  onChange: (value: string) => void
  error?: string
}

export const LimitInputWithSuffix = ({ value, onChange, error }: Props) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex rounded-md border border-input overflow-hidden focus-within:ring-2 focus-within:ring-ring">
      <MoneyAmountInput
        value={value}
        onChange={onChange}
        placeholder="Opcional"
        className="flex-1 bg-background px-3 py-2 text-sm focus:outline-none"
      />
      <span className="flex items-center px-3 bg-muted text-sm text-muted-foreground border-l border-input select-none">
        ARS
      </span>
    </div>
    <p className="text-xs text-muted-foreground">
      El límite aplica en pesos. Los consumos en dólares se convierten al TC del día.
    </p>
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
)
