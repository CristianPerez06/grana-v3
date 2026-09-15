// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * «¿Cómo termina?» on web, driven through the real form (#142).
 *
 * The model has its own tests in `@grana/money-logic` and they would have passed
 * while this screen was still broken: the defect was never in what an answer
 * MEANS, it was in a payload assembled field by field, where the date respected
 * the switch and the count did not. So this drives the actual modal and looks at
 * what reaches the server action.
 *
 * THE SCENARIO IS THE ONE THAT OPENED THE TICKET: choose «después de N», type
 * 11, change your mind, choose «sin límite», save. The rule that started all
 * this was created almost exactly that way and went out with a limit of 1.
 */

/** Typed with its payload, so `mock.calls[0][0]` is the thing under test. */
const createRecurrence = vi.fn(async (payload: Record<string, unknown>) => ({
  ok: true as const,
  id: String(payload.account_id ?? 'r1'),
}))
const checkDuplicateRecurrences = vi.fn(async () => [])

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }))
vi.mock('@/app/_actions/recurrences', () => ({ createRecurrence, checkDuplicateRecurrences }))
vi.mock('@/lib/preferences-context', () => ({ useShowCents: () => false }))
// Radix renders a popover's content only once it is open, through a portal the
// happy-dom environment does not drive. Rendering both halves inline keeps the
// category picker reachable — this test is about the end condition, and getting
// to the save button should not be the hard part.
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) => (
    <div>
      {trigger}
      {children}
    </div>
  ),
}))
vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  useDrawerContainer: () => null,
}))

const { CreateRecurrenceModal } = await import(
  '@/app/(app)/transactions/recurring/_components/create-recurrence-modal'
)

const accounts = [
  {
    id: 'a1',
    name: 'Billetera',
    type: 'cash' as const,
    activeCurrencies: ['ARS'] as ('ARS' | 'USD')[],
  },
]
const categories = [
  {
    id: 'c1',
    name: 'Comida',
    canonical_name: 'food',
    type: 'expense',
    user_id: null,
    subcategories: [],
  },
] as unknown as Parameters<typeof CreateRecurrenceModal>[0]['categories']

const openModal = () =>
  render(
    <CreateRecurrenceModal
      open
      onClose={() => {}}
      accounts={accounts}
      categories={categories}
    />,
  )

/** The radio for one of the three answers. */
const answer = (key: string) => screen.getByLabelText(`recurrences.create.${key}`)

afterEach(() => {
  cleanup()
  createRecurrence.mockClear()
  checkDuplicateRecurrences.mockClear()
})

describe('the end condition the web form sends', () => {
  it('sends NO limit after a count was typed and then abandoned', async () => {
    openModal()

    fireEvent.click(answer('end_after_count'))

    const count = screen.getByLabelText('recurrences.create.end_count_label')
    fireEvent.change(count, { target: { value: '11' } })
    expect((count as HTMLInputElement).value).toBe('11')

    // The change of mind.
    fireEvent.click(answer('end_never'))

    // The field is gone from the screen…
    expect(screen.queryByLabelText('recurrences.create.end_count_label')).toBeNull()

    submit()

    await waitFor(() => expect(createRecurrence).toHaveBeenCalled())
    const payload = createRecurrence.mock.calls[0][0]
    // …and gone from the payload. Before this change it was still in there.
    expect(payload).not.toHaveProperty('max_occurrences')
    expect(payload).not.toHaveProperty('end_date')
  })

  it('sends the limit when «después de N» is the answer, and no end date', async () => {
    openModal()

    fireEvent.click(answer('end_after_count'))
    fireEvent.change(screen.getByLabelText('recurrences.create.end_count_label'), {
      target: { value: '11' },
    })

    submit()

    await waitFor(() => expect(createRecurrence).toHaveBeenCalled())
    const payload = createRecurrence.mock.calls[0][0]
    expect(payload.max_occurrences).toBe(11)
    expect(payload).not.toHaveProperty('end_date')
  })

  it('does not let the wheel or the arrow keys change the count', () => {
    openModal()
    fireEvent.click(answer('end_after_count'))

    const count = screen.getByLabelText('recurrences.create.end_count_label') as HTMLInputElement
    fireEvent.change(count, { target: { value: '11' } })

    // `type="number"` reacts to both — one wheel notch over a focused field is
    // `value − step`, silently. This field is text, so it cannot.
    expect(count.type).toBe('text')
    expect(count.inputMode).toBe('numeric')

    fireEvent.wheel(count, { deltaY: -100 })
    fireEvent.keyDown(count, { key: 'ArrowDown' })
    fireEvent.keyDown(count, { key: 'ArrowUp' })

    expect(count.value).toBe('11')
  })

  it('keeps out anything that is not a digit', () => {
    openModal()
    fireEvent.click(answer('end_after_count'))

    const count = screen.getByLabelText('recurrences.create.end_count_label') as HTMLInputElement
    fireEvent.change(count, { target: { value: '1a1,5-' } })

    expect(count.value).toBe('115')
  })
})

/** Fill the minimum a rule needs and press save. */
function submit() {
  fireEvent.change(document.getElementById('rec-amount') as HTMLInputElement, {
    target: { value: '10000' },
  })
  // A category is required for an expense, and the picker is a popover: setting
  // it through the UI would be three interactions about something this test is
  // not asking about. The only one that IS the subject is the end condition.
  fireEvent.click(screen.getByText('categories.food'))
  fireEvent.click(screen.getByText('recurrences.actions.create'))
}
