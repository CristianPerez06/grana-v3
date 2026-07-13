'use client'

import { useState } from 'react'
import * as RadixPopover from '@radix-ui/react-popover'
import { Check, ChevronDown, Wallet } from 'lucide-react'
import type { ResolvedAccountAvatar } from '@grana/ui-contracts'
import { formatARS } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { AccountAvatar } from '@/components/ui/account-avatar'

export type DebitAccount = {
  id: string
  name: string
  balanceARS: number
  /** Visual identity (color + icon/monogram), same as the accounts listing. */
  avatar: ResolvedAccountAvatar
}

/**
 * Account picker for the statement payment. The library has no generic `Select`
 * primitive, so — like the cards/accounts drawers (`BankSelector`) — this is a
 * Radix Popover dropdown styled to the system: a field-looking trigger that
 * shows the selected account + its ARS available balance, opening a list where
 * each option carries the same two facts. The parent owns the selected `value`;
 * this component owns only its open state.
 */
export const DebitAccountSelect = ({
  accounts,
  value,
  onChange,
  label,
  placeholder,
  invalid = false,
}: {
  accounts: DebitAccount[]
  value: string
  onChange: (id: string) => void
  label: string
  placeholder: string
  invalid?: boolean
}) => {
  const showCents = useShowCents()
  const [open, setOpen] = useState(false)
  const selected = accounts.find((a) => a.id === value) ?? null

  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className={`flex w-full items-center gap-3 rounded-[10px] border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            invalid ? 'border-error' : 'border-border'
          }`}
        >
          {selected ? (
            <AccountAvatar {...selected.avatar} size="sm" />
          ) : (
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-md bg-page text-text-muted"
              aria-hidden
            >
              <Wallet className="size-4" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            {selected ? (
              <>
                <span className="block truncate font-semibold text-text">{selected.name}</span>
                <span className="block truncate text-xs text-text-muted tabular-nums">
                  {formatARS(selected.balanceARS, showCents)}
                </span>
              </>
            ) : (
              <span className="block truncate text-text-soft">{placeholder}</span>
            )}
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
          className="z-50 max-h-[min(16rem,var(--radix-popover-content-available-height))] overflow-y-auto rounded-md border border-border bg-card p-1 shadow-md"
        >
          {accounts.map((account) => {
            const isSelected = account.id === value
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => {
                  onChange(account.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left text-sm transition-colors hover:bg-page ${
                  isSelected ? 'bg-page' : ''
                }`}
              >
                <AccountAvatar {...account.avatar} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-text">{account.name}</span>
                  <span className="block truncate text-xs text-text-muted tabular-nums">
                    {formatARS(account.balanceARS, showCents)}
                  </span>
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
