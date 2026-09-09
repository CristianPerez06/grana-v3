import { describe, expect, it } from 'vitest'
import { owedOccurrences, type OccurrenceSchedule } from '../src/recurrences'

/**
 * Resolving out of order.
 *
 * With a cursor this could not even be expressed: the cursor is ONE date, so
 * resolving August before July would either drag the rule past July — losing it
 * — or refuse to move at all. Deriving what is owed from the calendar minus what
 * exists makes the order irrelevant by construction, and these cases pin that as
 * a property rather than as a single snapshot.
 *
 * The rule: monthly on the 10th, floor at 2026-05-10, today 2026-09-08. June,
 * July and August are owed; September is not (the 10th has not arrived).
 */

const TODAY = '2026-09-08'
const HORIZON = '2025-09-08'
const FLOOR = '2026-05-10'

const monthly: OccurrenceSchedule = {
  start_date: '2026-01-10',
  end_date: null,
  interval_count: 1,
  interval_unit: 'month',
  max_occurrences: null,
}

const owedAfter = (existing: string[]): string[] =>
  owedOccurrences({
    schedule: monthly,
    reconstructFrom: FLOOR,
    horizon: HORIZON,
    today: TODAY,
    existing,
  })

const JUN = '2026-06-10'
const JUL = '2026-07-10'
const AUG = '2026-08-10'

describe('resolving out of order', () => {
  it('the starting point: three occurrences are owed', () => {
    expect(owedAfter([])).toEqual([JUN, JUL, AUG])
  })

  it('resolving August first does not regenerate it, and does not skip June or July', () => {
    // The three things 1.8 asks for, in one step: August is gone from the list,
    // June is still there — it was NOT skipped over — and July too.
    const owed = owedAfter([AUG])
    expect(owed).not.toContain(AUG)
    expect(owed).toEqual([JUN, JUL])
  })

  it('then resolving July leaves only June, still owed', () => {
    const owed = owedAfter([AUG, JUL])
    expect(owed).toEqual([JUN])
  })

  it('and resolving June closes the rule out, with nothing regenerated', () => {
    expect(owedAfter([AUG, JUL, JUN])).toEqual([])
  })

  it('the schedule itself never moves: the dates are the same in every order', () => {
    // Whatever order the user resolves in, what is owed is always the calendar
    // minus what exists — so the DATES never shift. A cursor could not promise
    // this: it would have advanced past July when August was resolved.
    const orders: string[][] = [
      [JUN, JUL, AUG],
      [AUG, JUL, JUN],
      [JUL, AUG, JUN],
      [AUG, JUN, JUL],
    ]
    for (const order of orders) {
      const seen: string[] = []
      const emitted: string[] = []
      for (const date of order) {
        // At each step, everything still owed must be a date the calendar itself
        // produced — never a shifted one.
        for (const owed of owedAfter(seen)) expect([JUN, JUL, AUG]).toContain(owed)
        expect(owedAfter(seen)).toContain(date)
        seen.push(date)
        emitted.push(date)
      }
      expect(owedAfter(seen)).toEqual([])
      expect([...emitted].sort()).toEqual([JUN, JUL, AUG])
    }
  })

  it('a gap left in the middle is still owed, however late it is filled', () => {
    // June left unresolved while July and August are done. It does not expire and
    // it does not move: it is still the 2026-06-10.
    expect(owedAfter([JUL, AUG])).toEqual([JUN])
    // And once it is finally resolved, nothing comes back.
    expect(owedAfter([JUL, AUG, JUN])).toEqual([])
  })

  it('an occurrence resolved out of order does not drag the floor with it', () => {
    // The floor is the rule's, not the resolution's. Resolving August does not
    // make May or earlier owed again, and does not make June stop being owed.
    const owed = owedAfter([AUG])
    expect(owed).not.toContain('2026-05-10')
    expect(owed).not.toContain('2026-04-10')
    expect(owed[0]).toBe(JUN)
  })

  it('skipping one and confirming another, in any order, behaves the same', () => {
    // The list does not care HOW an occurrence was resolved — only that it
    // exists. Skipping July and confirming August leaves exactly June.
    expect(owedAfter([JUL, AUG])).toEqual([JUN])
    expect(owedAfter([AUG, JUL])).toEqual([JUN])
  })
})
