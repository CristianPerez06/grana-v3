import { describe, expect, it } from 'vitest'
import { reserveAvailability, releaseAvailability } from '@grana/savings'
import { arsRow, fakeSupabase, purposeRow } from './support/fake-supabase'

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
      { amount: 200_000, currency_code: 'ARS', date: '2026-08-23', purpose_id: null },
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
      { amount: -50_000, currency_code: 'ARS', date: '2026-08-23', purpose_id: null },
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

/**
 * The floor stops being global in phase 2.
 *
 * The failure it prevents is the one a global check cannot see: the total covers
 * the withdrawal, so every number on screen agrees, and one purpose quietly goes
 * negative. Grana would then be claiming the user may spend money that group does
 * not have.
 */
describe('releaseAvailability — the floor is per purpose', () => {
  const EMERGENCIA = '0000000e-0001-4000-8000-000000000001'

  const withPurposes = () =>
    fakeSupabase({
      available: [arsRow(5_085_748.17, 190_000)],
      purposes: [
        purposeRow(150_000, { id: EMERGENCIA, name: 'Emergencia' }),
        purposeRow(40_000),
      ],
      ownedPurposeIds: [EMERGENCIA],
    })

  const releaseFrom = (amount: number, purposeId: string | null) => ({
    amount,
    currency_code: 'ARS',
    date: TODAY,
    purpose_id: purposeId,
  })

  it('rejects an amount the global total covers but the purpose does not', async () => {
    const { supabase, inserted } = withPurposes()

    // $60.000 against a $190.000 total passes any global check, and leaves
    // «Sin destino» at −$20.000.
    const result = await releaseAvailability({
      supabase,
      userId: UID,
      input: releaseFrom(60_000, null),
      today: TODAY,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'exceeds_reserved',
      limit: 40_000,
      messageKey: 'savings.errors.exceeds_reserved',
    })
    expect(inserted).toEqual([])
  })

  it('names the purpose in the rejection, because the screen shows a bigger total', async () => {
    const { supabase } = withPurposes()

    const result = await releaseAvailability({
      supabase,
      userId: UID,
      input: releaseFrom(200_000, EMERGENCIA),
      today: TODAY,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'exceeds_purpose_reserved',
      limit: 150_000,
      purposeName: 'Emergencia',
      messageKey: 'savings.errors.exceeds_purpose_reserved',
    })
  })

  it('accepts exactly what the purpose holds, and tags the row with it', async () => {
    const { supabase, inserted } = withPurposes()

    const result = await releaseAvailability({
      supabase,
      userId: UID,
      input: releaseFrom(150_000, EMERGENCIA),
      today: TODAY,
    })

    expect(result.ok).toBe(true)
    // The release carries the same purpose as the saves: a purpose's balance is
    // the sum of its rows, signs included — the same mechanism as the total, one
    // level down.
    expect(inserted).toEqual([
      { amount: -150_000, currency_code: 'ARS', date: '2026-08-23', purpose_id: EMERGENCIA },
    ])
  })

  it('treats «Sin destino» as a group with the same rules, not as an absence', async () => {
    const { supabase, inserted } = withPurposes()

    const result = await releaseAvailability({
      supabase,
      userId: UID,
      input: releaseFrom(40_000, null),
      today: TODAY,
    })

    expect(result.ok).toBe(true)
    expect(inserted[0].purpose_id).toBeNull()
  })

  it('refuses to tag a reserve with a purpose the user does not own', async () => {
    const { supabase, inserted } = withPurposes()
    const SOMEONE_ELSES = '0000000e-0009-4000-8000-000000000009'

    // La FK no mira dueños, así que la comprobación vive en `write_reserve` y
    // se hace contra la base: acá lo que se ejerce es que la mutación NO la
    // suplante con una validación de forma, y propague el rechazo.
    const result = await reserveAvailability({
      supabase,
      userId: UID,
      input: { ...releaseFrom(10_000, SOMEONE_ELSES) },
      today: TODAY,
    })

    expect(result).toEqual({ ok: false, errorCode: '23503' })
    expect(inserted).toEqual([])
  })

  it('does not cap SAVING by purpose — a purpose has no target until phase 4', async () => {
    const { supabase } = withPurposes()

    const result = await reserveAvailability({
      supabase,
      userId: UID,
      input: releaseFrom(3_000_000, EMERGENCIA),
      today: TODAY,
    })

    // Way past what Emergencia holds, well inside the disponible.
    expect(result.ok).toBe(true)
  })
})
