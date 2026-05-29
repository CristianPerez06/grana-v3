import { hasUserMovements } from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'
import { WelcomeFirstMoveCard } from './welcome-first-move-card'

export const WelcomeFirstMoveCardContainer = async () => {
  const supabase = await createClient()
  let hasMovements: boolean
  try {
    hasMovements = await hasUserMovements(supabase)
  } catch {
    return null
  }
  if (hasMovements) return null
  return <WelcomeFirstMoveCard />
}
