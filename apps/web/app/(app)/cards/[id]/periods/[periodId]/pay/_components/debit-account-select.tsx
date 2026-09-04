'use client'

import { useState } from 'react'
import * as RadixPopover from '@radix-ui/react-popover'
import { Check, ChevronDown, Wallet } from 'lucide-react'
import type { ResolvedAccountAvatar } from '@grana/ui-contracts'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { AccountAvatar } from '@/components/ui/account-avatar'

export type DebitAccount = {
  id: string
  name: string
  /** Saldo disponible en la moneda del débito que se está por hacer. */
  balance: number
  /** Secondary line under the name (account type / institution), like the mockup. */
  subtitle: string | null
  /** Visual identity (color + icon/monogram), same as the accounts listing. */
  avatar: ResolvedAccountAvatar
}

/**
 * Account picker for the statement payment. The library has no generic `Select`
 * primitive, so — like the cards/accounts drawers (`BankSelector`) — this is a
 * Radix Popover dropdown styled to the system. Matches the handoff mockup: the
 * account's color avatar + name + type on the left, the available ARS balance
 * (with an "available" caption) on the right. The parent owns the selected
 * `value`; this component owns only its open state.
 */
export const DebitAccountSelect = ({
  accounts,
  currency = 'ARS',
  value,
  onChange,
  label,
  placeholder,
  availableLabel,
  invalid = false,
}: {
  accounts: DebitAccount[]
  /** Moneda del débito: decide cómo se formatea el saldo, nunca lo convierte. */
  currency?: 'ARS' | 'USD'
  value: string
  onChange: (id: string) => void
  label: string
  placeholder: string
  availableLabel: string
  invalid?: boolean
}) => {
  const showCents = useShowCents()
  // Bimoneda: el saldo se muestra en SU moneda. Nunca se convierte para compararlo.
  const fmt = (n: number) => (currency === 'USD' ? formatUSD(n, showCents) : formatARS(n, showCents))
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
          {selected ? (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-text">{selected.name}</span>
                {selected.subtitle && (
                  <span className="block truncate text-xs text-text-muted">{selected.subtitle}</span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold tabular-nums text-text">
                  {fmt(selected.balance)}
                </span>
                <span className="block text-[11px] text-text-soft">{availableLabel}</span>
              </span>
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-text-soft">{placeholder}</span>
          )}
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
                  {account.subtitle && (
                    <span className="block truncate text-xs text-text-muted">{account.subtitle}</span>
                  )}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-text-muted">
                  {fmt(account.balance)}
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
