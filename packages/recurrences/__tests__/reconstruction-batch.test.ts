import { describe, expect, it } from 'vitest'
import { RECONSTRUCTION_BATCH_SIZE, selectReconstructionBatch } from '../src/queries'

/**
 * Which occurrences a single run writes. The rule that matters is not the size:
 * it is that the CURRENT occurrence of every rule is always in it. A batch that
 * filled up with the oldest dates would leave out what falls due today — #96
 * again, with another number.
 */

const dailyDates = (count: number, from = 1) =>
  Array.from({ length: count }, (_, i) => `2026-01-${String(from + i).padStart(2, '0')}`)

describe('selectReconstructionBatch', () => {
  it('takes everything when the backlog fits', () => {
    const batch = selectReconstructionBatch(new Map([['r1', ['2026-06-23', '2026-07-23']]]))
    expect(batch.get('r1')).toEqual(['2026-06-23', '2026-07-23'])
  })

  it('caps the run at the batch size', () => {
    const batch = selectReconstructionBatch(new Map([['r1', dailyDates(31)]]), 10)
    expect(batch.get('r1')).toHaveLength(10)
  })

  it('always includes the current occurrence, oldest-first for the rest', () => {
    const owed = dailyDates(31) // 2026-01-01 … 2026-01-31
    const batch = selectReconstructionBatch(new Map([['r1', owed]]), 3)

    // The most recent one already due, plus the two oldest.
    expect(batch.get('r1')).toEqual(['2026-01-01', '2026-01-02', '2026-01-31'])
  })

  it('never drops a rule current occurrence to make room for another rule backlog', () => {
    // Rule A is owed a year; rule B is owed one. A budget of 2 must still cover
    // B's only occurrence — starving it would hide what B owes today behind A's
    // history.
    const batch = selectReconstructionBatch(
      new Map([
        ['a', dailyDates(31)],
        ['b', ['2026-02-10']],
      ]),
      2,
    )

    expect(batch.get('b')).toEqual(['2026-02-10'])
    expect(batch.get('a')).toEqual(['2026-01-31'])
  })

  it('never writes more rows than the batch size, however many rules are stuck', () => {
    // More rules with backlog than the batch size. The limit is HARD: production
    // has 61 rules, so a batch that bent for every rule's current occurrence
    // would write 61 rows on a run that declares 50. What does not fit is left
    // for the next run, which is what `remaining` and the continue action are.
    const owed = new Map(
      Array.from({ length: 5 }, (_, i) => [`r${i}`, ['2026-03-01', '2026-04-01']] as const),
    )
    const batch = selectReconstructionBatch(new Map(owed), 2)

    const total = [...batch.values()].reduce((sum, dates) => sum + dates.length, 0)
    expect(total).toBe(2)
    // And what it did write is one current occurrence each, not one rule's history.
    for (const dates of batch.values()) expect(dates).toEqual(['2026-04-01'])
  })

  it('serves the most overdue rule first when the currents do not all fit', () => {
    const batch = selectReconstructionBatch(
      new Map([
        ['fresh', ['2026-08-01']],
        ['stuck', ['2026-02-01']],
        ['stale', ['2026-05-01']],
      ]),
      2,
    )

    expect([...batch.keys()].sort()).toEqual(['stale', 'stuck'])
    expect(batch.has('fresh')).toBe(false)
  })

  it('skips rules that owe nothing', () => {
    const batch = selectReconstructionBatch(
      new Map([
        ['r1', []],
        ['r2', ['2026-06-23']],
      ]),
    )
    expect(batch.has('r1')).toBe(false)
    expect(batch.get('r2')).toEqual(['2026-06-23'])
  })

  it('defaults to 50 per run', () => {
    expect(RECONSTRUCTION_BATCH_SIZE).toBe(50)
    const batch = selectReconstructionBatch(new Map([['r1', dailyDates(31).concat(dailyDates(31, 1).map((d) => d.replace('01-', '02-')))]]))
    expect(batch.get('r1')!.length).toBeLessThanOrEqual(50)
  })
})
