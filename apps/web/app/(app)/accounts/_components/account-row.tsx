'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import type { AccountWithBalances } from '@/lib/accounts/types'
import { reactivateAccount } from '@/app/_actions/accounts'
import { formatARS, formatUSD } from '@/lib/format'
import { useShowCents } from '@/lib/preferences-context'

type Props = {
  account: AccountWithBalances
}

export const AccountRow = ({ account }: Props) => {
  const showCents = useShowCents()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const balances = account.balances
  const activeCurrencies = account.currencies.filter((c) => c.is_active)

  const handleReactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await reactivateAccount(account.id)
      if (!result.ok) setError(result.formError ?? 'Error al reactivar')
    })
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link href={`/accounts/${account.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{account.name}</span>
          {account.type === 'bank' && account.institution && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {account.institution.name}
            </span>
          )}
          {!account.is_active && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800">
              Archivada
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          {activeCurrencies.map((c) => (
            <span key={c.currency_code} className="text-xs text-muted-foreground">
              {c.currency_code === 'ARS' ? (
                <span className="font-medium">{formatARS(balances.ARS, showCents)}</span>
              ) : (
                <span>{formatUSD(balances.USD, showCents)}</span>
              )}
            </span>
          ))}
        </div>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </Link>

      <div className="flex items-center gap-2 flex-shrink-0">
        {account.is_active ? (
          <Link
            href={`/accounts/${account.id}/edit`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Editar
          </Link>
        ) : (
          <button
            onClick={handleReactivate}
            disabled={isPending}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Reactivar
          </button>
        )}
      </div>
    </div>
  )
}
