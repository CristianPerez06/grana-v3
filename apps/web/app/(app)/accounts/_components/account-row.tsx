'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import type { AccountWithBalances } from '@/lib/accounts/types'
import { archiveAccount, reactivateAccount, deleteAccount } from '@/app/_actions/accounts'

const formatBalance = (amount: number, currency: 'ARS' | 'USD') => {
  const formatted = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
  return formatted
}

type Props = {
  account: AccountWithBalances
}

export const AccountRow = ({ account }: Props) => {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const balances = account.balances
  const activeCurrencies = account.currencies.filter((c) => c.is_active)

  const handleArchive = () => {
    if (!confirm('¿Archivar esta cuenta? La cuenta quedará inactiva.')) return
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
    if (!confirm('¿Eliminar esta cuenta? Esta acción no se puede deshacer.')) return
    startTransition(async () => {
      setError(null)
      const result = await deleteAccount(account.id)
      if (!result.ok) setError(result.formError ?? 'Error al eliminar')
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
                <span className="font-medium">{formatBalance(balances.ARS, 'ARS')}</span>
              ) : (
                <span>{formatBalance(balances.USD, 'USD')}</span>
              )}
            </span>
          ))}
        </div>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </Link>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/accounts/${account.id}/edit`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Editar
        </Link>
        {account.is_active ? (
          <button
            onClick={handleArchive}
            disabled={isPending}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Archivar
          </button>
        ) : (
          <button
            onClick={handleReactivate}
            disabled={isPending}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Reactivar
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>
    </div>
  )
}
