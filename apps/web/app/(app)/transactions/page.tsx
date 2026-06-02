import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TransactionsShell } from './_components/transactions-shell'

/**
 * Auth-gated entry point for the /transactions route. The route runs as a
 * client-rendered TanStack-driven shell — see `_components/transactions-shell.tsx`
 * for the full provider/section composition. Server work is intentionally
 * minimal: just the session check that every (app) layout already enforces,
 * kept here as a defensive double-check so the route can be loaded as a
 * standalone surface (e.g. preview / iframe contexts) without inheriting a
 * partially-authenticated layout. No data fetching happens here; the shell's
 * sections query everything they need via server actions.
 */
export default async function TransactionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <TransactionsShell />
}
