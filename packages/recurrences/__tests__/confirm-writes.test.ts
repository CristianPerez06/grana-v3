import { describe, expect, it, vi } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'

const TX = '55555555-5555-4555-8555-555555555555'

// The real creators live in @grana/transactions-mutations; here they only need
// to hand back an id so the confirmation can run to completion.
vi.mock('@grana/transactions-mutations', () => ({
  createExpense: async () => ({ ok: true, id: TX }),
  createIncome: async () => ({ ok: true, id: TX }),
  createTransfer: async () => ({ ok: true, id: TX }),
  registerCardPurchase: async () => ({ ok: true, id: TX }),
  deleteTransaction: async () => ({ ok: true }),
}))

const { confirmRecurrenceInstance } = await import('../src/mutations')

/**
 * What `confirmRecurrenceInstance` writes, and above all what it does not.
 *
 * Two rules of the fix-recurrence-backlog change that the code used to break:
 *
 *   1.4  Confirming does NOT overwrite `scheduled_date`. It used to, with the
 *        date the user picked, and the occurrence lost its due date. The
 *        payment date lives on the movement; the due date in `due_date`.
 *
 *   1.4c A corrected amount applies to that occurrence only and does not
 *        rewrite the rule's. While a rule could only have one pending
 *        occurrence, propagating it passed for convenient; with bulk
 *        resolution, three different amounts would leave the rule holding
 *        whichever was written last — a result that depends on ORDER.
 */

const USER = '00000000-0000-4000-8000-000000000000'
const INSTANCE = '11111111-1111-4111-8111-111111111111'
const RULE = '22222222-2222-4222-8222-222222222222'
const ACCOUNT = '33333333-3333-4333-8333-333333333333'
const RULE_AMOUNT = 450000

type Recorder = { instanceWrites: Record<string, unknown>[] }

/**
 * A stateful fake: the rule row PERSISTS across calls, so `amount` really would
 * drift if the mutation propagated it. A fresh row per call would make the
 * order-independence test vacuous — it would only re-assert that one update
 * omits the field.
 */
function stubClient(rec: Recorder) {
  const rule = { id: RULE, movement_type: 'expense', amount: RULE_AMOUNT, status: 'active' }
  const instance = {
    id: INSTANCE,
    recurrence_id: RULE,
    status: 'pending',
    scheduled_date: '2026-06-23', // the DUE DATE
    amount: RULE_AMOUNT,
    account_id: ACCOUNT,
    transfer_destination_account_id: null,
    currency_code: 'ARS',
    category_id: '44444444-4444-4444-8444-444444444444',
    subcategory_id: null,
    description: 'Rent',
    household_id: null,
    split: null,
  }

  const client = {
    from(table: string) {
      if (table === 'recurrence_instances') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ single: async () => ({ data: instance, error: null }) }) }),
          }),
          update: (payload: Record<string, unknown>) => {
            rec.instanceWrites.push(payload)
            return {
              eq: () => ({
                eq: () => ({
                  eq: () => ({ select: async () => ({ data: [{ id: INSTANCE }], error: null }) }),
                }),
              }),
            }
          },
        }
      }
      if (table === 'recurrences') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ single: async () => ({ data: rule, error: null }) }) }),
          }),
          // Applies the write to the persisted row, so a propagated amount would
          // actually stick and the assertions below could see it.
          update: (payload: Record<string, unknown>) => {
            Object.assign(rule, payload)
            return { eq: async () => ({ error: null }) }
          },
        }
      }
      if (table === 'accounts') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: { type: 'bank', is_active: true }, error: null }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }

  return { client: client as unknown as GranaSupabaseClient, rule }
}

describe('confirmRecurrenceInstance — what it writes and what it must not', () => {
  it('1.4 · leaves scheduled_date alone even when the user pays on another date', async () => {
    const rec: Recorder = { instanceWrites: [] }
    const { client } = stubClient(rec)

    const result = await confirmRecurrenceInstance(client, USER, INSTANCE, {
      date: '2026-09-03', // paid on the 3rd what was due on 23 Jun
    })

    expect(result.ok).toBe(true)
    expect(rec.instanceWrites).toHaveLength(1)
    expect(rec.instanceWrites[0]).not.toHaveProperty('scheduled_date')
    expect(rec.instanceWrites[0]).toMatchObject({
      status: 'confirmed',
      confirmed_transaction_id: TX,
    })
  })

  it("1.4c · a corrected amount does not rewrite the rule's", async () => {
    const rec: Recorder = { instanceWrites: [] }
    const { client, rule } = stubClient(rec)

    const result = await confirmRecurrenceInstance(client, USER, INSTANCE, {
      amount: 520000, // the rent went up
    })

    expect(result.ok).toBe(true)
    // The occurrence records what was actually paid…
    expect(rec.instanceWrites[0]).toMatchObject({ amount: 520000 })
    // …and the rule keeps its own.
    expect(rule.amount).toBe(RULE_AMOUNT)
  })

  it('1.4c · the rule ends up identical whichever order the amounts are resolved in', async () => {
    // The rule row persists across the three calls of each run, so a propagated
    // amount would survive and the two runs would disagree.
    const finals = [
      [520000, 480000, 610000],
      [610000, 480000, 520000],
    ].map((amounts) => {
      const rec: Recorder = { instanceWrites: [] }
      const { client, rule } = stubClient(rec)
      return amounts
        .reduce(
          (chain, amount) =>
            chain.then(() => confirmRecurrenceInstance(client, USER, INSTANCE, { amount })),
          Promise.resolve() as Promise<unknown>,
        )
        .then(() => rule.amount)
    })

    const [first, second] = await Promise.all(finals)
    expect(first).toBe(RULE_AMOUNT)
    expect(second).toBe(RULE_AMOUNT)
    expect(first).toBe(second)
  })
})
