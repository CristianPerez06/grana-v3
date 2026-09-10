import { describe, expect, it } from 'vitest'
import {
  RECONSTRUCTION_BATCH_SIZE,
  reconstructionHorizon,
  selectReconstructionBatch,
  type RuleBacklog,
} from '../src/queries'

/**
 * Which occurrences a single run writes. Two properties matter, and neither is
 * the size: the limit is HARD, and no rule can be starved by another across
 * runs.
 */

const dailyDates = (count: number, from = 1) =>
  Array.from({ length: count }, (_, i) => `2026-01-${String(from + i).padStart(2, '0')}`)

/** A rule owed `owed`, with nothing materialized: its current occurrence is missing. */
const unserved = (owed: string[]): RuleBacklog => ({
  owed,
  newestExisting: null,
  hasPending: false,
})

/** A rule whose current occurrence already exists — only older backlog is left. */
const served = (owed: string[], newestExisting: string): RuleBacklog => ({
  owed,
  newestExisting,
  hasPending: false,
})

describe('selectReconstructionBatch', () => {
  it('takes everything when the backlog fits', () => {
    const batch = selectReconstructionBatch(
      new Map([['r1', unserved(['2026-06-23', '2026-07-23'])]]),
    )
    expect(batch.get('r1')).toEqual(['2026-06-23', '2026-07-23'])
  })

  it('caps the run at the batch size', () => {
    const batch = selectReconstructionBatch(new Map([['r1', unserved(dailyDates(31))]]), 10)
    expect(batch.get('r1')).toHaveLength(10)
  })

  it('always includes the current occurrence, oldest-first for the rest', () => {
    const batch = selectReconstructionBatch(new Map([['r1', unserved(dailyDates(31))]]), 3)

    // The most recent one already due, plus the two oldest.
    expect(batch.get('r1')).toEqual(['2026-01-01', '2026-01-02', '2026-01-31'])
  })

  it('never writes more rows than the batch size, however many rules are stuck', () => {
    // Production has 61 rules, so a batch that bent for every rule's current
    // occurrence would write 61 rows on a run that declares 50.
    const owed = new Map(
      Array.from({ length: 5 }, (_, i) => [`r${i}`, unserved(['2026-03-01', '2026-04-01'])]),
    )
    const batch = selectReconstructionBatch(owed, 2)

    const total = [...batch.values()].reduce((sum, dates) => sum + dates.length, 0)
    expect(total).toBe(2)
    for (const dates of batch.values()) expect(dates).toEqual(['2026-04-01'])
  })

  it('serves the most overdue unserved rule first when they do not all fit', () => {
    const batch = selectReconstructionBatch(
      new Map([
        ['fresh', unserved(['2026-08-01'])],
        ['stuck', unserved(['2026-02-01'])],
        ['stale', unserved(['2026-05-01'])],
      ]),
      2,
    )

    expect([...batch.keys()].sort()).toEqual(['stale', 'stuck'])
    expect(batch.has('fresh')).toBe(false)
  })

  it('skips rules that owe nothing', () => {
    const batch = selectReconstructionBatch(
      new Map([
        ['r1', unserved([])],
        ['r2', unserved(['2026-06-23'])],
      ]),
    )
    expect(batch.has('r1')).toBe(false)
    expect(batch.get('r2')).toEqual(['2026-06-23'])
  })

  it('defaults to 50 per run', () => {
    expect(RECONSTRUCTION_BATCH_SIZE).toBe(50)
  })
})

describe('selectReconstructionBatch — no rule is starved by another', () => {
  it('lets a rule whose current is missing beat one whose current already exists', () => {
    // `served` owes an OLDER date than `unserved` does, so ordering by date alone
    // would hand it the whole budget. It already has today covered; the other
    // rule has nothing.
    const batch = selectReconstructionBatch(
      new Map([
        ['already-served', served(['2026-01-05', '2026-01-06'], '2026-08-31')],
        ['nothing-yet', unserved(['2026-07-01'])],
      ]),
      1,
    )

    expect([...batch.keys()]).toEqual(['nothing-yet'])
  })

  it('finishes every rule in two runs when 61 of them are stuck and the batch is 50', () => {
    // The shape production is in. Run one serves 50; run two must serve the other
    // 11 — under date-only ordering the first 50 came back owing OLDER dates and
    // won again, forever.
    const owedFor = (index: number) => [`2026-0${(index % 3) + 1}-01`, '2026-08-01']
    const first = new Map(
      Array.from({ length: 61 }, (_, i) => [`r${i}`, unserved(owedFor(i))] as const),
    )

    const runOne = selectReconstructionBatch(new Map(first), 50)
    const servedInRunOne = new Set(runOne.keys())
    expect(servedInRunOne.size).toBe(50)

    // What the next run sees: the rules just served now hold their current
    // occurrence, so only their older backlog is left.
    const second = new Map(
      [...first].map(([ruleId, backlog]) => {
        if (!servedInRunOne.has(ruleId)) return [ruleId, backlog] as const
        const written = runOne.get(ruleId) ?? []
        return [
          ruleId,
          served(
            backlog.owed.filter((date) => !written.includes(date)),
            '2026-08-01',
          ),
        ] as const
      }),
    )

    const runTwo = selectReconstructionBatch(second, 50)

    for (const ruleId of first.keys()) {
      const covered = servedInRunOne.has(ruleId) || runTwo.has(ruleId)
      expect(covered, `${ruleId} was never served`).toBe(true)
    }
  })

  it('puts a rule the single-pending index still blocks behind one that can be written', () => {
    // Until the activation, a rule that already holds an unresolved occurrence
    // cannot take another. Spending the budget on it would leave a rule that
    // COULD have been materialized with nothing — and it would repeat every run,
    // `created: 0` and `remaining > 0` forever.
    const batch = selectReconstructionBatch(
      new Map([
        ['blocked', { owed: ['2026-02-01'], newestExisting: '2026-01-01', hasPending: true }],
        ['writable', unserved(['2026-07-01'])],
      ]),
      1,
    )

    expect([...batch.keys()]).toEqual(['writable'])
  })
})

describe('reconstructionHorizon', () => {
  it('is twelve months back, inclusive', () => {
    expect(reconstructionHorizon('2026-09-08')).toBe('2025-09-08')
  })

  it('clamps on a leap day instead of landing a day late', () => {
    // From 29-Feb, "same day twelve months back" does not exist. Built by hand it
    // rolled forward to 2027-03-01, which drops 2027-02-28 out of a window the
    // contract says is inclusive.
    expect(reconstructionHorizon('2028-02-29')).toBe('2027-02-28')
  })
})
