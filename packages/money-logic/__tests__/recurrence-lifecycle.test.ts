import { describe, expect, it } from 'vitest'
import {
  deriveRecurrenceLifecycle,
  hasFutureOccurrenceIgnoringPauses,
  lastExpectedOccurrence,
  occurrencePositionsSpent,
  type OccurrenceSchedule,
  type RecurrenceLifecycleInput,
} from '../src'

/**
 * The end of a rule is DERIVED, and the question that decides it is whether the
 * calendar still produces something — not whether the cap ran out.
 *
 * `recurrences.status` is never written by any of this: it keeps saying what the
 * user did to the rule (active / paused / deleted) while the screens show what
 * the calendar says.
 */

const base: RecurrenceLifecycleInput = {
  status: 'active',
  hasFutureOccurrence: true,
  endDate: null,
  maxOccurrences: null,
  positionsSpent: 0,
  unresolvedCount: 0,
  hasUnresolvedAhead: false,
}

describe('the state a recurrence is shown in', () => {
  const cases: Array<{
    name: string
    input: Partial<RecurrenceLifecycleInput>
    state: string
    progress: { spent: number; total: number; remaining: number } | null
  }> = [
    {
      name: 'without a limit it is simply active',
      input: {},
      state: 'active',
      progress: null,
    },
    {
      name: 'with a limit and positions ahead it stays active and reports them',
      input: { maxOccurrences: 11, positionsSpent: 1 },
      state: 'active',
      progress: { spent: 1, total: 11, remaining: 10 },
    },
    {
      name: 'with the limit spent it is finished',
      input: { maxOccurrences: 1, positionsSpent: 1, hasFutureOccurrence: false },
      state: 'finished',
      progress: { spent: 1, total: 1, remaining: 0 },
    },
    {
      // The reason the deciding question is the calendar and not the cap: this
      // rule has no cap to run out of, and it ended anyway.
      name: 'finished by end_date, with no limit at all',
      input: { endDate: '2026-01-31', hasFutureOccurrence: false },
      state: 'finished',
      progress: null,
    },
    {
      name: 'finished by end_date with something still unresolved',
      input: { endDate: '2026-01-31', hasFutureOccurrence: false, unresolvedCount: 1 },
      state: 'finished-with-pending',
      progress: null,
    },
    {
      name: 'exhausted with something still unresolved',
      input: {
        maxOccurrences: 3,
        positionsSpent: 3,
        hasFutureOccurrence: false,
        unresolvedCount: 1,
      },
      state: 'finished-with-pending',
      progress: { spent: 3, total: 3, remaining: 0 },
    },
    {
      // A pause is an interruption, not an end.
      name: 'paused with calendar ahead is NOT finished',
      input: { status: 'paused', maxOccurrences: 11, positionsSpent: 4 },
      state: 'paused',
      progress: { spent: 4, total: 11, remaining: 7 },
    },
    {
      name: 'paused with nothing left IS finished',
      input: { status: 'paused', maxOccurrences: 4, positionsSpent: 4, hasFutureOccurrence: false },
      state: 'finished',
      progress: { spent: 4, total: 4, remaining: 0 },
    },
  ]

  for (const { name, input, state, progress } of cases) {
    it(name, () => {
      const result = deriveRecurrenceLifecycle({ ...base, ...input })
      expect(result.state).toBe(state)
      expect(result.progress).toEqual(progress)
    })
  }

  it('una regla con un vencimiento futuro sin resolver NO está finalizada', () => {
    // El caso del QA: plan de tres, las tres posiciones ya materializadas —dos
    // resueltas por anticipado y la del medio sin resolver, en noviembre—. El
    // calendario no va a producir nada nuevo, pero a esa regla le queda un
    // vencimiento por delante: llamarla «Finalizada» es decir que no va a pasar
    // nada más cuando en noviembre vuelve a vencer.
    const result = deriveRecurrenceLifecycle({
      ...base,
      maxOccurrences: 3,
      positionsSpent: 2,
      hasFutureOccurrence: false,
      unresolvedCount: 1,
      hasUnresolvedAhead: true,
    })

    expect(result.state).toBe('active')
  })

  it('sigue finalizada cuando lo que queda sin resolver ya venció', () => {
    // La distinción: un pendiente ATRASADO no le devuelve futuro a la regla.
    // Sigue terminada, con trabajo pendiente — que es lo que dice ese estado.
    const result = deriveRecurrenceLifecycle({
      ...base,
      maxOccurrences: 3,
      positionsSpent: 3,
      hasFutureOccurrence: false,
      unresolvedCount: 1,
      hasUnresolvedAhead: false,
    })

    expect(result.state).toBe('finished-with-pending')
  })

  it('saturates a limit edited below what was already spent', () => {
    // Nothing should ever read "12 de 11", and nothing should owe -1.
    const result = deriveRecurrenceLifecycle({
      ...base,
      maxOccurrences: 11,
      positionsSpent: 12,
      hasFutureOccurrence: false,
    })

    expect(result.progress).toEqual({ spent: 11, total: 11, remaining: 0 })
  })
})

