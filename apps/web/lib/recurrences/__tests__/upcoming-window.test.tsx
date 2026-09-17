// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { RecurrenceSummary } from '@/lib/recurrences/types'

/**
 * "LO QUE VIENE" IS A WINDOW OF DAYS, NOT WHAT IS LEFT OF THE MONTH.
 *
 * The second card used to run to the end of the calendar month. From the day
 * `today + 8` lands in the next month — the 23rd, in a 30-day month — its range
 * started after it ended, so it was EMPTY BY CONSTRUCTION. Not empty because
 * nothing was coming: October's rent simply appeared nowhere, and the app's
 * horizon silently shrank to a week, one week in four, every month.
 *
 * Today is pinned to the 25th on purpose. That is inside the broken stretch, so
 * each test here fails against the old window and passes against the new one —
 * a suite pinned to the 8th would have passed either way and proved nothing.
 */

// LOCAL midnight, the shape `getTodayAR` returns — see the sibling suite for why
// a UTC instant would make these assertions depend on the machine's zone.
vi.mock('@grana/money-logic', async () => {
  const actual = await vi.importActual<typeof import('@grana/money-logic')>('@grana/money-logic')
  return { ...actual, getTodayAR: () => new Date(2026, 8, 25) }
})
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}))
// `UpcomingCard` is a client component and reaches for the client hook.
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}))

const { UpcomingRecurrences } = await import(
  '@/app/(app)/transactions/recurring/_components/upcoming-recurrences'
)

afterEach(cleanup)

/** A monthly rule anchored on `start`, with nothing covered yet. */
const monthly = (id: string, description: string, start: string): RecurrenceSummary =>
  ({
    id,
    description,
    amount: 500_000,
    currency_code: 'ARS',
    movement_type: 'expense',
    status: 'active',
    start_date: start,
    end_date: null,
    interval_count: 1,
    interval_unit: 'month',
    max_occurrences: null,
    schedule_effective_from: start,
    account: { id: 'bank', name: 'Cuenta', type: 'bank' },
    destination_account: null,
    category: null,
    subcategory: null,
    pending_instances: [],
    covered_occurrences: [],
    next_occurrence: null,
  }) as unknown as RecurrenceSummary

/**
 * A YEARLY rule, for the edge cases. A monthly rule anchored on the 26th also
 * falls due on 26/09 — inside the FIRST card — so it would show up on screen for
 * a reason that has nothing to do with the second window's upper bound. Yearly
 * keeps exactly one occurrence in range, which is what the assertion is about.
 */
const yearly = (id: string, description: string, start: string): RecurrenceSummary =>
  ({ ...monthly(id, description, start), interval_unit: 'year' }) as unknown as RecurrenceSummary

const show = async (rules: RecurrenceSummary[]) => render(await UpcomingRecurrences({ rules }))

describe('la segunda ventana llega a 30 días', () => {
  it('muestra el alquiler del mes que viene, que antes no aparecía en ninguna parte', async () => {
    // Anchored on the 23rd, so the next occurrence is 23/10 — past the end of
    // September and inside 30 days. Under the old window this row existed in
    // neither card.
    await show([monthly('r-alquiler', 'Alquiler', '2026-06-23')])

    expect(screen.getByText('Alquiler')).toBeTruthy()
    expect(screen.getByText('23 oct')).toBeTruthy()
  })

  it('la ventana llega hasta el día 30 y no más', async () => {
    await show([
      yearly('r-dentro', 'Prepaga', '2025-10-25'),
      yearly('r-fuera', 'Expensas', '2025-10-26'),
    ])

    // 25/10 is exactly `today + 30`; 26/10 is one day past it.
    expect(screen.getByText('25 oct')).toBeTruthy()
    expect(screen.getByText('Prepaga')).toBeTruthy()
    expect(screen.queryByText('26 oct')).toBeNull()
    expect(screen.queryByText('Expensas')).toBeNull()
  })

  it('las dos ventanas siguen siendo disjuntas', async () => {
    // 28/09 falls in the first window, 23/10 in the second. Widening the second
    // one must not make it swallow the first: an occurrence listed twice reads
    // as two commitments.
    await show([
      monthly('r-cerca', 'Internet', '2026-06-28'),
      monthly('r-lejos', 'Alquiler', '2026-06-23'),
    ])

    expect(screen.getAllByText('28 sept')).toHaveLength(1)
    expect(screen.getAllByText('23 oct')).toHaveLength(1)
    expect(screen.getAllByText('Internet')).toHaveLength(1)
    expect(screen.getAllByText('Alquiler')).toHaveLength(1)
  })
})

/**
 * THE CARD IS CAPPED, because widening the window is what made it long.
 *
 * Sixteen rows push the rule list far enough down that someone who came to edit
 * a rule scrolls past a card they were not looking for. The horizon was the fix;
 * the length was its cost, and it lands on a different part of the screen.
 */
describe('la tarjeta muestra cinco y ofrece el resto', () => {
  /**
   * Eight monthly rules falling due 10–17 October: all of them inside the SECOND
   * window (03–25 Oct from the 25th) and none in the first. Spreading them across
   * both cards would count the two cards' rows together and say nothing about
   * either one's cap.
   */
  const eight = Array.from({ length: 8 }, (_, i) =>
    monthly(`r${i}`, `Regla ${i}`, `2026-06-${10 + i}`),
  )

  it('muestra cinco filas y un botón que dice cuántas faltan', async () => {
    await show(eight)

    // Five of the eight are drawn; the button names the three that are not.
    expect(screen.getAllByText(/^Regla /)).toHaveLength(5)
    expect(screen.getByText('recurrences.upcoming.show_rest')).toBeTruthy()
  })

  it('al tocarlo aparecen todas', async () => {
    await show(eight)
    fireEvent.click(screen.getByText('recurrences.upcoming.show_rest'))

    expect(screen.getAllByText(/^Regla /)).toHaveLength(8)
    expect(screen.queryByText('recurrences.upcoming.show_rest')).toBeNull()
  })

  it('con cinco o menos no ofrece nada que abrir', async () => {
    await show(eight.slice(0, 4))

    expect(screen.getAllByText(/^Regla /)).toHaveLength(4)
    expect(screen.queryByText('recurrences.upcoming.show_rest')).toBeNull()
  })
})
