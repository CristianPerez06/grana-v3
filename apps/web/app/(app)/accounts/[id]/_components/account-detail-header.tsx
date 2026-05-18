'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AccountWithBalances } from '@/lib/accounts/types'
import { archiveAccount, reactivateAccount, deleteAccount } from '@/app/_actions/accounts'
import { formatARS, formatUSD } from '@/lib/format'
import { useShowCents } from '@/lib/preferences-context'

type Props = {
  account: AccountWithBalances
  hasTransactions: boolean
}

export const AccountDetailHeader = ({ account, hasTransactions }: Props) => {
  const showCents = useShowCents()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const balances = account.balances
  const activeCurrencies = account.currencies.filter((c) => c.is_active)
  const hasARS = activeCurrencies.some((c) => c.currency_code === 'ARS')
  const hasUSD = activeCurrencies.some((c) => c.currency_code === 'USD')

  const handleArchive = () => {
    if (!confirm('¿Archivar esta cuenta? Vas a poder reactivarla más tarde.')) return
    startTransition(async () => {
      setError(null)
      const result = await archiveAccount(account.id)
      if (!result.ok) setError(result.formError ?? 'Error al archivar')
    })
  }

  const handleReactivate = () => {
    startTransition(async () => {
      setError(null)
      const result = await reactivateAccount(account.id)
      if (!result.ok) setError(result.formError ?? 'Error al reactivar')
    })
  }

  const handleDelete = () => {
    if (!confirm('Esta cuenta no tiene movimientos. ¿Eliminarla? Esta acción no se puede deshacer.')) return
    startTransition(async () => {
      setError(null)
      const result = await deleteAccount(account.id)
      if (!result.ok) {
        setError(result.formError ?? 'Error al eliminar')
        return
      }
      router.push('/accounts')
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{account.name}</h1>
            {!account.is_active && (
              <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                Archivada
              </span>
            )}
          </div>
          {account.type === 'bank' && account.institution && (
            <p className="mt-1 text-sm text-muted-foreground">{account.institution.name}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={`/accounts/${account.id}/edit`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Editar
          </a>
          {!account.is_active ? (
            <button
              onClick={handleReactivate}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Reactivar
            </button>
          ) : hasTransactions ? (
            <button
              onClick={handleArchive}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Archivar
            </button>
          ) : (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Balances — ARS primary, USD secondary */}
      <div className="flex items-end gap-6">
        {hasARS && (
          <div>
            <p className="text-3xl font-bold tabular-nums">{formatARS(balances.ARS, showCents)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ARS</p>
          </div>
        )}
        {hasUSD && (
          <div>
            <p className="text-xl font-semibold tabular-nums text-muted-foreground">
              {formatUSD(balances.USD, showCents)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">USD</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