describe('a deleted rule', () => {
  it('is not derived to finished, however empty its calendar', () => {
    const result = deriveRecurrenceLifecycle({
      ...base,
      status: 'deleted',
      maxOccurrences: 1,
      positionsSpent: 1,
      hasFutureOccurrence: false,
    })

    // It was taken out of the live lists on purpose; calling it "finalizada"
    // would hand it back to one of them.
    expect(result.state).toBe('deleted')
    expect(result.state).not.toBe('finished')
  })

  it('is not derived to active either, however full its calendar', () => {
    const result = deriveRecurrenceLifecycle({ ...base, status: 'deleted' })

    expect(result.state).toBe('deleted')
  })
})

// ─── The calendar's own answers ──────────────────────────────────────────────

/** The rule behind #142: monthly, anchored to the 10th, eleven instalments. */
const monthlyOnThe10th: OccurrenceSchedule = {
  start_date: '2026-09-10',
  end_date: null,
  interval_count: 1,
  interval_unit: 'month',
  max_occurrences: 11,
  schedule_effective_from: null,
  schedule_positions_before: null,
}

describe('the last expected occurrence', () => {
  it('lands on the eleventh instalment of a plan that has spent one', () => {
    const result = lastExpectedOccurrence({
      rule: monthlyOnThe10th,
      today: '2026-09-15',
      maxOccurrences: 11,
      positionsSpent: 1,
      hasOpenPause: false,
    })

    // Sep is spent; Oct … Jul 2027 are the ten that remain.
    expect(result).toEqual({ kind: 'date', date: '2027-07-10' })
  })

  it('moves with a corrected anchor instead of with the original one', () => {
    // The reference date was corrected to the 8th, ruling from October, with the
    // one position spent under the old anchor carried across.
    const corrected: OccurrenceSchedule = {
      start_date: '2026-10-08',
      end_date: null,
      interval_count: 1,
      interval_unit: 'month',
      max_occurrences: 11,
      schedule_effective_from: '2026-10-01',
      schedule_positions_before: 1,
    }

    const result = lastExpectedOccurrence({
      rule: corrected,
      today: '2026-09-15',
      maxOccurrences: 11,
      positionsSpent: 1,
      hasOpenPause: false,
    })

    // Same eleven positions — the one spent in September plus the ten that
    // remain — with the last one on the corrected day.
    expect(result).toEqual({ kind: 'date', date: '2027-07-08' })
  })

  it('no vuelve a caminar una posición que se resolvió antes de su fecha', () => {
    // El caso del QA: plan de tres, hoy 21/09, y el usuario paga por anticipado
    // el vencimiento del 10/10 —que sigue siendo futuro—. `positionsSpent` ya lo
    // cuenta, y el calendario también lo tiene por delante: contarlo de las dos
    // formas hace terminar el plan un mes antes de lo que termina.
    const result = lastExpectedOccurrence({
      rule: { ...monthlyOnThe10th, max_occurrences: 3 },
      today: '2026-09-21',
      maxOccurrences: 3,
      positionsSpent: 1,
      hasOpenPause: false,
      resolvedAhead: ['2026-10-10'],
    })

    // Oct (resuelto por anticipado), Nov y Dic. El último sigue siendo el de
    // diciembre: gastar una posición antes no acorta el plan.
    expect(result).toEqual({ kind: 'date', date: '2026-12-10' })
  })

  it('resolver fuera de orden no adelanta el final del plan', () => {
    // El segundo hallazgo del QA: plan de tres —Oct, Nov, Dic—, con octubre y
    // DICIEMBRE resueltos por anticipado y noviembre todavía pendiente. Lo único
    // que queda por venir es noviembre, pero el plan termina en diciembre.
    const result = lastExpectedOccurrence({
      rule: { ...monthlyOnThe10th, max_occurrences: 3 },
      today: '2026-09-21',
      maxOccurrences: 3,
      positionsSpent: 2,
      hasOpenPause: false,
      resolvedAhead: ['2026-10-10', '2026-12-10'],
    })

    expect(result).toEqual({ kind: 'date', date: '2026-12-10' })
  })

  it('una pendiente futura NO se saltea: su posición todavía no se gastó', () => {
    // La diferencia fina con el caso de arriba. Una ocurrencia que existe pero
    // sigue sin resolver gastará su posición cuando llegue su fecha, así que el
    // conteo normativo todavía no la suma y el caminante tiene que producirla.
    const result = lastExpectedOccurrence({
      rule: { ...monthlyOnThe10th, max_occurrences: 3 },
      today: '2026-09-21',
      maxOccurrences: 3,
      positionsSpent: 0,
      hasOpenPause: false,
      resolvedAhead: [],
    })

    expect(result).toEqual({ kind: 'date', date: '2026-12-10' })
  })

  it('refuses to name a date while a pause is open', () => {
    const result = lastExpectedOccurrence({
      rule: monthlyOnThe10th,
      today: '2026-09-15',
      maxOccurrences: 11,
      positionsSpent: 1,
      hasOpenPause: true,
    })

    // "No se puede saber todavía" is a different answer from a date, and the
    // caller has to be able to tell them apart — a UI that received a date here
    // would print an estimate as if it were certain.
    expect(result).toEqual({ kind: 'unknown-while-paused' })
    expect(result).not.toHaveProperty('date')
  })

  it('says there is nothing to project for a rule without a limit', () => {
    const result = lastExpectedOccurrence({
      rule: { ...monthlyOnThe10th, max_occurrences: null },
      today: '2026-09-15',
      maxOccurrences: null,
      positionsSpent: 4,
      hasOpenPause: false,
    })

    expect(result).toEqual({ kind: 'none' })
  })

  it('says there is nothing to project once the limit is spent', () => {
    const result = lastExpectedOccurrence({
      rule: { ...monthlyOnThe10th, max_occurrences: 1 },
      today: '2026-09-15',
      maxOccurrences: 1,
      positionsSpent: 1,
      hasOpenPause: false,
    })

    expect(result).toEqual({ kind: 'none' })
  })

  it('stops at an end_date that arrives before the limit does', () => {
    const result = lastExpectedOccurrence({
      rule: { ...monthlyOnThe10th, end_date: '2026-12-31' },
      today: '2026-09-15',
      maxOccurrences: 11,
      positionsSpent: 1,
      hasOpenPause: false,
    })

    expect(result).toEqual({ kind: 'date', date: '2026-12-10' })
  })
})

