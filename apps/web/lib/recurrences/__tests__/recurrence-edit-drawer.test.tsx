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
  // LOCAL midnight, the shape the real `getTodayAR` returns — a UTC instant is
  // read back by `formatDateISO` as the NEXT day east of UTC, which moves every
  // candidate a month.
  return { ...actual, getTodayAR: () => new Date(2026, 8, 10) }
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

    await act(async () => {
      ;(screen.getAllByRole('radio')[0] as HTMLInputElement).click()
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

  it('refuses to save until it is answered', async () => {
    // It used to send the first option when the user had not picked one. That is
    // the inference this whole change exists to remove: from the data, "the cycle
    // in flight is already settled" and "it is not" look exactly the same, and
    // guessing wrong is the second salary in one month that started #121.
    const { container } = renderDrawer()
    await moveAnchorTo('2026-06-10')
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
    })
    expect(updateRecurrence).not.toHaveBeenCalled()
    expect(screen.getByText('recurrences.errors.reference_date_unanswered')).toBeTruthy()
  })

  it('has nothing preselected, so nothing is chosen by omission', async () => {
    renderDrawer()
    await moveAnchorTo('2026-06-10')
    expect(screen.getAllByRole('radio').some((r) => (r as HTMLInputElement).checked)).toBe(false)
  })

  it('carries the answer once it is given', async () => {
    const { container } = renderDrawer()
    await moveAnchorTo('2026-06-10')
    await act(async () => {
      ;(screen
        .getAllByRole('radio')
        .find((input) => (input as HTMLInputElement).value === '2026-09-10')! as HTMLInputElement).click()
    })
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

// ═══════════════════════════════════════════════════════════════════════════
// The question and the answer have to describe the SAME rule.
//
// The dates offered come from a calendar, and the server recomputes them from
// the calendar the patch is about to save. Anything the form reads off the
// stored row instead is a different rule, and the two disagree the moment the
// user edits both halves in one pass.
// ═══════════════════════════════════════════════════════════════════════════

const setField = async (testId: string, value: string) => {
  const field = screen.getByTestId(testId) as HTMLInputElement
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!
    setter.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const setSelect = async (id: string, value: string) => {
  const select = document.getElementById(id) as HTMLSelectElement
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      'value',
    )!.set!
    setter.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const submit = async (container: HTMLElement) => {
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
  })
}

const offered = () =>
  [...document.querySelectorAll('input[name="schedule_effective_from"]')].map(
    (input) => (input as HTMLInputElement).value,
  )

describe('changing the frequency and the reference date in one pass', () => {
  it('offers the dates of the frequency being SAVED, not the stored one', async () => {
    // Today is 2026-09-10. Anchored on 12/06 and switched to weekly, the calendar
    // keeps the WEEKDAY: 12/06/2026 is a Friday, so the next two occurrences are
    // 11/09 and 18/09. Read off the stored monthly frequency they would be 12/09
    // and 12/10, and the server, which recomputes from the patch, refuses both.
    renderDrawer()
    await setSelect('frequency', 'weekly')
    await setField('start_date', '2026-06-12')

    expect(offered()).toEqual(['2026-09-11', '2026-09-18'])
  })
})

describe('a choice that stopped being one of the options', () => {
  it('is not carried over when the reference date changes again', async () => {
    const { container } = renderDrawer()
    await setField('start_date', '2026-06-12')
    const first = offered()
    // The user picks the SECOND date — "from the next cycle".
    await act(async () => {
      ;(document.querySelector(
        `input[name="schedule_effective_from"][value="${first[1]}"]`,
      ) as HTMLInputElement).click()
    })

    // Then thinks again and moves the reference date somewhere else entirely.
    await setField('start_date', '2026-06-20')
    const second = offered()
    expect(second).not.toContain(first[1])

    // The old answer is gone, not carried: saving now asks again rather than
    // sending a date these options never contained.
    await submit(container)
    expect(updateRecurrence).not.toHaveBeenCalled()

    await act(async () => {
      ;(document.querySelector(
        `input[name="schedule_effective_from"][value="${second[0]}"]`,
      ) as HTMLInputElement).click()
    })
    await submit(container)
    const sent = updateRecurrence.mock.calls[0][1] as { schedule_effective_from: string }
    expect(sent.schedule_effective_from).toBe(second[0])
  })
})

describe('a rule with no occurrences left', () => {
  // The cap is spent: there is no next vencimiento, so there is no date that
  // could be the first one under a new reference.
  const exhausted = {
    ...(rule as unknown as Record<string, unknown>),
    max_occurrences: 3,
    positions_spent: 3,
  } as unknown as Parameters<typeof RecurrenceEditDrawer>[0]['rule']

  it('does not send a change the database is going to refuse', async () => {
    // The screen used to say the reference "solo queda guardada" and then send
    // `schedule_effective_from: null`, which the server rejects for any active
    // rule whose anchor moves. The user read a promise and got an error.
    const { container } = render(
      <RecurrenceEditDrawer rule={exhausted} open onClose={() => {}} />,
    )
    await setField('start_date', '2026-06-12')
    expect(screen.getByText('recurrences.reference_date_exhausted')).toBeTruthy()

    await submit(container)
    expect(updateRecurrence).not.toHaveBeenCalled()
  })

  it('still saves everything else', async () => {
    // Only the reference date is impossible here. Leaving it alone, the rest of
    // the form works as it always did.
    const { container } = render(
      <RecurrenceEditDrawer rule={exhausted} open onClose={() => {}} />,
    )
    await submit(container)
    expect(updateRecurrence).toHaveBeenCalledTimes(1)
  })
})

describe('a rule with a custom frequency', () => {
  // The spec admits `frequency: 'custom'` — a rule every three days has no
  // preset. `presetToInterval` only knows the four, so asking it about a custom
  // rule returns nothing and the form throws before it renders: the user cannot
  // open the screen at all.
  const everyThreeDays = {
    ...(rule as unknown as Record<string, unknown>),
    frequency: 'custom',
    interval_count: 3,
    interval_unit: 'day',
  } as unknown as Parameters<typeof RecurrenceEditDrawer>[0]['rule']

  const renderCustom = () =>
    render(<RecurrenceEditDrawer rule={everyThreeDays} open onClose={() => {}} />)

  it('opens', () => {
    renderCustom()
    expect(screen.getByTestId('start_date').getAttribute('value')).toBe('2026-06-08')
  })

  it('says it is custom instead of showing one of the four presets', () => {
    renderCustom()
    expect((document.getElementById('frequency') as HTMLSelectElement).value).toBe('custom')
  })

  it('offers the dates of the interval the rule actually has', async () => {
    // Every three days from 11/06; today is 10/09. 11/06 + 90 days is 09/09, so
    // the next two are 12/09 and 15/09. Read as a preset it would offer monthly
    // dates, which the server — recomputing from the rule's real interval —
    // refuses.
    renderCustom()
    await setField('start_date', '2026-06-11')
    expect(offered()).toEqual(['2026-09-12', '2026-09-15'])
  })
})
