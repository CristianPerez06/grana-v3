import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Static assertions over migration 0049 (temporal + per-currency settlement
 * guards). Online-only repo — see AGENTS.md; runtime behavior is validated by the
 * DO $$ self-check on apply and two-user QA.
 */

const sql = readFileSync(
  resolve(__dirname, '../../../../../supabase/migrations/0049_shared_settlement_guard_temporal.sql'),
  'utf-8',
)

describe('migration 0049 — temporal + per-currency settlement guards', () => {
  it('wraps the migration in an explicit transaction', () => {
    expect(sql).toMatch(/^\s*begin;/im)
    expect(sql).toMatch(/commit;\s*$/i)
  })

  for (const fn of [
    'trg_fn_block_shared_delete_with_settlement',
    'trg_fn_block_unshare_with_settlement',
  ]) {
    describe(fn, () => {
      const body = sql.slice(
        sql.indexOf(`create or replace function public.${fn}`),
        // up to the next function or the self-check
        sql.indexOf('$trg$;', sql.indexOf(`create or replace function public.${fn}`)) + 6,
      )

      it('only guards rows that carry splits (exempts parent / settlement legs)', () => {
        expect(body).toMatch(/exists \(select 1 from public\.shared_expense_split where transaction_id = OLD\.id\)/i)
      })

      it('compares against the settlement payer movement date, per currency', () => {
        expect(body).toMatch(/join public\.transactions pm on pm\.id = s\.payer_movement_id/i)
        expect(body).toMatch(/s\.currency_code = OLD\.currency_code/i)
        expect(body).toMatch(/pm\.date >= coalesce\(OLD\.due_date, OLD\.date\)/i)
      })

      it('raises the mappable SQLSTATE GRN01', () => {
        expect(body).toMatch(/using errcode = 'GRN01'/i)
      })
    })
  }

  it('self-checks both guards are temporal/per-currency', () => {
    expect(sql).toMatch(/delete guard is not temporal\/per-currency/i)
    expect(sql).toMatch(/unshare guard is not temporal\/per-currency/i)
  })
})