describe('whether the calendar has anything ahead', () => {
  it('answers yes for a paused rule with positions left, ignoring the pause', () => {
    // The point of the whole helper: a rule paused three months ago, with seven
    // instalments to go. Asking the composed walk — which subtracts the open
    // pause and then produces nothing — would say it finished.
    expect(
      hasFutureOccurrenceIgnoringPauses(monthlyOnThe10th, '2026-09-15', ['2026-09-10']),
    ).toBe(true)

    const spentUnderTheOpenPause = occurrencePositionsSpent({
      versions: [
        {
          effective_from: '2026-09-10',
          interval_count: 1,
          interval_unit: 'month',
          anchor_date: '2026-09-10',
        },
      ],
      pauses: [{ paused_from: '2026-09-11', resumed_at: null }],
      endDate: null,
      maxOccurrences: 11,
      today: '2026-09-15',
      seedOccurrenceDate: null,
    })

    // Still 11 positions of room; the pause is why nothing is coming out, not
    // the limit.
    expect(spentUnderTheOpenPause).toBeLessThan(11)
    expect(
      deriveRecurrenceLifecycle({
        ...base,
        status: 'paused',
        maxOccurrences: 11,
        positionsSpent: spentUnderTheOpenPause,
        hasFutureOccurrence: hasFutureOccurrenceIgnoringPauses(
          monthlyOnThe10th,
          '2026-09-15',
          ['2026-09-10'],
        ),
      }).state,
    ).toBe('paused')
  })

  it('answers no for a paused rule whose limit is spent', () => {
    const exhausted: OccurrenceSchedule = { ...monthlyOnThe10th, max_occurrences: 1 }

    expect(hasFutureOccurrenceIgnoringPauses(exhausted, '2026-09-15', ['2026-09-10'])).toBe(
      false,
    )
  })

  it('answers no for a rule past its end_date', () => {
    const ended: OccurrenceSchedule = {
      ...monthlyOnThe10th,
      max_occurrences: null,
      end_date: '2026-08-31',
    }

    expect(hasFutureOccurrenceIgnoringPauses(ended, '2026-09-15', [])).toBe(false)
  })
})

describe('the progress of a seeded rule', () => {
  it('counts positions, not instance rows', () => {
    // A rule created from a movement covers its first occurrence with that
    // movement, which has NO row in `recurrence_instances`. Three cuotas, one
    // spent — and a count of rows would say zero.
    const spent = occurrencePositionsSpent({
      versions: [
        {
          effective_from: '2026-09-10',
          interval_count: 1,
          interval_unit: 'month',
          anchor_date: '2026-09-10',
        },
      ],
      pauses: [],
      endDate: null,
      maxOccurrences: 3,
      today: '2026-09-15',
      seedOccurrenceDate: '2026-09-10',
    })

    const rowsInTheInstancesTable = 0

    expect(
      deriveRecurrenceLifecycle({ ...base, maxOccurrences: 3, positionsSpent: spent }).progress,
    ).toEqual({ spent: 1, total: 3, remaining: 2 })

    // And the negative half: handing it the row count reports a plan that has
    // not started.
    expect(
      deriveRecurrenceLifecycle({
        ...base,
        maxOccurrences: 3,
        positionsSpent: rowsInTheInstancesTable,
      }).progress,
    ).toEqual({ spent: 0, total: 3, remaining: 3 })
  })
})
