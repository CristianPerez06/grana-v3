'use server'

import { addDaysToISO, formatDateISO, getTodayAR } from '@grana/money-logic'
import {
  rankFrequentClassifications,
  type FrequentClassification,
  type FrequentLeafRow,
} from '@grana/movement-form'
import { createClient } from '@/lib/supabase/server'

// Rolling window for the frequent-classification chips (#31 item 1). The ranking
// (grouping, exclusions, top-N) lives in `@grana/movement-form` so web and mobile
// stay identical. Returns both types (one round-trip feeds expense and income).
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
 * rolling window, for `expense` and `income`, so a one-tap chip can pre-fill the
 * classification. Read-only; RLS scopes it to the caller. Returns `[]` on no auth
 * or no history — the form then shows its defaults or nothing.
 */
export async function getFrequentClassifications(): Promise<FrequentClassification[]> {
  const supabase = await createClient()
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
