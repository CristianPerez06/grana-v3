// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { RecurrenceSummary } from '@/lib/recurrences/types'

/**
 * "Próximas recurrencias" does not announce a date from the gap (#121).
 *
 * The screen builds its own `RuleForProjection` by hand from each row. A
 * property left out of that object does not fail anything: the projection keeps
 * working and answers with the OLD calendar, so the card lists a vencimiento the
 * generator is never going to create. Rendering the real component is the only
 * way to see it — the helper it calls is already covered and already correct.
 */

// Fixed, because the window is computed from it: a suite that walked the real
// calendar would assert different dates every day it runs.
vi.mock('@grana/money-logic', async () => {
  const actual = await vi.importActual<typeof import('@grana/money-logic')>('@grana/money-logic')
  return { ...actual, getTodayAR: () => new Date('2026-09-08T12:00:00Z') }
})
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}))

const { UpcomingRecurrences } = await import(
  '@/app/(app)/transactions/recurring/_components/upcoming-recurrences'
)

afterEach(cleanup)

/**
 * A rule anchored on the 10th whose reference date was corrected: the old
 * calendar stopped, and the new one only starts ruling on 10/10. The occurrence
 * of 10/09 is inside the gap — nobody's.
 */
const corrected = (floor: string | null): RecurrenceSummary =>
  ({
    id: 'r-alquiler',
    description: 'Alquiler',
    amount: 500_000,
    currency_code: 'ARS',
    movement_type: 'expense',
    status: 'active',
    start_date: '2026-06-10',
    end_date: null,
    interval_count: 1,
    interval_unit: 'month',
    max_occurrences: null,
    schedule_effective_from: floor,
    account: { id: 'bank', name: 'Cuenta', type: 'bank' },
    destination_account: null,
    category: null,
    subcategory: null,
    pending_instances: [],
    covered_occurrences: [],
    next_occurrence: null,
  }) as unknown as RecurrenceSummary

const renderCard = async (rule: RecurrenceSummary) =>
  render(await UpcomingRecurrences({ rules: [rule] }))

describe('Próximas recurrencias — the stretch that belongs to nobody', () => {
  it('does not list an occurrence from inside the gap', async () => {
    await renderCard(corrected('2026-10-10'))
    // 10/09 falls in the "next 7 days" bucket from 08/09, and it is precisely
    // the date the corrected schedule does not produce.
    expect(screen.queryByText('10 sept')).toBeNull()
    expect(screen.queryByText('Alquiler')).toBeNull()
  })

  it('lists it again once the schedule rules from that very date', async () => {
    await renderCard(corrected('2026-09-10'))
    expect(screen.getByText('10 sept')).toBeTruthy()
    expect(screen.getByText('Alquiler')).toBeTruthy()
  })

  it('lists it when no correction ever happened', async () => {
    await renderCard(corrected(null))
    expect(screen.getByText('10 sept')).toBeTruthy()
  })
})
