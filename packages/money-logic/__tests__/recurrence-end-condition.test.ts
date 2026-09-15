import { describe, expect, it } from 'vitest'
import {
  endAnswerForRule,
  endConditionColumns,
  endDraftForRule,
  hasBothEndConditions,
  parseOccurrenceCount,
  sanitizeOccurrenceCount,
  validateEndCondition,
  type RecurrenceEndDraft,
} from '../src'

/**
 * «¿Cómo termina?» — the payload comes from the ANSWER, never from the fields.
 *
 * The bug this replaces (#142) was a payload assembled field by field: the date
 * respected the switch, the count did not, so a number typed and then abandoned
 * was saved anyway and the rule stopped reminding after one instalment.
 */

const draft = (over: Partial<RecurrenceEndDraft> = {}): RecurrenceEndDraft => ({
  answer: 'never',
  endDate: '',
  maxOccurrences: '',
  ...over,
})

describe('what a draft becomes', () => {
  it('«sin límite» sends neither, whatever is written in the other fields', () => {
    // The exact sequence that produced the broken rule: type 11, then choose
    // "sin límite".
    expect(
      endConditionColumns(draft({ answer: 'never', endDate: '2027-01-31', maxOccurrences: '11' })),
    ).toEqual({ end_date: null, max_occurrences: null })
  })

  it('«en una fecha» sends the date and never the count', () => {
    expect(
      endConditionColumns(
        draft({ answer: 'on-date', endDate: '2027-01-31', maxOccurrences: '11' }),
      ),
    ).toEqual({ end_date: '2027-01-31', max_occurrences: null })
  })

  it('«después de N» sends the count and never the date', () => {
    expect(
      endConditionColumns(
        draft({ answer: 'after-count', endDate: '2027-01-31', maxOccurrences: '11' }),
      ),
    ).toEqual({ end_date: null, max_occurrences: 11 })
  })

  it('cannot be made to send both, by any draft', () => {
    const everyAnswer = ['never', 'on-date', 'after-count'] as const

    for (const answer of everyAnswer) {
      const columns = endConditionColumns(
        draft({ answer, endDate: '2027-01-31', maxOccurrences: '11' }),
      )
      // This is the property the whole module exists for, so it is asserted as a
      // property and not only case by case.
      expect(columns.end_date != null && columns.max_occurrences != null).toBe(false)
    }
  })
})

describe('the count field', () => {
  it('keeps digits and drops everything else', () => {
    // A text field, not `type="number"`: the wheel and the arrow keys change
    // that one silently, the same reason money amounts never use it.
    expect(sanitizeOccurrenceCount('1a1')).toBe('11')
    expect(sanitizeOccurrenceCount('-3')).toBe('3')
    expect(sanitizeOccurrenceCount('2.5')).toBe('25')
    expect(sanitizeOccurrenceCount('')).toBe('')
  })

  it('reads as a whole number of at least one, or as nothing', () => {
    expect(parseOccurrenceCount('11')).toBe(11)
    expect(parseOccurrenceCount('0')).toBeNull()
    expect(parseOccurrenceCount('')).toBeNull()
    expect(parseOccurrenceCount('abc')).toBeNull()
  })
})

describe('opening the form on a rule that already exists', () => {
  it('preselects the answer the rule stored', () => {
    expect(endAnswerForRule({ end_date: null, max_occurrences: null })).toBe('never')
    expect(endAnswerForRule({ end_date: '2027-01-31', max_occurrences: null })).toBe('on-date')
    expect(endAnswerForRule({ end_date: null, max_occurrences: 11 })).toBe('after-count')
  })

  it('carries both values into the draft, so switching answers loses nothing', () => {
    expect(endDraftForRule({ end_date: '2027-01-31', max_occurrences: 11 })).toEqual({
      answer: 'after-count',
      endDate: '2027-01-31',
      maxOccurrences: '11',
    })
  })

  it('recognises a rule that carries both conditions', () => {
    // No such rule was found in production, and that is not the point: the model
    // permits it and the native form could produce it, so editing one has to say
    // so rather than drop half of it.
    expect(hasBothEndConditions({ end_date: '2027-01-31', max_occurrences: 11 })).toBe(true)
    expect(hasBothEndConditions({ end_date: '2027-01-31', max_occurrences: null })).toBe(false)
    expect(hasBothEndConditions({ end_date: null, max_occurrences: 11 })).toBe(false)
  })
})

describe('what a draft is refused for', () => {
  const context = { startDate: '2026-09-10' }

  it('accepts «sin límite» always', () => {
    expect(validateEndCondition(draft(), context)).toBeNull()
  })

  it('refuses a chosen answer with nothing filled in', () => {
    expect(validateEndCondition(draft({ answer: 'on-date' }), context)).toEqual({
      kind: 'date-missing',
    })
    expect(validateEndCondition(draft({ answer: 'after-count' }), context)).toEqual({
      kind: 'count-missing',
    })
    expect(
      validateEndCondition(draft({ answer: 'after-count', maxOccurrences: '0' }), context),
    ).toEqual({ kind: 'count-missing' })
  })

  it('refuses an end date before the rule starts', () => {
    expect(
      validateEndCondition(draft({ answer: 'on-date', endDate: '2026-09-01' }), context),
    ).toEqual({ kind: 'date-before-start' })
  })

  it('refuses a limit below the positions already spent, and says how many', () => {
    expect(
      validateEndCondition(draft({ answer: 'after-count', maxOccurrences: '3' }), {
        ...context,
        positionsSpent: 5,
      }),
    ).toEqual({ kind: 'count-below-spent', spent: 5 })
  })

  it('accepts a limit that EQUALS what was spent — that is how a plan is closed', () => {
    expect(
      validateEndCondition(draft({ answer: 'after-count', maxOccurrences: '5' }), {
        ...context,
        positionsSpent: 5,
      }),
    ).toBeNull()
  })

  it('accepts a limit above what was spent', () => {
    expect(
      validateEndCondition(draft({ answer: 'after-count', maxOccurrences: '11' }), {
        ...context,
        positionsSpent: 5,
      }),
    ).toBeNull()
  })
})
