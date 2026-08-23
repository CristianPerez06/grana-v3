import { describe, expect, it } from 'vitest'
import { reserveAvailability, releaseAvailability } from '@grana/savings'
import { arsRow, fakeSupabase } from './support/fake-supabase'

/**
 * The cap and the floor of the savings write path.
 *
 * This is the deliberate difference with the ledger: a negative BALANCE is a
 * valid fact Grana renders as-is, but saving more than you have is not an
 * awkward state — it is an invalid input. And the reserved stock can never go
 * negative, which would claim the user may spend money they do not have.
 *
 * Both limits are read from the server INSIDE the mutation, never taken from the
 * client: the drawer already displays the number, but displaying it is not
 * validating it. An expense can land between the drawer opening and the user
 * confirming.
 */

const UID = 'user-1'
const TODAY = new Date('2026-08-23T12:00:00Z')

const input = (amount: number, currency = 'ARS') => ({
  amount,
  currency_code: currency,
  date: TODAY,
})

describe('reserveAvailability — the cap', () => {
  it('saves what fits and persists it as a positive row', async () => {
    const { supabase, inserted } = fakeSupabase({ available: [arsRow(1_800_000, 0)] })

    const result = await reserveAvailability({
      supabase,
      userId: UID,
      input: input(200_000),
      today: TODAY,
    })

    expect(result).toEqual({ ok: true, id: 'reserve-1' })
    expect(inserted).toEqual([
      { user_id: UID, currency_code: 'ARS', amount: 200_000, date: '2026-08-23' },
    ])
  })

  it('accepts exactly the whole disponible', async () => {
    const { supabase } = fakeSupabase({ available: [arsRow(300_000, 0)] })

    const result = await reserveAvailability({
      supabase,
      userId: UID,
      input: input(300_000),
      today: TODAY,
    })

    expect(result.ok).toBe(true)
  })

  it('rejects one cent past it, and says how much there is', async () => {
    const { supabase, inserted } = fakeSupabase({ available: [arsRow(300_000, 0)] })

    const result = await reserveAvailability({
      supabase,
      userId: UID,
      input: input(300_000.01),
      today: TODAY,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'exceeds_available',
      limit: 300_000,
      messageKey: 'savings.errors.exceeds_available',
    })
    // The error carries the number so the copy can say "Tenés $300.000
    // disponibles" instead of "monto inválido".
    expect(inserted).toEqual([])
  })

  it('measures against the disponible, not the account balance', async () => {
    // $1.000.000 in accounts, $900.000 already set aside → only $100.000 free.
    const { supabase } = fakeSupabase({ available: [arsRow(1_000_000, 900_000)] })

    const result = await reserveAvailability({
      supabase,
      userId: UID,
      input: input(200_000),
      today: TODAY,
    })

    expect(result).toMatchObject({ ok: false, reason: 'exceeds_available', limit: 100_000 })
  })

  it('rejects when the disponible is negative', async () => {
    const { supabase } = fakeSupabase({ available: [arsRow(150_000, 200_000)] })

    const result = await reserveAvailability({
      supabase,
      userId: UID,
      input: input(1),
      today: TODAY,
    })

    expect(result).toMatchObject({ ok: false, reason: 'exceeds_available', limit: -50_000 })
  })

  it('treats a currency with no row as zero, not as missing data', async () => {
    const { supabase } = fakeSupabase({ available: [arsRow(1_000_000, 0)] })

    const result = await reserveAvailability({
      supabase,
      userId: UID,
      input: input(500, 'USD'),
      today: TODAY,
    })

    expect(result).toMatchObject({ ok: false, reason: 'exceeds_available', limit: 0 })
  })
})

describe('releaseAvailability — the floor', () => {
  it('persists the release as a negative row', async () => {
    const { supabase, inserted } = fakeSupabase({ available: [arsRow(1_000_000, 200_000)] })

    const result = await releaseAvailability({
      supabase,
      userId: UID,
      input: input(50_000),
      today: TODAY,
    })

    expect(result.ok).toBe(true)
    // The user typed a positive amount; the VERB chose the sign.
    expect(inserted).toEqual([
      { user_id: UID, currency_code: 'ARS', amount: -50_000, date: '2026-08-23' },
    ])
  })

  it('accepts releasing everything that was set aside', async () => {
    const { supabase } = fakeSupabase({ available: [arsRow(1_000_000, 200_000)] })

    const result = await releaseAvailability({
      supabase,
      userId: UID,
      input: input(200_000),
      today: TODAY,
    })

    expect(result.ok).toBe(true)
  })

  it('rejects releasing more than what is saved', async () => {
    const { supabase, inserted } = fakeSupabase({ available: [arsRow(1_000_000, 200_000)] })

    const result = await releaseAvailability({
      supabase,
      userId: UID,
      input: input(300_000),
      today: TODAY,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'exceeds_reserved',
      limit: 200_000,
      messageKey: 'savings.errors.exceeds_reserved',
    })
    expect(inserted).toEqual([])
  })

  it('measures against the reserved stock, not the disponible', async () => {
    // Plenty available, almost nothing saved: the floor is the saved amount.
    const { supabase } = fakeSupabase({ available: [arsRow(5_000_000, 10_000)] })

    const result = await releaseAvailability({
      supabase,
      userId: UID,
      input: input(50_000),
      today: TODAY,
    })

    expect(result).toMatchObject({ ok: false, reason: 'exceeds_reserved', limit: 10_000 })
  })

  it('does not let one currency release against another currency stock', async () => {
    const { supabase } = fakeSupabase({ available: [arsRow(1_000_000, 200_000)] })

    const result = await releaseAvailability({
      supabase,
      userId: UID,
      input: input(100, 'USD'),
      today: TODAY,
    })

    expect(result).toMatchObject({ ok: false, reason: 'exceeds_reserved', limit: 0 })
  })
})

describe('shape validation — the schema guards the form, the mutation guards the money', () => {
  it('rejects a zero amount', async () => {
    const { supabase } = fakeSupabase({ available: [arsRow(1_000_000, 0)] })
    const result = await reserveAvailability({
      supabase,
      userId: UID,
      input: input(0),
      today: TODAY,
    })
    expect(result).toMatchObject({ ok: false })
    expect('fieldErrors' in result && result.fieldErrors?.amount).toBeTruthy()
  })

  it('rejects a negative amount instead of turning it into a release', async () => {
    // Accepting it would let "save −$50.000" release money through the back
    // door, skipping the floor entirely.
    const { supabase, inserted } = fakeSupabase({ available: [arsRow(1_000_000, 0)] })
    const result = await reserveAvailability({
      supabase,
      userId: UID,
      input: input(-50_000),
      today: TODAY,
    })
    expect(result).toMatchObject({ ok: false })
    expect(inserted).toEqual([])
  })

  it('rejects a currency outside the bimoneda ledger', async () => {
    const { supabase } = fakeSupabase({ available: [arsRow(1_000_000, 0)] })
    const result = await reserveAvailability({
      supabase,
      userId: UID,
      input: input(1_000, 'EUR'),
      today: TODAY,
    })
    expect('fieldErrors' in result && result.fieldErrors?.currency_code).toBeTruthy()
  })

  it('surfaces a database error code without inventing a message', async () => {
    const { supabase } = fakeSupabase({
      available: [arsRow(1_000_000, 0)],
      insertError: { code: '23514' },
    })
    const result = await reserveAvailability({
      supabase,
      userId: UID,
      input: input(200_000),
      today: TODAY,
    })
    expect(result).toEqual({ ok: false, errorCode: '23514' })
  })
})
