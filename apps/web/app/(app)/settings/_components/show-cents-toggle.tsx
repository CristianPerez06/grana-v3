'use client'

import { useTransition } from 'react'
import { setShowCents } from '@/app/_actions/preferences'

type Props = {
  initialValue: boolean
}

export const ShowCentsToggle = ({ initialValue }: Props) => {
  const [isPending, startTransition] = useTransition()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked
    startTransition(() => setShowCents(value))
  }

  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <div>
        <p className="text-sm font-medium">Mostrar centavos</p>
        <p className="text-xs text-muted-foreground">
          Muestra los decimales en los montos en pesos (ej: $333,34 en vez de $333).
        </p>
      </div>
      <button
        role="switch"
        aria-checked={isPending ? undefined : initialValue}
        onClick={() => {
          startTransition(() => setShowCents(!initialValue))
        }}
        disabled={isPending}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
          initialValue ? 'bg-primary' : 'bg-input'
        }`}
      >
        <span
          className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
            initialValue ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <input
        type="checkbox"
        className="sr-only"
        checked={initialValue}
        onChange={handleChange}
        aria-hidden="true"
      />
    </label>
  )
}
