import type { DbClient } from '@/lib/supabase/db-client'
import { getTodayAR } from '@/lib/date'
import { getAccounts as getAccountsImpl } from '@grana/accounts'

// The accounts reads now live in `@grana/accounts` so mobile can reuse them.
// `getCashAndBankAccounts`, `getAccountDetail` and `getInstitutions` take no
// ambient date, so they re-export directly; `getAccounts` embeds the credit
// summaries (`@grana/cards`), which need `today` — this thin wrapper injects
// `getTodayAR()` so the web call sites keep their zero-`today` signature.
export {
  getCashAndBankAccounts,
  getAccountDetail,
  getInstitutions,
} from '@grana/accounts'

export async function getAccounts(
  supabase: DbClient,
  options: { includeArchived?: boolean } = {},
) {
  return getAccountsImpl(supabase, { ...options, today: getTodayAR() })
}
