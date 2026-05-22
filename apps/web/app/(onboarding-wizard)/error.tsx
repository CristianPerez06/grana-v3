'use client'

import { RouteError } from '@/components/ui/route-error'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: Props) {
  return <RouteError error={error} onRetry={reset} />
}
