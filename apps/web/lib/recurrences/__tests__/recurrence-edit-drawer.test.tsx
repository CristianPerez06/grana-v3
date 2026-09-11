// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { act } from 'react'

/**
 * The reference date reaches the mutation (#121).
 *
 * The field is one `useState` away from being decorative: a drawer can render a
 * date picker, change its value and never put it in the payload, and the screen
 * looks identical either way. What this pins is the wire — that what the user
 * picked is what `updateRecurrence` receives — and that the hint explaining the
 * consequence is on screen BEFORE saving, not after.
 */

const updateRecurrence = vi.fn()
const refresh = vi.fn()

vi.mock('@/app/_actions/recurrences', () => ({
  updateRecurrence: (...args: unknown[]) => updateRecurrence(...args),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}))
// Fixed, because the candidates are computed from it: a suite that walked the
// real calendar would assert different dates every day it runs.
vi.mock('@grana/money-logic', async () => {
  const actual = await vi.importActual<typeof import('@grana/money-logic')>('@grana/money-logic')
  return { ...actual, getTodayAR: () => new Date('2026-09-10T12:00:00Z') }
})
// The drawer is a portal with focus traps; the fields are the subject.
vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
}))
vi.mock('@/components/ui/money-calculator-popover', () => ({
  MoneyCalculatorPopover: () => null,
}))
vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({
    id,
    value,
    onChange,
  }: {
    id: string
    value: string
    onChange: (next: string) => void
  }) => (
    <input
      data-testid={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}))

const { RecurrenceEditDrawer } = await import(
  '@/app/(app)/transactions/recurring/[id]/_components/recurrence-edit-drawer'
)

const rule = {
  id: 'r1',
  amount: 100000,
  frequency: 'monthly',
  status: 'active',
  interval_count: 1,
  interval_unit: 'month',
  max_occurrences: null,
  start_date: '2026-06-08',
  end_date: null,
  description: null,
  // The drawer counts them to know how much of the cap is left.
  instances: [{ id: 'i1' }, { id: 'i2' }, { id: 'i3' }],
} as unknown as Parameters<typeof RecurrenceEditDrawer>[0]['rule']

const renderDrawer = () =>
  render(<RecurrenceEditDrawer rule={rule} open onClose={() => {}} />)

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  updateRecurrence.mockReset()
  updateRecurrence.mockResolvedValue({ ok: true })
  refresh.mockReset()
})
afterEach(cleanup)

describe('the reference date field', () => {
  it('opens on the rule’s current anchor', () => {
    renderDrawer()
    expect(screen.getByTestId('start_date').getAttribute('value')).toBe('2026-06-08')
  })

  it('says what the change will and will not do, before saving', () => {
    // Without this line, an occurrence left on the old day reads as a bug.
    renderDrawer()
    expect(screen.getByText('recurrences.reference_date_hint')).toBeTruthy()
  })

  it('sends the corrected date to the mutation', async () => {
    const { container } = renderDrawer()
    const field = screen.getByTestId('start_date') as HTMLInputElement

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )!.set!
      setter.call(field, '2026-06-10')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })

    await act(async () => {
      container.querySelector('form')!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
    })

    expect(updateRecurrence).toHaveBeenCalledTimes(1)
    expect(updateRecurrence.mock.calls[0][1]).toMatchObject({ start_date: '2026-06-10' })
  })

  it('keeps the anchor when the user edits something else', async () => {
    // A payload that only carries what changed would drop the anchor here; the
    // mutation merges against the current row, so sending it unchanged is safe
    // and keeps the field honest about what it is.
    const { container } = renderDrawer()
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
    })
    expect(updateRecurrence.mock.calls[0][1]).toMatchObject({ start_date: '2026-06-08' })
  })
})

describe('the question the calendar cannot answer', () => {
  const moveAnchorTo = async (value: string) => {
    const field = screen.getByTestId('start_date') as HTMLInputElement
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )!.set!
      setter.call(field, value)
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('is not asked while the anchor has not moved', () => {
    renderDrawer()
    expect(screen.queryByText('recurrences.reference_date_question')).toBeNull()
  })

  it('offers the two next occurrences once it moves', async () => {
    renderDrawer()
    await moveAnchorTo('2026-06-10')
    expect(screen.getByText('recurrences.reference_date_question')).toBeTruthy()
    const options = screen
      .getAllByRole('radio')
      .map((input) => (input as HTMLInputElement).value)
    expect(options).toEqual(['2026-09-10', '2026-10-10'])
  })

  it('sends the one the user picked', async () => {
    const { container } = renderDrawer()
    await moveAnchorTo('2026-06-10')
    await act(async () => {
      const later = screen
        .getAllByRole('radio')
        .find((input) => (input as HTMLInputElement).value === '2026-10-10')!
      ;(later as HTMLInputElement).click()
    })
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
    })
    expect(updateRecurrence.mock.calls[0][1]).toMatchObject({
      start_date: '2026-06-10',
      schedule_effective_from: '2026-10-10',
    })
  })

  it('defaults to the first when the user does not choose', async () => {
    // Not an empty payload: the database refuses an anchor that moves without an
    // effective date, so the form always carries one.
    const { container } = renderDrawer()
    await moveAnchorTo('2026-06-10')
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
    })
    expect(updateRecurrence.mock.calls[0][1]).toMatchObject({
      schedule_effective_from: '2026-09-10',
    })
  })
})
