import { getHousehold, getHouseholdDebt } from '@grana/shared'
import { createClient } from '@/lib/supabase/server'
import { SharedStrip, type SharedNet } from './shared-strip'

// Up to two initials from a full name; "?" when empty.
const initialsOf = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

const firstName = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? ''

// Data + visibility gate for the "Compartido" strip. Renders only when the user
// is in a 2-member household with a non-settled net to show. Tolerant: any
// failure resolves to null so the rest of the dashboard never breaks.
export const SharedStripContainer = async () => {
  const supabase = await createClient()

  let householdName: string
  let self: { userId: string; fullName: string }
  let other: { userId: string; fullName: string }
  let nets: SharedNet[]

  try {
    const household = await getHousehold(supabase)
    if (!household || household.members.length < 2) return null
    // getHousehold orders the current user first.
    self = household.members[0]
    other = household.members[1]
    householdName = household.name

    const debt = await getHouseholdDebt(supabase)
    if (!debt) return null

    nets = (['ARS', 'USD'] as const).flatMap((currency) => {
      const d = debt[currency]
      if (d.kind === 'settled') return []
      const direction: SharedNet['direction'] = d.to === self.userId ? 'they_owe_you' : 'you_owe'
      return [{ currency, amount: d.amount, direction }]
    })
  } catch {
    return null
  }

  // No activity to surface (both currencies settled) → don't render.
  if (nets.length === 0) return null

  return (
    <SharedStrip
      householdName={householdName}
      otherName={firstName(other.fullName)}
      selfInitials={initialsOf(self.fullName)}
      otherInitials={initialsOf(other.fullName)}
      nets={nets}
    />
  )
}
