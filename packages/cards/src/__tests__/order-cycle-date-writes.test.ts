import { describe, expect, it } from 'vitest'
import { orderCycleDateWrites } from '../presentation'

const cycle = {
  currentPeriodId: 'cur',
  currentEndDate: '2026-06-25',
  currentDueDate: '2026-07-08',
  nextPeriodId: 'nxt',
  nextEndDate: '2026-07-25',
  nextDueDate: '2026-08-07',
}
const untouched = {
  currentEnd: '2026-06-25',
  currentDue: '2026-07-08',
  nextEnd: '2026-07-25',
  nextDue: '2026-08-07',
}

describe('orderCycleDateWrites', () => {
  it('writes nothing when nothing changed', () => {
    expect(orderCycleDateWrites(cycle, untouched)).toEqual([])
  })

  it('writes the current first in the usual case', () => {
    const writes = orderCycleDateWrites(cycle, {
      ...untouched,
      currentEnd: '2026-06-27',
      nextEnd: '2026-07-28',
    })
    expect(writes.map((w) => w.periodId)).toEqual(['cur', 'nxt'])
  })

  it('writes the next first when the new current close passes its stored close (the reported case)', () => {
    const writes = orderCycleDateWrites(cycle, {
      currentEnd: '2026-10-22',
      currentDue: '2026-11-01',
      nextEnd: '2026-11-30',
      nextDue: '2026-12-06',
    })
    expect(writes).toEqual([
      { periodId: 'nxt', end_date: '2026-11-30', due_date: '2026-12-06' },
      { periodId: 'cur', end_date: '2026-10-22', due_date: '2026-11-01' },
    ])
  })

  it('writes only the current when only it changed, even past the next close', () => {
    const writes = orderCycleDateWrites(cycle, { ...untouched, currentEnd: '2026-08-01' })
    expect(writes.map((w) => w.periodId)).toEqual(['cur'])
  })
})
