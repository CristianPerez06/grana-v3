import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { registerInstallments } from '../src/register-installments'

/**
 * Smoke tests for the fail-fast paths (validation + account verification).
 *
 * The orchestrator's value-add is the rollback dance across parent/children/
 * shared-splits inserts. That coverage is provided by the existing web action
 * tests + the manual verify pass at task 9.3, both of which exercise the
 * orchestrator transitively through the registered server action. Reproducing
 * those paths here would require a much larger mock-supabase harness than is
 * proportionate for this package.
 */

const baseInput = {
  account_id: '11111111-1111-4111-8111-111111111111',
  amount: 12000,
  currency_code: 'ARS',
  date: '2026-06-01',
  installments_total: 3,
  category_id: '22222222-2222-4222-8222-222222222222',
  description: 'Compra de prueba',
}

const noopClient = {} as unknown as GranaSupabaseClient

describe('registerInstallments — orchestrator smoke tests', () => {
  it('returns fieldErrors when input is missing required fields', async () => {
    const result = await registerInstallments({
      supabase: noopClient,
      userId: 'user-1',
      input: { amount: 0 },
      today: new Date('2026-06-01T00:00:00Z'),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.fieldErrors).toBeDefined()
    }
  })

  it('returns formError when the account is not found', async () => {
    const client = {
      from(table: string) {
        if (table !== 'accounts') throw new Error(`unexpected table ${table}`)
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { message: 'not found' } }),
              }),
            }),
          }),
        }
      },
    } as unknown as GranaSupabaseClient

    const result = await registerInstallments({
      supabase: client,
      userId: 'user-1',
      input: baseInput,
      today: new Date('2026-06-01T00:00:00Z'),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.formError).toBe('Tarjeta no encontrada.')
  })

  it('returns formError when the account exists but is not a credit card', async () => {
    const client = {
      from(table: string) {
        if (table !== 'accounts') throw new Error(`unexpected table ${table}`)
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: { type: 'bank', is_active: true },
                  error: null,
                }),
              }),
            }),
          }),
        }
      },
    } as unknown as GranaSupabaseClient

    const result = await registerInstallments({
      supabase: client,
      userId: 'user-1',
      input: baseInput,
      today: new Date('2026-06-01T00:00:00Z'),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.formError).toBe('Las cuotas solo aplican a tarjetas de crédito.')
  })
})
