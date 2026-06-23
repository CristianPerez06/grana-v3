import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Static assertions over migration 0044 (settlement reversal as contraasiento).
 * Online-only repo → no live DB; these lock the migration's shape. The embedded
 * DO self-check validates structure on apply; reversal behaviour is QA'd with two
 * users and covered in pure form by current-account.test.ts (reversed + contra
 * cancel).
 */

const sql = readFileSync(
  resolve(__dirname, '../../../../../supabase/migrations/0044_settlement_contraasiento.sql'),
  'utf-8',
)

describe('migration 0044 — settlement contraasiento', () => {
  it('adds the reversal columns', () => {
    expect(sql).toMatch(/add column if not exists\s+reversed_at/i)
    expect(sql).toMatch(/add column if not exists\s+reverses_settlement_id\s+uuid references public\.settlement/i)
  })

  it('widens the status check to reversed + contra', () => {
    expect(sql).toMatch(
      /chk_settlement_status[\s\S]*?status in \('pending_receipt', 'completed', 'reversed', 'contra'\)/i,
    )
  })

  it('reverse_settlement is SECURITY DEFINER and no longer deletes legs', () => {
    expect(sql).toMatch(
      /create or replace function public\.reverse_settlement[\s\S]*?security definer/i,
    )
    // The function BODY must NOT delete transactions any more (it preserves +
    // counter-entries). Scope to the $reverse$…$reverse$ body so the self-check's
    // own ILIKE guard (which mentions the string) doesn't trip the assertion.
    const body = sql.match(/as \$reverse\$([\s\S]*?)\$reverse\$;/)?.[1] ?? ''
    expect(body).not.toMatch(/delete from public\.transactions/i)
    expect(body.length).toBeGreaterThan(0)
  })

  it('reverse_settlement marks the original reversed and inserts a contra row', () => {
    expect(sql).toMatch(/set status = 'reversed', reversed_at = now\(\)/i)
    expect(sql).toMatch(/status, resolved_at, reverses_settlement_id[\s\S]*?'contra'/i)
  })

  it('the counter legs are opposite-direction settlement movements', () => {
    expect(sql).toMatch(/'settlement', 'in'/i) // payer gets money back
    expect(sql).toMatch(/'settlement', 'out'/i) // receiver gives it back
  })
})
