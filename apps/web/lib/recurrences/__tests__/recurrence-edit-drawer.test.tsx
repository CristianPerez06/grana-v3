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
  start_date: '2026-06-08',
  end_date: null,
  description: null,
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
