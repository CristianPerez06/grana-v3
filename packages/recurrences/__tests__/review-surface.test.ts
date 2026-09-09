import { describe, expect, it } from 'vitest'
import {
  materializationOutcome,
  resolutionPreview,
  reviewFeedState,
  reviewUrgency,
  shouldOpenReviewBlock,
} from '../src/review-surface'

const TODAY = '2026-09-08'

const instance = (over: Record<string, unknown> = {}) =>
  ({
    due_date: '2026-08-23',
    scheduled_date: '2026-09-15',
    account: { id: 'a', name: 'Banco Nación', type: 'bank' },
    destination_account: null,
    recurrence: { movement_type: 'expense' },
    ...over,
  }) as never

describe('shouldOpenReviewBlock', () => {
  it('opens with a single overdue occurrence', () => {
    expect(shouldOpenReviewBlock([{ due_date: '2026-08-23' }], TODAY)).toBe(true)
  })

  it('OPENS with several — the more there is to review, the more visible', () => {
    // The old rule collapsed from two onwards, so a user with a backlog got the
    // block hidden. That was one of the three reported symptoms.
    const three = [{ due_date: '2026-06-23' }, { due_date: '2026-07-23' }, { due_date: '2026-08-23' }]
    expect(shouldOpenReviewBlock(three, TODAY)).toBe(true)
  })

  it('opens when today IS the vencimiento', () => {
    expect(shouldOpenReviewBlock([{ due_date: TODAY }], TODAY)).toBe(true)
  })

  it('stays collapsed when nothing has fallen due yet', () => {
    expect(shouldOpenReviewBlock([{ due_date: '2026-10-23' }], TODAY)).toBe(false)
  })

  it('is closed for an empty list', () => {
    expect(shouldOpenReviewBlock([], TODAY)).toBe(false)
  })
})

describe('reviewUrgency', () => {
  it('counts the days something has been overdue', () => {
    expect(reviewUrgency('2026-09-01', TODAY)).toEqual({ kind: 'overdue', days: 7 })
  })

  it('names today', () => {
    expect(reviewUrgency(TODAY, TODAY)).toEqual({ kind: 'due_today' })
  })

  it('counts the days until it falls due', () => {
    expect(reviewUrgency('2026-09-10', TODAY)).toEqual({ kind: 'due_in', days: 2 })
  })
})

describe('resolutionPreview', () => {
  it('dates the movement by the VENCIMIENTO, not by a legacy date', () => {
    // `scheduled_date` on this fixture is 2026-09-15 — the shape a resolved row
    // takes when an old client overwrites it. Reading it as the vencimiento is
    // what let an August cuota be shown as September's.
    expect(resolutionPreview(instance())).toEqual({
      kind: 'expense',
      date: '2026-08-23',
      account: 'Banco Nación',
      destination: null,
    })
  })

  it('names an income as an income', () => {
    expect(resolutionPreview(instance({ recurrence: { movement_type: 'income' } })).kind).toBe(
      'income',
    )
  })

  it('carries both ends of a transfer', () => {
    const preview = resolutionPreview(
      instance({
        recurrence: { movement_type: 'transfer' },
        destination_account: { id: 'b', name: 'Caja', type: 'cash' },
      }),
    )
    expect(preview.kind).toBe('transfer')
    expect(preview.destination).toBe('Caja')
  })

  it('survives an archived account without an embed', () => {
    expect(resolutionPreview(instance({ account: null })).account).toBeNull()
  })
})

describe('materializationOutcome', () => {
  it('reports a failure, whatever else the run said', () => {
    expect(materializationOutcome({ remaining: 0, error: 'boom' })).toEqual({ kind: 'failed' })
    expect(materializationOutcome({ remaining: 12, error: 'boom' })).toEqual({ kind: 'failed' })
  })

  it('reports what is left to rebuild', () => {
    expect(materializationOutcome({ remaining: 12, error: null })).toEqual({
      kind: 'remaining',
      count: 12,
    })
  })

  it('says nothing only when there is nothing to say', () => {
    expect(materializationOutcome({ remaining: 0, error: null })).toEqual({ kind: 'quiet' })
  })
})

describe('reviewFeedState', () => {
  it('distinguishes a FAILED read from an empty one', () => {
    // The defect: `data ?? []` turned a failed read into an empty list, and the
    // block vanished — telling the user they have nothing to review when the
    // truth is that nobody knows.
    expect(reviewFeedState({ isPending: false, error: new Error('x'), data: undefined })).toEqual({
      kind: 'unreadable',
    })
    expect(reviewFeedState({ isPending: false, error: null, data: [] })).toEqual({ kind: 'empty' })
  })

  it('reports a failure even when stale data is still cached', () => {
    expect(reviewFeedState({ isPending: false, error: new Error('x'), data: [{}] })).toEqual({
      kind: 'unreadable',
    })
  })

  it('is loading until the first answer arrives', () => {
    expect(reviewFeedState({ isPending: true, error: null, data: undefined })).toEqual({
      kind: 'loading',
    })
  })

  it('has a list when there is something in it', () => {
    expect(reviewFeedState({ isPending: false, error: null, data: [{}] })).toEqual({ kind: 'list' })
  })
})
