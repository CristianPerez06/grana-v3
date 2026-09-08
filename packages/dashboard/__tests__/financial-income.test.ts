import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isFinancialIncome } from '../src/aggregations'

/**
 * Which income is a yield.
 *
 * This rule matches a seeded `canonical_name`, so it is one edit away from
 * silently matching nothing — which is exactly what happened: the first version
 * keyed on `financiero`, the EXPENSE category, and the row never appeared for
 * anyone. The last test here reads the seed migration itself, so the code and
 * the data cannot drift apart without a red test.
 */

const migration = (file: string) =>
  readFileSync(resolve(__dirname, '../../../supabase/migrations', file), 'utf-8')

describe('isFinancialIncome', () => {
  it('accepts the seeded income category', () => {
    expect(isFinancialIncome('income', 'financiero-ingresos')).toBe(true)
  })

  it("accepts a user's own category named Financiero", () => {
    // `canonical_name` is derived from the name, so someone who creates their
    // own "Financiero" for income lands on `financiero` and means the same.
    expect(isFinancialIncome('income', 'financiero')).toBe(true)
  })

  it('rejects everything that is not income, whatever its category', () => {
    // The expense "Financiero" — bank fees, a loan instalment — is not a yield.
    expect(isFinancialIncome('expense', 'financiero')).toBe(false)
    expect(isFinancialIncome('reimbursement', 'financiero-ingresos')).toBe(false)
    expect(isFinancialIncome('transfer', 'financiero')).toBe(false)
  })

  it('rejects income filed under any other category, and uncategorized income', () => {
    expect(isFinancialIncome('income', 'sueldo')).toBe(false)
    expect(isFinancialIncome('income', null)).toBe(false)
    expect(isFinancialIncome('income', '')).toBe(false)
  })

  it('matches the canonical the seed actually creates for income', () => {
    // 0036 seeds the income category; whatever canonical it declares there has
    // to be one this predicate accepts.
    const sql = migration('0036_seed_income_financiero.sql')
    const seeded = sql.match(/\('Financiero',\s*'([a-z-]+)'/)?.[1]
    expect(seeded).toBeDefined()
    expect(isFinancialIncome('income', seeded!)).toBe(true)
  })

  it('does not accept the expense category as income by mistake', () => {
    // 0006 seeds the expense one. It is in the set (a user's own category can
    // land there) but only ever for a row whose type is income.
    const sql = migration('0006_seed_categories.sql')
    const seeded = sql.match(/\('Financiero',\s*'([a-z-]+)'/)?.[1]
    expect(seeded).toBe('financiero')
    expect(isFinancialIncome('expense', seeded!)).toBe(false)
  })
})
