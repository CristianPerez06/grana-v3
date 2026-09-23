// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

/**
 * WHERE A RULE IS IN ITS PLAN, on the screen that shows the rule.
 *
 * A limit decides when a rule stops reminding, and it was invisible on all three
 * screens that showed the rule. The plan behind #142 read «Activa · mensual, sin
 * fecha de fin» — three true statements adding up to a false one — while it had
 * already spent the only occurrence it was allowed.
 */

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
    const full = namespace ? `${namespace}.${key}` : key
    return values == null ? full : `${full}(${JSON.stringify(values)})`
  },
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
vi.mock('@/components/ui/drawer', () => ({ Drawer: () => null, useDrawerContainer: () => null }))
vi.mock('@/lib/preferences-context', () => ({ useShowCents: () => false }))

const { RecurrenceDetail } = await import(
  '@/app/(app)/transactions/recurring/[id]/_components/recurrence-detail'
)

/** The plan from #142, with its limit corrected to the eleven cuotas it is. */
const plan = {
  id: 'r1',
  amount: 105000,
  frequency: 'monthly',
  status: 'active',
  movement_type: 'expense',
  currency_code: 'ARS',
  interval_count: 1,
  interval_unit: 'month',
  max_occurrences: 11,
  positions_spent: 1,
  start_date: '2026-09-10',
  end_date: null,
  description: 'Plan de pago',
  next_occurrence: '2026-10-10',
  covered_occurrences: [],
  pending_instances: [],
  instances: [],
  created_at: '2026-09-10T00:00:00.000Z',
  created_from_transaction_id: null,
  account: { id: 'a1', name: 'Billetera' },
  destination_account: null,
  category: null,
  subcategory: null,
  lifecycle: {
    state: 'active',
    progress: { spent: 1, total: 11, remaining: 10 },
    unresolved: 0,
  },
  last_expected_occurrence: { kind: 'date', date: '2027-07-10' },
} as unknown as Parameters<typeof RecurrenceDetail>[0]['rule']

const show = (rule: typeof plan) =>
  render(<RecurrenceDetail rule={rule} back={{ href: '/transactions/recurring', label: 'Recurrencias' }} />)

afterEach(cleanup)

describe('a rule WITH a limit', () => {
  it('says how far along it is, how many are left and when it ends', () => {
    show(plan)

    expect(screen.getByText('recurrences.limit.progress({"spent":1,"total":11})')).toBeTruthy()
    expect(screen.getByText('recurrences.limit.remaining({"remaining":10})')).toBeTruthy()
    expect(screen.getAllByText('recurrences.limit.last_expected').length).toBeGreaterThan(0)
    // And it does NOT claim to repeat forever, which is what it used to do.
    expect(screen.queryByText('recurrences.limit.no_limit')).toBeNull()
  })

  it('drops "restantes" once there are none left', () => {
    show({
      ...plan,
      lifecycle: {
        state: 'finished',
        progress: { spent: 11, total: 11, remaining: 0 },
        unresolved: 0,
      },
      last_expected_occurrence: { kind: 'none' },
    } as typeof plan)

    expect(screen.getByText('recurrences.limit.progress({"spent":11,"total":11})')).toBeTruthy()
    expect(screen.queryByText('recurrences.limit.remaining({"remaining":0})')).toBeNull()
  })
})

describe('a rule WITHOUT a limit', () => {
  it('shows no progress and says it repeats without limit', () => {
    show({
      ...plan,
      max_occurrences: null,
      lifecycle: { state: 'active', progress: null, unresolved: 0 },
      last_expected_occurrence: { kind: 'none' },
    } as typeof plan)

    expect(screen.getByText('recurrences.limit.no_limit')).toBeTruthy()
    expect(screen.queryByText(/recurrences\.limit\.progress\(/)).toBeNull()
    expect(screen.queryByText('recurrences.limit.last_expected')).toBeNull()
  })

  it('does NOT say "sin límite" when it ends on a date', () => {
    show({
      ...plan,
      max_occurrences: null,
      end_date: '2027-01-31',
      lifecycle: { state: 'active', progress: null, unresolved: 0 },
      last_expected_occurrence: { kind: 'none' },
    } as typeof plan)

    // Telling a rule that ends on 31 December that it repeats without limit
    // states the opposite of what the rule does.
    expect(screen.queryByText('recurrences.limit.no_limit')).toBeNull()
    expect(screen.getAllByText('recurrences.labels.end_date').length).toBeGreaterThan(0)
  })
})

describe('a PAUSED rule with a limit', () => {
  it('shows the progress but never a date', () => {
    show({
      ...plan,
      status: 'paused',
      lifecycle: {
        state: 'paused',
        progress: { spent: 4, total: 11, remaining: 7 },
        unresolved: 0,
      },
      last_expected_occurrence: { kind: 'unknown-while-paused' },
    } as typeof plan)

    // The positions spent do not depend on the future, so they are shown.
    expect(screen.getByText('recurrences.limit.progress({"spent":4,"total":11})')).toBeTruthy()
    expect(screen.getByText('recurrences.limit.remaining({"remaining":7})')).toBeTruthy()
    // The final date does depend on it — on a day that has not happened yet —
    // so it is named as something to be worked out, never estimated.
    expect(screen.getByText('recurrences.limit.last_expected_paused')).toBeTruthy()
    expect(screen.queryByText(/2027/)).toBeNull()
  })
})

/**
 * THE FICHA SAYS WHAT STATE THE RULE IS IN, from the derived state.
 *
 * Found in QA. The chip read `rule.status`, and a rule that spent its limit
 * still has `status = 'active'` — so the detail showed nothing while the list
 * grouped that same rule under Finalizada. Two screens, two answers about one
 * rule, which is the thing this change exists to remove.
 */
describe('the state chip on the detail', () => {
  it('says Finalizada on a rule whose column still says active', () => {
    show({
      ...plan,
      status: 'active',
      lifecycle: {
        state: 'finished',
        progress: { spent: 1, total: 1, remaining: 0 },
        unresolved: 0,
      },
      last_expected_occurrence: { kind: 'none' },
      next_occurrence: null,
    } as typeof plan)

    expect(screen.getByText('recurrences.statuses.finished')).toBeTruthy()
    // And never the column's own word, which would read "Activa" on a rule that
    // has stopped reminding.
    expect(screen.queryByText('recurrences.statuses.active')).toBeNull()
  })

  it('counts what is left to review when the rule finished owing something', () => {
    show({
      ...plan,
      status: 'active',
      lifecycle: {
        state: 'finished-with-pending',
        progress: { spent: 1, total: 1, remaining: 0 },
        unresolved: 1,
      },
      last_expected_occurrence: { kind: 'none' },
      next_occurrence: null,
    } as typeof plan)

    expect(
      screen.getByText('recurrences.limit.finished_with_pending({"count":1})'),
    ).toBeTruthy()
  })

  it('still says Pausada on a paused rule', () => {
    show({
      ...plan,
      status: 'paused',
      lifecycle: {
        state: 'paused',
        progress: { spent: 1, total: 3, remaining: 2 },
        unresolved: 0,
      },
      last_expected_occurrence: { kind: 'unknown-while-paused' },
    } as typeof plan)

    expect(screen.getByText('recurrences.statuses.paused')).toBeTruthy()
  })

  it('says nothing about a rule that is simply running', () => {
    show(plan)

    expect(screen.queryByText('recurrences.statuses.finished')).toBeNull()
    expect(screen.queryByText('recurrences.statuses.paused')).toBeNull()
    expect(screen.queryByText('recurrences.statuses.active')).toBeNull()
  })
})
