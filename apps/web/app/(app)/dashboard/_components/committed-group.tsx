'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MaskedAmount } from './masked-amount'

type Props = {
  icon: React.ReactNode
  iconClassName: string
  label: string
  sub: string
  ars: number
  usd: number
  children: React.ReactNode
}

/**
 * One collapsible group of the "Compromisos" card (Tarjetas / Gastos fijos).
 *
 * The header is a real `<button>` with `aria-expanded` and `aria-controls`
 * pointing at the panel — the prototype toggled a class on a div, which gives a
 * screen reader nothing to announce and no way to operate. State lives in React,
 * not in the DOM. `min-h-11` keeps the touch target at 44px on mobile.
 */
export const CommittedGroup = ({
  icon,
  iconClassName,
  label,
  sub,
  ars,
  usd,
  children,
}: Props) => {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-border-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', iconClassName)}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-extrabold text-text">{label}</span>
          <span className="block truncate text-[11.5px] font-semibold text-text-soft">{sub}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[16.5px] font-extrabold tracking-tight text-text">
            <MaskedAmount amount={ars} currency="ARS" />
          </span>
          {usd !== 0 && (
            <span className="block text-[11px] font-semibold text-text-soft">
              <MaskedAmount amount={usd} currency="USD" showCentsOverride />
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          size={16}
          className={cn(
            'shrink-0 text-text-soft transition-transform duration-[180ms] ease-out',
            open && 'rotate-180',
          )}
        />
      </button>

      <div id={panelId} hidden={!open} className="px-3.5 pb-3">
        {children}
      </div>
    </div>
  )
}
