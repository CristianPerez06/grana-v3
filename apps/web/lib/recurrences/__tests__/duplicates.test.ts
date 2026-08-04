import { describe, expect, it } from 'vitest'
import {
  duplicateRuleIds,
  findDuplicateRules,
  groupDuplicateRules,
  type ExistingRuleForDuplicateCheck,
} from '@grana/recurrences'

/**
 * Duplicate detection keys on (account, currency, movement_type, amount) and
 * deliberately ignores category and description: in the real duplicates found in
 * production those fields DIFFERED (one rule filed under `impuestos`, its twin
 * under `impuestos / IIBB`), so requiring them to match would miss the cases
 * that matter. The cost is legitimate false positives, which is exactly why the
 * warning never blocks.
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

  it('does not flag a different amount, account, currency or type', () => {
    const candidate = {
      account_id: MP,
      currency_code: 'ARS',
      movement_type: 'expense',
      amount: 450000,
    }
    expect(
      findDuplicateRules(candidate, [rule({ id: 'a', amount: 450001 })]),
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

describe('groupDuplicateRules / duplicateRuleIds', () => {
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
