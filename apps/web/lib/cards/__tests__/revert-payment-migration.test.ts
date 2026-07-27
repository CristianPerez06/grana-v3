import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Static assertions over migration 0050 (statement-payment reversal). Online-only
 * repo — see AGENTS.md; runtime behavior is validated by the DO $$ self-check on
 * apply and by QA against real data.
 */

const sql = readFileSync(
  resolve(__dirname, '../../../../../supabase/migrations/0050_revert_card_period_payment.sql'),
  'utf-8',
)

const rpcBody = sql.slice(
  sql.indexOf('create or replace function public.revert_card_period_payment'),
  sql.indexOf('$revert$;') + 9,
)

describe('migration 0050 — revert card period payment', () => {
  it('wraps the migration in an explicit transaction', () => {
    expect(sql).toMatch(/^\s*begin;/im)
    expect(sql).toMatch(/commit;\s*$/i)
  })

  describe('stamp-tax link', () => {
    it('adds the link with ON DELETE SET NULL so deleting the sello is never blocked', () => {
      expect(sql).toMatch(
        /add column if not exists stamp_tax_transaction_id uuid\s+references public\.transactions\(id\) on delete set null/i,
      )
    })

    it('marks every pre-existing payment as predating the link', () => {
      expect(sql).toMatch(/add column if not exists stamp_tax_link_known boolean not null default true/i)
      expect(sql).toMatch(/UPDATE public\.period_payments SET stamp_tax_link_known = false/i)
    })

    it('does not backfill the link itself', () => {
      expect(sql).not.toMatch(/UPDATE public\.period_payments SET stamp_tax_transaction_id/i)
    })
  })

  describe('revert_card_period_payment', () => {
    it('is SECURITY INVOKER, so RLS keeps applying', () => {
      expect(rpcBody).toMatch(/security invoker/i)
      expect(rpcBody).not.toMatch(/security definer/i)
    })

    it('verifies ownership explicitly instead of relying on a zero-row RLS "success"', () => {
      expect(rpcBody).toMatch(/select a\.user_id into v_owner/i)
      expect(rpcBody).toMatch(/raise exception 'not_owner'/i)
    })

    it('blocks reverting while a later statement of the same card is paid (GRN02)', () => {
      expect(rpcBody).toMatch(/cp\.account_id = v_account_id/i)
      expect(rpcBody).toMatch(/cp\.start_date > v_start_date/i)
      expect(rpcBody).toMatch(/using errcode = 'GRN02'/i)
    })

    it('carries the blocking period date in DETAIL so the app names it without parsing', () => {
      expect(rpcBody).toMatch(/detail = v_blocking::text/i)
    })

    it('deletes period_payments before the charges sweep, to release the RESTRICT FK', () => {
      const deletePayment = rpcBody.search(/delete from public\.period_payments/i)
      const sweep = rpcBody.search(/set status = 'pending'/i)
      expect(deletePayment).toBeGreaterThan(-1)
      expect(sweep).toBeGreaterThan(deletePayment)
    })

    it('sweeps only the charges this payment had marked paid', () => {
      expect(rpcBody).toMatch(/where card_period_id = p_period_id\s+and status = 'paid'/i)
    })

    it('resolves the sello by link, and only falls back to the heuristic on legacy rows', () => {
      expect(rpcBody).toMatch(/if v_stamp_tx is not null then/i)
      expect(rpcBody).toMatch(/elsif v_link_known then/i)
      expect(rpcBody).toMatch(/s\.canonical_name = 'impuesto-de-sellos'/i)
    })

    it('never deletes an ambiguous sello', () => {
      expect(rpcBody).toMatch(/array_length\(v_candidates, 1\) = 1/i)
      expect(rpcBody).toMatch(/v_stamp_status := 'ambiguous'/i)
    })

    it('does NOT touch the calendar: no period dates, is_estimated or learned rate', () => {
      expect(rpcBody).not.toMatch(/update public\.card_periods/i)
      expect(rpcBody).not.toMatch(/is_estimated/i)
      expect(rpcBody).not.toMatch(/stamp_tax_rate/i)
    })

    it('returns the summary the confirmation UI needs', () => {
      for (const key of [
        'reverted_amount',
        'payment_account_name',
        'movements_reverted',
        'stamp_tax',
      ]) {
        expect(rpcBody).toContain(`'${key}'`)
      }
    })

    it('is executable by authenticated users only', () => {
      expect(sql).toMatch(
        /revoke execute on function public\.revert_card_period_payment\(uuid\) from public/i,
      )
      expect(sql).toMatch(
        /grant\s+execute on function public\.revert_card_period_payment\(uuid\) to authenticated/i,
      )
    })
  })

  it('self-checks the invoker security and the legacy marking on apply', () => {
    expect(sql).toMatch(/SELF-CHECK FAILED: revert_card_period_payment must be SECURITY INVOKER/i)
    expect(sql).toMatch(/SELF-CHECK FAILED: % pre-existing payment\(s\) not marked as legacy/i)
  })
})
