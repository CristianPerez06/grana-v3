import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

export type MenuIdentity = {
  name: string | null
  email: string | null
}

/**
 * Name and email of the signed-in user, for the "logged in as" block at the top
 * of the `AppMenu` sheet.
 *
 * Web shows the same thing in its sidebar and its menu sheet. Native carries it
 * so parity does not break from this side — see decision 4 of
 * `openspec/changes/mirror-native-chrome-on-web-mobile/design.md`.
 *
 * Distinct from `useProfileFirstName` in `lib/dashboard/queries.ts`, which
 * exists for the greeting and deliberately returns only the first name.
 */
export function useMenuIdentity() {
  return useQuery<MenuIdentity>({
    queryKey: ['profile', 'menu-identity'] as const,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return { name: null, email: null }

      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      const fullName = (data?.full_name as string | undefined)?.trim()
      return { name: fullName || null, email: user.email ?? null }
    },
  })
}
