import { addDaysToISO, formatDateISO, getTodayAR } from '@grana/money-logic'
// React-free subpath (mirrors the web action): keeps the hook out of the query
// bundle and stays consistent across platforms.
import {
  rankFrequentClassifications,
  type FrequentClassification,
  type FrequentLeafRow,
} from '@grana/movement-form/frequent-classifications'
import { supabase } from '../supabase'

// Native twin of the web `getFrequentClassifications` action (#31 item 1). Same
// window and shared ranker, so both platforms feed the hook identically.
const WINDOW_DAYS = 60

type Row = {
  category_id: string | null
  subcategory_id: string | null
  date: string
  type: 'income' | 'expense'
  category: { is_active: boolean; canonical_name: string } | null
  subcategory: { is_active: boolean; canonical_name: string } | null
}

/**
 * The user's most-frequent leaf classifications `(category, subcategory)` over a
 * rolling window, for `expense` and `income`. Read-only; RLS scopes it to the
 * caller. Returns `[]` on no auth / no history.
 */
export async function getFrequentClassifications(): Promise<FrequentClassification[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const cutoff = addDaysToISO(formatDateISO(getTodayAR()), -WINDOW_DAYS)

  const { data } = await supabase
    .from('transactions')
    .select(
      'category_id, subcategory_id, date, type, category:categories(is_active, canonical_name), subcategory:subcategories(is_active, canonical_name)',
    )
    .eq('user_id', user.id)
    .in('type', ['expense', 'income'])
    .eq('is_parent', false)
    .not('category_id', 'is', null)
    .gte('date', cutoff)

  const rows = (data ?? []) as unknown as Row[]
  const leafRows: FrequentLeafRow[] = rows.map((r) => ({
    type: r.type,
    categoryId: r.category_id,
    subcategoryId: r.subcategory_id,
    categoryCanonical: r.category?.canonical_name ?? null,
    subcategoryCanonical: r.subcategory?.canonical_name ?? null,
    categoryActive: r.category?.is_active ?? true,
    subcategoryActive: r.subcategory ? r.subcategory.is_active : null,
    date: r.date,
  }))

  return rankFrequentClassifications(leafRows)
}
