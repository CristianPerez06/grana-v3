import { describe, expect, it } from 'vitest'
import {
  closeAmounts,
  duplicateRuleIds,
  findDuplicateRules,
  groupDuplicateRules,
  type ExistingRuleForDuplicateCheck,
} from '@grana/recurrences'

/**
 * Duplicate detection keys on (account, currency, movement_type) plus an amount
 * that is equal or within 1 %, and deliberately ignores category and
 * description: in the real duplicates found in production those fields DIFFERED
 * (one rule filed under `impuestos`, its twin under `impuestos / IIBB`; a loan
 * loaded twice as 48.733,92 and 48.723,04), so requiring them to match would
 * miss the cases that matter. The cost is legitimate false positives, which is
 * exactly why the warning never blocks.
 */

const MP = 'account-mp'
const VISA = 'account-visa'

const rule = (
  over: Partial<ExistingRuleForDuplicateCheck> & Pick<ExistingRuleForDuplicateCheck, 'id'>,
): ExistingRuleForDuplicateCheck => ({
  status: 'active',
  description: null,
  account_id: MP,
  currency_code: 'ARS',
  movement_type: 'expense',
  amount: 450000,
  ...over,
})

describe('findDuplicateRules', () => {
  it('flags a rule with the same account, currency, type and amount', () => {
    const matches = findDuplicateRules(
      { account_id: MP, currency_code: 'ARS', movement_type: 'expense', amount: 450000 },
      [rule({ id: 'existing', description: 'ALQUILER' })],
    )
    expect(matches).toEqual([
      { id: 'existing', description: 'ALQUILER', next_occurrence: null },
    ])
  })

  it('flags across differing category/description — the real duplicate shape', () => {
    // The production pair: same money, one titled and one not.
    const matches = findDuplicateRules(
      { account_id: MP, currency_code: 'ARS', movement_type: 'expense', amount: 36700 },
      [
        rule({ id: 'old', amount: 36700, description: 'IIBB' }),
        rule({ id: 'new', amount: 36700, description: null }),
      ],
    )
    expect(matches.map((m) => m.id)).toEqual(['old', 'new'])
  })

  it('treats numeric strings from Postgres as equal to form numbers', () => {
    const matches = findDuplicateRules(
      { account_id: MP, currency_code: 'ARS', movement_type: 'expense', amount: 450000 },
      [rule({ id: 'existing', amount: '450000.00' })],
    )
    expect(matches).toHaveLength(1)
  })

  it('flags a legitimate pair too — which is why the warning must not block', () => {
    // "chat gpt" and "claude": both USD 20 on the same card, not duplicates.
    const matches = findDuplicateRules(
      { account_id: VISA, currency_code: 'USD', movement_type: 'expense', amount: 20 },
      [rule({ id: 'chatgpt', account_id: VISA, currency_code: 'USD', amount: 20, description: 'chat gpt' })],
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].description).toBe('chat gpt')
  })

  it('flags an amount within 1 % — the loan loaded twice with a recalculated cuota', () => {
    // The audit pair: same loan, 10,88 pesos apart, one titled and one not.
    const matches = findDuplicateRules(
      { account_id: MP, currency_code: 'ARS', movement_type: 'expense', amount: 48723.04 },
      [rule({ id: 'named', amount: '48733.92', description: 'Prestamo Anses' })],
    )
    expect(matches.map((m) => m.id)).toEqual(['named'])
  })

  it('does not flag a different amount, account, currency or type', () => {
    const candidate = {
      account_id: MP,
      currency_code: 'ARS',
      movement_type: 'expense',
      amount: 450000,
    }
    // 2,2 % apart: outside the tolerance.
    expect(
      findDuplicateRules(candidate, [rule({ id: 'a', amount: 460000 })]),
    ).toEqual([])
    expect(
      findDuplicateRules(candidate, [rule({ id: 'b', account_id: VISA })]),
    ).toEqual([])
    expect(
      findDuplicateRules(candidate, [rule({ id: 'c', currency_code: 'USD' })]),
    ).toEqual([])
    expect(
      findDuplicateRules(candidate, [rule({ id: 'd', movement_type: 'income' })]),
    ).toEqual([])
  })

  it('ignores paused/deleted rules and the rule being edited', () => {
    const candidate = {
      account_id: MP,
      currency_code: 'ARS',
      movement_type: 'expense',
      amount: 450000,
    }
    expect(findDuplicateRules(candidate, [rule({ id: 'p', status: 'paused' })])).toEqual([])
    expect(findDuplicateRules(candidate, [rule({ id: 'd', status: 'deleted' })])).toEqual([])
    expect(
      findDuplicateRules(candidate, [rule({ id: 'self' })], { excludeId: 'self' }),
    ).toEqual([])
  })
})

describe('closeAmounts', () => {
  it('is inclusive at exactly 1 % of the larger amount', () => {
    expect(closeAmounts(100000, 99000)).toBe(true)
    expect(closeAmounts(100000, 98999.99)).toBe(false)
  })

  it('treats cents-equal values as close regardless of representation', () => {
    expect(closeAmounts('450000.00', 450000)).toBe(true)
  })

  it('rejects non-numeric input instead of throwing', () => {
    expect(closeAmounts('abc', 1)).toBe(false)
  })
})

describe('groupDuplicateRules / duplicateRuleIds', () => {
  it('groups near amounts inside the same account/currency/type', () => {
    const groups = groupDuplicateRules([
      rule({ id: 'anses-named', amount: '48733.92', description: 'Prestamo Anses' }),
      rule({ id: 'anses-untitled', amount: '48723.04' }),
      rule({ id: 'far', amount: 60000 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].map((r) => r.id).sort()).toEqual(['anses-named', 'anses-untitled'])
  })

  it('does not chain two rules that are each 1 % apart into a third beyond the tolerance', () => {
    // 100.000 ↔ 99.100 ↔ 98.200: the outer pair is 1,8 % apart, but the chain
    // links consecutive neighbours, so all three land in one group. That is the
    // documented behaviour (a ladder of near amounts is still worth a look), and
    // a fourth rule clearly apart stays out.
    const groups = groupDuplicateRules([
      rule({ id: 'a', amount: 100000 }),
      rule({ id: 'b', amount: 99100 }),
      rule({ id: 'c', amount: 98200 }),
      rule({ id: 'd', amount: 90000 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].map((r) => r.id).sort()).toEqual(['a', 'b', 'c'])
  })


  it('groups only collisions of two or more', () => {
    const groups = groupDuplicateRules([
      rule({ id: 'alq-1', description: 'ALQUILER' }),
      rule({ id: 'alq-2', description: 'ALQUILER' }),
      rule({ id: 'lonely', amount: 95000 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].map((r) => r.id)).toEqual(['alq-1', 'alq-2'])
  })

  it('returns every id participating in a collision', () => {
    const ids = duplicateRuleIds([
      rule({ id: 'a' }),
      rule({ id: 'b' }),
      rule({ id: 'c', amount: 95000 }),
      rule({ id: 'd', amount: 95000 }),
      rule({ id: 'e', amount: 1 }),
    ])
    expect([...ids].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('does not group rules across different accounts', () => {
    expect(
      groupDuplicateRules([rule({ id: 'a' }), rule({ id: 'b', account_id: VISA })]),
    ).toEqual([])
  })
})
