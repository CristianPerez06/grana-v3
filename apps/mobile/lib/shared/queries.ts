import type { Household } from '@grana/movement-form'
import { supabase } from '../supabase'

// Thin, form-only household read — the mobile mirror of web's `getHousehold`
// (`apps/web/lib/shared/queries.ts`), narrowed to exactly what the movement
// form needs to populate the `Household` shape and enable the "Compartir gasto"
// toggle. The full Hogar module (`/shared/*`: debt, settlements, outlook) stays
// web-only for now.
//
// Extraction trigger: when the mobile Hogar module lands (parity backlog gap 3),
// that second real consumer forces this read into a shared `@grana/*` package —
// the same way the mobile Movimientos tab forced the global-feed read out of
// `apps/web/lib/`. Until then a thin mirror of one stable-shaped query beats
// standing up a shared household package prematurely.

/** The current user's active household (members + default split), or null. */
export async function getHousehold(): Promise<Household | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const userId = user.id

  const { data: membership } = await supabase
    .from('household_member')
    .select('household_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!membership) return null

  const { data: hh } = await supabase
    .from('household')
    .select('id, name, default_split, created_by, is_active')
    .eq('id', membership.household_id)
    .maybeSingle()
  if (!hh || !hh.is_active) return null

  const { data: members } = await supabase
    .from('household_member')
    .select('user_id')
    .eq('household_id', hh.id)
  const ids = (members ?? []).map((m) => m.user_id)

  // Co-member profiles are readable thanks to the 0024 profile-read policy.
  const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', ids)
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]))

  const defaultSplit = Array.isArray(hh.default_split)
    ? (hh.default_split as { user_id: string; percentage: number }[])
    : []

  // Current user first: the split UI treats `members[0]` as "you" (it labels the
  // editable share box and the "dividir con {members[1]}" hint positionally).
  // DB order is creation order, so without this the member who joined second
  // would see the other member's name in the "you" slot.
  const orderedIds = [userId, ...ids.filter((id) => id !== userId)]

  return {
    id: hh.id,
    name: hh.name,
    defaultSplit,
    members: orderedIds.map((id) => ({
      userId: id,
      fullName: nameById.get(id) ?? '',
      isCreator: id === hh.created_by,
    })),
  }
}
