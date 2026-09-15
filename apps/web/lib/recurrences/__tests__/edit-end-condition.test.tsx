// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * The end condition is EDITABLE, on a rule that already exists.
 *
 * It was not. The drawer offered the end date and nothing else, and
 * `max_occurrences` was not even a key the update schema accepted — so a rule
 * created with a limit could neither have it widened nor taken off, from any
 * screen. The only way out was to delete the rule and build it again, which
 * splits a payment plan into two histories.
 *
 * The write path has its own regressions against the real database
 * (`packages/recurrences/__tests__/limit-below-spent.test.ts`). What this covers
 * is the wiring: that the drawer sends what the chosen answer means.
 */

/** Typed with its two arguments, so `mock.calls[0][1]` is the patch under test. */
const updateRecurrence = vi.fn(async (id: string, patch: Record<string, unknown>) => ({
  ok: true as const,
  echoed: { id, keys: Object.keys(patch).length },
}))

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@/app/_actions/recurrences', () => ({ updateRecurrence }))
vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  useDrawerContainer: () => null,
}))
vi.mock('@/components/ui/money-calculator-popover', () => ({
  MoneyCalculatorPopover: () => null,
}))

const { RecurrenceEditDrawer } = await import(
  '@/app/(app)/transactions/recurring/[id]/_components/recurrence-edit-drawer'
)

/** The rule from #142: eleven instalments recorded as one, one position spent. */
const plan = {
  id: 'r1',
  amount: 105000,
  frequency: 'monthly',
  status: 'active',
  movement_type: 'expense',
  currency_code: 'ARS',
  interval_count: 1,
  interval_unit: 'month',
  max_occurrences: 1,
  positions_spent: 1,
  start_date: '2026-09-10',
  end_date: null,
  description: 'Plan de pago',
  next_occurrence: null,
  covered_occurrences: [],
  pending_instances: [],
  instances: [],
  schedule_effective_from: null,
  schedule_positions_before: null,
  seed_occurrence_date: null,
  created_from_transaction_id: null,
  account: { id: 'a1', name: 'Billetera' },
  category: null,
  subcategory: null,
} as unknown as Parameters<typeof RecurrenceEditDrawer>[0]['rule']

const openDrawer = (rule = plan) =>
  render(<RecurrenceEditDrawer rule={rule} open onClose={() => {}} />)

const answer = (key: string) => screen.getByLabelText(`recurrences.create.${key}`)
const save = () => fireEvent.click(screen.getByText('recurrences.actions.save_changes'))

afterEach(() => {
  cleanup()
  updateRecurrence.mockClear()
})

describe('editing how a rule ends', () => {
  it('opens on the answer the rule stored', () => {
    openDrawer()

    expect((answer('end_after_count') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('recurrences.create.end_count_label') as HTMLInputElement).value)
      .toBe('1')
  })

  it('sends the new number when the limit is widened', async () => {
    openDrawer()

    fireEvent.change(screen.getByLabelText('recurrences.create.end_count_label'), {
      target: { value: '11' },
    })
    save()

    await waitFor(() => expect(updateRecurrence).toHaveBeenCalled())
    const patch = updateRecurrence.mock.calls[0][1]
    expect(patch.max_occurrences).toBe(11)
    expect(patch.end_date).toBeNull()
  })

  it('sends null when the limit is taken off', async () => {
    openDrawer()

    fireEvent.click(answer('end_never'))
    save()

    await waitFor(() => expect(updateRecurrence).toHaveBeenCalled())
    const patch = updateRecurrence.mock.calls[0][1]
    // Explicitly null, not absent: absent would leave the limit in place, and
    // the rule would go on finishing after one occurrence.
    expect(patch.max_occurrences).toBeNull()
    expect(patch.end_date).toBeNull()
  })

  it('refuses a limit below what the rule already spent, without saving', () => {
    openDrawer({ ...plan, max_occurrences: 5, positions_spent: 5 })

    fireEvent.change(screen.getByLabelText('recurrences.create.end_count_label'), {
      target: { value: '3' },
    })
    save()

    expect(updateRecurrence).not.toHaveBeenCalled()
    expect(screen.getByText('recurrences.create.errors.end_count_below_spent')).toBeTruthy()
  })

  it('accepts a limit equal to what was spent — that is how a plan is closed', async () => {
    openDrawer({ ...plan, max_occurrences: 11, positions_spent: 5 })

    fireEvent.change(screen.getByLabelText('recurrences.create.end_count_label'), {
      target: { value: '5' },
    })
    save()

    await waitFor(() => expect(updateRecurrence).toHaveBeenCalled())
    expect(updateRecurrence.mock.calls[0][1].max_occurrences).toBe(5)
  })
})

