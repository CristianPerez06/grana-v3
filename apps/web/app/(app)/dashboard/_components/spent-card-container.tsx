import { getHousehold } from '@grana/shared'
import { createClient } from '@/lib/supabase/server'
import { SpentCard } from './spent-card'

const firstName = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? ''

// Resolves the household partner's first name for the breakdown copy ("lo puso
// Juli"). Static — it does not depend on the selected month — so it is fetched
// server-side once and handed to the client card as a prop.
//
// Tolerant: any failure, or no household, resolves to null and the card simply
// renders without the shared breakdown. A user with no Compartido never sees it.
export const SpentCardContainer = async () => {
  let otherName: string | null = null
  try {
    const supabase = await createClient()
    const household = await getHousehold(supabase)
    if (household && household.members.length >= 2) {
      // getHousehold orders the current user first.
      otherName = firstName(household.members[1]!.fullName)
    }
  } catch {
    otherName = null
  }

  return <SpentCard otherName={otherName} />
}
