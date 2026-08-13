import { addDaysToISO, formatDateISO, getTodayAR } from '@grana/money-logic'
import type { FrequentClassification } from '@grana/movement-form'
import { supabase } from '../supabase'

// Native twin of the web `getFrequentClassifications` action (#31 item 1). Same
// window/cap/shape so both platforms feed the shared hook identically.
const WINDOW_DAYS = 60
const PER_TYPE_LIMIT = 4

type Row = {
  category_id: string | null
  subcategory_id: string | null
  date: string
  type: 'income' | 'expense'
  category: { is_active: boolean } | null
  subcategory: { is_active: boolean } | null
}

/**
 * The user's most-frequent leaf classifications `(category, subcategory)` over a
 * rolling window, for `expense` and `income`. Top {@link PER_TYPE_LIMIT} per
 * type, most used first (recency breaks ties), excluding archived leaves. Read
 * only; RLS scopes it to the caller. Returns `[]` on no auth / no history.
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
      'category_id, subcategory_id, date, type, category:categories(is_active), subcategory:subcategories(is_active)',
    )
    .eq('user_id', user.id)
    .in('type', ['expense', 'income'])
    .eq('is_parent', false)
    .not('category_id', 'is', null)
    .gte('date', cutoff)

  const rows = (data ?? []) as unknown as Row[]

  type Agg = {
    type: 'income' | 'expense'
    categoryId: string
    subcategoryId: string | null
    count: number
    lastDate: string
  }
  const groups = new Map<string, Agg>()
  for (const row of rows) {
    if (!row.category_id) continue
    if (row.category?.is_active === false) continue
    if (row.subcategory_id && row.subcategory?.is_active === false) continue
    const key = `${row.type}|${row.category_id}|${row.subcategory_id ?? ''}`
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      if (row.date > existing.lastDate) existing.lastDate = row.date
    } else {
      groups.set(key, {
        type: row.type,
        categoryId: row.category_id,
        subcategoryId: row.subcategory_id,
        count: 1,
        lastDate: row.date,
      })
    }
  }

  const byFrequency = (a: Agg, b: Agg): number =>
    b.count - a.count || (b.lastDate > a.lastDate ? 1 : b.lastDate < a.lastDate ? -1 : 0)

  const topFor = (type: 'income' | 'expense'): FrequentClassification[] =>
    [...groups.values()]
      .filter((g) => g.type === type)
      .sort(byFrequency)
      .slice(0, PER_TYPE_LIMIT)
      .map((g) => ({ categoryId: g.categoryId, subcategoryId: g.subcategoryId }))

  return [...topFor('expense'), ...topFor('income')]
}