describe('a rule carrying BOTH end conditions', () => {
  const both = { ...plan, max_occurrences: 11, end_date: '2027-12-31' }

  it('EDITING SOMETHING ELSE keeps both, and asks nothing', async () => {
    openDrawer(both)

    // The defect: the drawer reduced the rule to its seeded draft — one answer —
    // so a save after touching only the amount sent the exclusive pair and
    // deleted `end_date`, from a screen where the user never opened the end
    // condition at all.
    fireEvent.change(document.getElementById('description') as HTMLInputElement, {
      target: { value: 'Plan de pago corregido' },
    })

    expect(screen.queryByText('recurrences.create.end_both_title')).toBeNull()
    save()

    await waitFor(() => expect(updateRecurrence).toHaveBeenCalled())
    const patch = updateRecurrence.mock.calls[0][1]
    expect(patch.max_occurrences).toBe(11)
    expect(patch.end_date).toBe('2027-12-31')
  })

  it('says so and does not save until the user agrees', () => {
    openDrawer(both)

    // Touching the end condition is what raises the question. The rule already
    // opens on «después de N», and clicking a radio that is already checked
    // fires nothing — so the touch goes through the field.
    fireEvent.change(screen.getByLabelText('recurrences.create.end_count_label'), {
      target: { value: '12' },
    })
    expect(screen.getAllByText('recurrences.create.end_both_title').length).toBeGreaterThan(0)
    save()

    // Silently dropping one of the two is the same defect as #142 seen from the
    // other side: a condition the user never chose to remove, removed.
    expect(updateRecurrence).not.toHaveBeenCalled()
  })

  it('saves the chosen one once the user agrees', async () => {
    openDrawer(both)

    fireEvent.change(screen.getByLabelText('recurrences.create.end_count_label'), {
      target: { value: '12' },
    })
    fireEvent.click(screen.getByLabelText('recurrences.create.end_both_confirm'))
    save()

    await waitFor(() => expect(updateRecurrence).toHaveBeenCalled())
    const patch = updateRecurrence.mock.calls[0][1]
    expect(patch.max_occurrences).toBe(12)
    expect(patch.end_date).toBeNull()
  })

  it('asks AGAIN when the answer changes after being confirmed', () => {
    openDrawer(both)

    // Agreed to: keep the limit, drop the date.
    fireEvent.change(screen.getByLabelText('recurrences.create.end_count_label'), {
      target: { value: '12' },
    })
    fireEvent.click(screen.getByLabelText('recurrences.create.end_both_confirm'))

    // And then a different decision, which drops a different column. A yes given
    // for one answer is not a yes for this one.
    fireEvent.click(answer('end_on_date'))

    expect(
      (screen.getByLabelText('recurrences.create.end_both_confirm') as HTMLInputElement).checked,
    ).toBe(false)
    save()
    expect(updateRecurrence).not.toHaveBeenCalled()
  })

  it('says BOTH are removed when the answer is «sin límite»', () => {
    openDrawer(both)

    fireEvent.click(answer('end_never'))

    // The sentence has to match the payload: «sin límite» keeps neither, and the
    // single-condition wording would have promised one stays.
    expect(screen.getByText('recurrences.create.end_both_body_drop_all')).toBeTruthy()
    expect(screen.queryByText('recurrences.create.end_both_body_keep_one')).toBeNull()
  })

  it('removes both once that is confirmed', async () => {
    openDrawer(both)

    fireEvent.click(answer('end_never'))
    fireEvent.click(screen.getByLabelText('recurrences.create.end_both_confirm'))
    save()

    await waitFor(() => expect(updateRecurrence).toHaveBeenCalled())
    const patch = updateRecurrence.mock.calls[0][1]
    expect(patch.max_occurrences).toBeNull()
    expect(patch.end_date).toBeNull()
  })
})
