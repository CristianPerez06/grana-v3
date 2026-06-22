import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Static assertions over migration 0043 (shared security & integrity hardening).
 * The repo is online-only (no local Supabase, no multi-user RLS harness — see
 * AGENTS.md), so these do not exercise RLS at runtime. They lock the SHAPE of the
 * migration: if someone edits it and drops a guarantee (B1/B2/B5/B6/B7), these fail.
 * Runtime behavior is validated by the embedded DO $$ self-check on apply and by
 * two-user QA.
 */

const sql = readFileSync(
  resolve(__dirname, '../../../../../supabase/migrations/0043_shared_security_hardening.sql'),
  'utf-8',
)

describe('migration 0043 — shared security hardening', () => {
  // ── B1: invitations are member-only readable ──────────────────────────────
  it('recreates household_invite SELECT as member-only (drops the open branch)', () => {
    expect(sql).toMatch(/drop policy if exists "read household invites" on public\.household_invite/i)
    expect(sql).toMatch(
      /create policy "members read household invites"[\s\S]*?using \(is_household_member\(household_id\)\)/i,
    )
    // The exploitable open branch must be gone from the new policy.
    expect(sql).not.toMatch(/used_by IS NULL AND expires_at > now\(\)/i)
  })

  // ── B1: self-insert narrowed to creator-first-member ──────────────────────
  it('narrows household_member INSERT to the creator as first member', () => {
    expect(sql).toMatch(/drop policy if exists "users add themselves to household"/i)
    expect(sql).toMatch(/create policy "creator inserts self as first member"[\s\S]*?created_by = auth\.uid\(\)/i)
  })

  // ── B1: joining goes through a SECURITY DEFINER RPC ───────────────────────
  it('declares join_household_by_code as SECURITY DEFINER', () => {
    expect(sql).toMatch(
      /create or replace function public\.join_household_by_code\(p_code text\)[\s\S]*?security definer/i,
    )
    // The client-side invite-claim UPDATE policy is removed.
    expect(sql).toMatch(/drop policy if exists "joining user claims invite"/i)
  })

  // ── B5: settlement has no direct client writes ────────────────────────────
  it('drops all direct write policies on settlement (SELECT only)', () => {
    expect(sql).toMatch(/drop policy if exists "payer inserts settlement"\s+on public\.settlement/i)
    expect(sql).toMatch(/drop policy if exists "members update household settlements"\s+on public\.settlement/i)
    expect(sql).toMatch(/drop policy if exists "payer deletes pending settlement"\s+on public\.settlement/i)
  })

  // ── B6: register/confirm settlement are atomic SECURITY DEFINER RPCs ──────
  it('declares register_settlement and confirm_settlement as SECURITY DEFINER', () => {
    expect(sql).toMatch(/create or replace function public\.register_settlement\([\s\S]*?security definer/i)
    expect(sql).toMatch(/create or replace function public\.confirm_settlement\([\s\S]*?security definer/i)
  })

  // ── B2: delete guard for shared expense with a live settlement ────────────
  it('declares the BEFORE DELETE guard on transactions', () => {
    expect(sql).toMatch(/before delete on public\.transactions/i)
    expect(sql).toMatch(
      /trg_fn_block_shared_delete_with_settlement[\s\S]*?OLD\.is_shared[\s\S]*?from public\.settlement/i,
    )
  })

  // ── B7: the three DB invariants ───────────────────────────────────────────
  it('declares the deferred splits-sum-total constraint trigger', () => {
    expect(sql).toMatch(
      /create constraint trigger trg_splits_sum_total[\s\S]*?deferrable initially deferred/i,
    )
  })

  it('declares the split-owner-is-member trigger', () => {
    expect(sql).toMatch(/trg_split_owner_is_member[\s\S]*?before insert or update on public\.shared_expense_split/i)
  })

  it('declares the one-active-household-per-user trigger', () => {
    expect(sql).toMatch(
      /trg_one_active_household_per_user[\s\S]*?before insert on public\.household_member/i,
    )
  })
})
