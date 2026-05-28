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
    <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-4">
      <p className="text-sm font-medium text-foreground">{t('title')}</p>
      <p className="text-sm text-muted-foreground">{t('description')}</p>
      <button
        type="button"
        onClick={dismiss}
        className="self-start text-sm font-medium text-primary hover:underline"
      >
        {t('dismiss')}
      </button>
    </div>
  )
}
