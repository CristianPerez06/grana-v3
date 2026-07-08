import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Static assertions over migration 0048 (shared unshare integrity). The repo is
 * online-only (no local Supabase, no multi-user RLS harness — see AGENTS.md), so
 * these do not exercise triggers/RLS at runtime. They lock the SHAPE of the
 * migration: if someone edits it and drops a guarantee, these fail. Runtime
 * behavior is validated by the embedded DO $$ self-check on apply and by two-user
 * QA (atomicity, cuotas, reimbursements, settlement blocking).
 */

const sql = readFileSync(
  resolve(__dirname, '../../../../../supabase/migrations/0048_shared_unshare_integrity.sql'),
  'utf-8',
)

describe('migration 0048 — shared unshare integrity', () => {
  it('wraps the whole migration in an explicit transaction', () => {
    expect(sql).toMatch(/^\s*begin;/im)
    expect(sql).toMatch(/commit;\s*$/i)
  })

  // ── Symmetric splits invariant ────────────────────────────────────────────
  it('redefines trg_fn_splits_sum_total as a symmetric invariant on is_shared', () => {
    expect(sql).toMatch(/create or replace function public\.trg_fn_splits_sum_total\(\)/i)
    // shared branch: splits must sum the amount
    expect(sql).toMatch(/if v_is_shared then[\s\S]*?v_sum <> v_amount/i)
    // unshared branch: no split may survive
    expect(sql).toMatch(/is not shared but still has/i)
    // keeps the cascade-delete short-circuit
    expect(sql).toMatch(/if not found then\s*\n?\s*return null;/i)
  })

  // ── Block unshare while a settlement is live (BEFORE UPDATE twin of 0043) ──
  it('adds a BEFORE UPDATE guard blocking the unshare transition with a live settlement', () => {
    expect(sql).toMatch(/before update on public\.transactions/i)
    expect(sql).toMatch(/when \(OLD\.is_shared is true and NEW\.is_shared is false\)/i)
    expect(sql).toMatch(
      /trg_fn_block_unshare_with_settlement[\s\S]*?from public\.settlement where household_id = OLD\.household_id/i,
    )
  })

  // ── No split may survive an unshare (deferred constraint trigger) ─────────
  it('adds a deferred constraint trigger catching splits left after an unshare', () => {
    expect(sql).toMatch(
      /create constraint trigger trg_no_splits_when_unshared[\s\S]*?deferrable initially deferred/i,
    )
    expect(sql).toMatch(/trg_fn_no_splits_when_unshared[\s\S]*?still has splits/i)
  })

  // ── Atomic unshare RPC ────────────────────────────────────────────────────
  it('declares unshare_movement as SECURITY INVOKER with explicit ownership + grants', () => {
    expect(sql).toMatch(
      /create or replace function public\.unshare_movement\(p_root_id uuid\)[\s\S]*?security invoker/i,
    )
    // explicit auth + ownership (not relying on RLS zero-row "success")
    expect(sql).toMatch(/v_uid\s+uuid\s*:=\s*auth\.uid\(\)/i)
    expect(sql).toMatch(/if v_owner <> v_uid then\s*\n?\s*raise exception 'not_owner'/i)
    // server-side derivation from a single root: children + linked reimbursements
    expect(sql).toMatch(/where parent_id = p_root_id/i)
    expect(sql).toMatch(/r\.type = 'reimbursement'/i)
    // deterministic lock order
    expect(sql).toMatch(/order by id\s*\n?\s*for update/i)
    // least-privilege grants
    expect(sql).toMatch(/revoke execute on function public\.unshare_movement\(uuid\) from public/i)
    expect(sql).toMatch(/grant\s+execute on function public\.unshare_movement\(uuid\) to authenticated/i)
  })

  // ── Settlement-aware cleanup ──────────────────────────────────────────────
  it('aborts cleanup on settlement-bound orphans, else deletes them', () => {
    // abort (never silently delete) when an orphan lives in a settlement household
    expect(sql).toMatch(/CLEANUP ABORTED[\s\S]*?settlements/i)
    // reads household_id from the split (the transaction's is now null)
    expect(sql).toMatch(/se\.household_id = s\.household_id/i)
    // the actual cleanup delete of unshared-with-splits rows
    expect(sql).toMatch(/DELETE FROM public\.shared_expense_split s[\s\S]*?t\.is_shared = false/i)
  })

  it('self-checks the triggers, the INVOKER function, and zero remaining orphans', () => {
    expect(sql).toMatch(/SELF-CHECK FAILED: unshare-settlement guard trigger missing/i)
    expect(sql).toMatch(/SELF-CHECK FAILED: no-splits-when-unshared trigger missing/i)
    expect(sql).toMatch(/must be SECURITY INVOKER/i)
    expect(sql).toMatch(/orphan splits still present after cleanup/i)
  })
})
