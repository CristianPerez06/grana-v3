import { getCommittedOutlookForMonth, type CommittedOutlook } from '@grana/dashboard'
import { getTodayAR } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { CommittedSection } from './committed-section'

// "Compromisos" — resolves the CURRENT month server-side and hands it to the
// card as initial data. Everything else (navigating months) is client-side, the
// same split "Saldo disponible total" uses.
//
// The month label is NOT computed here any more. It travels on the read's result
// (`window`, `lens`, `windowElapsed`) so web and native cannot drift: each used
// to derive it from its own `new Date()`, which is why the card kept naming the
// month after the real today while the navigator said otherwise.
export const CommittedSectionContainer = async () => {
  const today = getTodayAR()
  let initial: CommittedOutlook | null = null
  try {
    const supabase = await createClient()
    initial = await getCommittedOutlookForMonth(supabase, {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    })
  } catch {
    // The card renders its own error state from the client query; a failed
    // server pass just means no initial data.
    initial = null
  }

  return <CommittedSection initialData={initial} />
}
