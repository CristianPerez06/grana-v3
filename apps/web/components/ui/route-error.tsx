'use client'

import { useTranslations } from 'next-intl'
import type { RouteErrorProps } from '@grana/ui-contracts'
import { Button } from './button'
import { cn } from '@/lib/utils'

export const RouteError = ({ error, onRetry, className }: RouteErrorProps) => {
  const t = useTranslations('error')
  const showDetails = process.env.NODE_ENV !== 'production'

  return (
    <div
      role="alert"
      className={cn(
        'flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center',
        className,
      )}
    >
      <h2 className="text-lg font-semibold text-text">{t('generic_title')}</h2>
      {showDetails && error?.message ? (
        <pre className="max-w-md overflow-auto rounded-md bg-border-soft px-3 py-2 text-left text-xs text-text-muted">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : null}
        </pre>
      ) : null}
      <Button variant="primary" size="md" onPress={onRetry} className="w-auto px-6">
        {t('retry_action')}
      </Button>
    </div>
  )
}
