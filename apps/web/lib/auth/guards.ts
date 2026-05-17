import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const redirectIfAuthenticated = async (target = '/dashboard') => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect(target)
}
