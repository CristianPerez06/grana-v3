'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'

const STORAGE_KEY = 'grana.accountsHintDismissed'

const listeners = new Set<() => void>()

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const getSnapshot = () => localStorage.getItem(STORAGE_KEY) === '1'

// Hidden during SSR; revealed on the client only if the user hasn't dismissed it.
const getServerSnapshot = () => true

export const AccountsHint = () => {
  const t = useTranslations('accounts.hint')
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const dismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1')
    listeners.forEach((cb) => cb())
  }, [])

  if (dismissed) return null

  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-border-soft bg-card p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text">{t('title')}</p>
        <p className="mt-1 text-sm text-text-soft">{t('description')}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 self-start text-sm font-semibold text-positive transition-opacity hover:opacity-80 cursor-pointer"
      >
        {t('dismiss')}
      </button>
    </div>
  )
}
