// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

/**
 * Every frequency a rule can hold is TRANSLATED, on every surface (#141).
 *
 * The detail card used to enumerate four of the five and print the raw column
 * value for whatever else arrived, so a custom rule read `custom` there while
 * the list and the edit drawer both said "Personalizado" — the database's word,
 * in English, leaking to the user on one screen out of three.
 *
 * The guard was written when the row's type claimed `frequency` could be any
 * string. #121 narrowed it to `RecurrenceFrequencyLabel`, which is exactly the
 * five keys under `frequencies.*`, and the guard outlived its reason.
 *
 * What this pins is the OUTPUT, not the absence of the guard: the assertion is
 * that no surface renders the bare column value. A future rewrite is free to
 * reintroduce a mapping, as long as `custom` is in it.
 */

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))
vi.mock('@/app/_actions/recurrences', () => ({
  updateRecurrence: () => Promise.resolve({ ok: true }),
  deleteRecurrence: () => Promise.resolve({ ok: true }),
  pauseRecurrence: () => Promise.resolve({ ok: true }),
  resumeRecurrence: () => Promise.resolve({ ok: true }),
}))
vi.mock('@/components/ui/drawer', () => ({ Drawer: () => null }))
vi.mock('@/lib/preferences-context', () => ({ useShowCents: () => false }))

const { RecurrenceDetail } = await import(
  '@/app/(app)/transactions/recurring/[id]/_components/recurrence-detail'
)

/** A rule whose calendar no preset describes — every 3 days. */
const customRule = {
  id: 'r1',
  amount: 2500,
  frequency: 'custom',
  status: 'active',
  movement_type: 'expense',
  currency_code: 'ARS',
  interval_count: 3,
  interval_unit: 'day',
  max_occurrences: null,
  start_date: '2026-06-04',
  end_date: null,
  description: 'Comida',
  next_date: '2026-09-14',
  created_at: '2026-06-04T00:00:00.000Z',
  created_from_transaction_id: null,
  account: { id: 'a1', name: 'Billetera' },
  destination_account: null,
  category: { id: 'c1', name: 'Comida', canonical_name: 'food', user_id: null },
  subcategory: null,
  instances: [],
} as unknown as Parameters<typeof RecurrenceDetail>[0]['rule']

afterEach(cleanup)

describe('the frequency shown on a recurrence detail', () => {
  it('translates a custom frequency instead of printing the column', () => {
    render(<RecurrenceDetail rule={customRule} />)

    // The translated key, twice: the metadata row and the chip over the amount.
    expect(screen.getAllByText('recurrences.frequencies.custom').length).toBeGreaterThan(0)
    // And never the raw value. This is the assertion that would have caught it:
    // the card rendered the word `custom` straight out of the database.
    expect(screen.queryByText('custom')).toBeNull()
  })

  it('still translates the presets', () => {
    render(
      <RecurrenceDetail
        rule={{ ...customRule, frequency: 'monthly', interval_count: 1, interval_unit: 'month' }}
      />,
    )

    expect(screen.getAllByText('recurrences.frequencies.monthly').length).toBeGreaterThan(0)
    expect(screen.queryByText('monthly')).toBeNull()
  })
})
