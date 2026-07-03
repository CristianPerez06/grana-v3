'use client'

import { type ReactNode, useState } from 'react'
import * as RadixPopover from '@radix-ui/react-popover'
import { Check, ChevronDown } from 'lucide-react'

export type FilterSelectOption = {
  value: string
  label: string
  /** Optional leading visual (category emoji chip, account avatar, …). */
  leading?: ReactNode
}

/**
 * Styled single-select for the movement-filters sheet. The library has no
 * generic `Select` primitive (see `DebitAccountSelect`), so — like the
 * cards/accounts pickers — this is a Radix Popover dropdown that can render
 * rich option content (a leading visual + label) instead of a plain native
 * `<select>`. The `null` value maps to the "all / no filter" row at the top.
 *
 * Portals to `document.body`, so it renders above the raw filter-sheet overlay
 * (which closes only on backdrop clicks, never on the portalled popover).
 */
export const FilterSelect = ({
  value,
  onChange,
  options,
  allLabel,
  ariaLabel,
}: {
  value: string | null
  onChange: (value: string | null) => void
  options: FilterSelectOption[]
  /** Label for the "no filter" state, shown as the top row and when nothing is selected. */
  allLabel: string
  ariaLabel: string
}) => {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value) ?? null

  const rowCls = (active: boolean) =>
    `flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors hover:bg-page ${
      active ? 'bg-page' : ''
    }`

  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="flex h-11 w-full items-center gap-2.5 rounded-[12px] border border-input bg-background px-3 text-left text-sm transition-colors hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {selected?.leading}
          <span
            className={`min-w-0 flex-1 truncate ${selected ? 'text-text' : 'text-text-soft'}`}
          >
            {selected ? selected.label : allLabel}
          </span>
          <ChevronDown className="size-4 shrink-0 text-text-soft" aria-hidden />
        </button>
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          className="z-[60] max-h-[min(18rem,var(--radix-popover-content-available-height))] overflow-y-auto rounded-md border border-border bg-card p-1 shadow-md"
        >
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            className={rowCls(value == null)}
          >
            <span className="min-w-0 flex-1 truncate text-text-muted">{allLabel}</span>
            {value == null && <Check className="size-4 shrink-0 text-emerald" aria-hidden />}
          </button>
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={rowCls(isSelected)}
              >
                {option.leading}
                <span className="min-w-0 flex-1 truncate font-medium text-text">
                  {option.label}
                </span>
                {isSelected && <Check className="size-4 shrink-0 text-emerald" aria-hidden />}
              </button>
            )
          })}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  )
}
