'use client'

import { useState, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createQueryClient } from '@/lib/query-client'

type Props = {
  children: ReactNode
}

/**
 * Mounts a single TanStack QueryClient for the entire authenticated app shell.
 * Lives at the (app) layout level so any component rendered under it — from
 * server-rendered routes that mount client mutation forms, to the fully
 * client-driven /transactions shell — can call `useQueryClient()` without
 * having to know whether their host route opted into TanStack.
 *
 * One client per user session, kept stable across re-renders via lazy init.
 */
export function AppQueryProvider({ children }: Props) {
  const [client] = useState(() => createQueryClient())
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
