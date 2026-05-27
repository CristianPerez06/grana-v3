'use server'

import { getMonthBalanceSeries, type MonthBalanceSeries } from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'

/**
 * Fetches the accumulated month-balance series for a given month from the
 * client. The "Balance del mes" card owns the selected month in client state
 * and calls this when the user navigates between months, so changing month no
 * longer triggers a full route navigation. The current month is still
 * server-rendered as initial data in the dashboard page.
 */
export async function fetchMonthBalanceSeries(
  year: number,
  month: number,
): Promise<MonthBalanceSeries> {
  const supabase = await createClient()
  return getMonthBalanceSeries(supabase, year, month)
}
