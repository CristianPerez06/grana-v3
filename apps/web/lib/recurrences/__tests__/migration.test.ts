import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Smoke tests that verify the DB-level invariants for the recurring movements
 * module are declared in the migration file. These do not exercise the live
 * Supabase project (the repo is online-only — see AGENTS.md), but they catch
 * a whole class of regressions: someone editing the migration without keeping
 * the invariants intact.
 *
 * If you intentionally restructure the schema, update these tests AND apply
 * the new migration to the Supabase dashboard.
 */

const migrationPath = resolve(
  __dirname,
  '../../../../../supabase/migrations/0011_recurring_movements.sql',
)
const sql = readFileSync(migrationPath, 'utf-8')

describe('migration 0011 — recurring movements', () => {
  // ── 6.7: No se genera más de una instancia pendiente por regla ────────────
  it('declares a UNIQUE partial index limiting to one pending instance per rule', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+recurrence_instances_one_pending_per_rule[\s\S]*?WHERE status = 'pending'/,
    )
  })

  // ── 6.1 / 6.8: pending instances NEVER reference a real transaction ──────
  it('forbids pending instances from linking to a transaction', () => {
    // The CHECK ensures status='pending' ⇒ resolved_at IS NULL AND
    // confirmed_transaction_id IS NULL. This is the structural guarantee that
    // a pending instance cannot impact saldos via transactions.
    expect(sql).toMatch(/chk_recurrence_instances_pending_unresolved/)
    expect(sql).toMatch(/status = 'pending'[\s\S]*?confirmed_transaction_id IS NULL/)
  })

  // ── 6.7 (linked): same transaction can only confirm one instance ─────────
  it('declares a UNIQUE index on confirmed_transaction_id', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+recurrence_instances_confirmed_transaction_unique/,
    )
  })

  it('enables RLS on all three recurrence tables', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.recurrences ENABLE ROW LEVEL SECURITY/,
    )
    expect(sql).toMatch(
      /ALTER TABLE public\.recurrence_instances ENABLE ROW LEVEL SECURITY/,
    )
    expect(sql).toMatch(
      /ALTER TABLE public\.recurrence_suggestion_dismissals ENABLE ROW LEVEL SECURITY/,
    )
  })

  it('enforces unique fingerprint per user for dismissals', () => {
    // 6.10 is also enforced in JS via detectRecurrenceSuggestions, but the DB
    // backstop prevents duplicate dismissals for the same fingerprint.
    expect(sql).toMatch(
      /UNIQUE\s*\(\s*user_id\s*,\s*fingerprint\s*\)/,
    )
  })

  it('restricts movement_type to (income, expense, transfer)', () => {
    expect(sql).toMatch(
      /movement_type IN \('income', 'expense', 'transfer'\)/,
    )
  })

  it('restricts frequency to the four supported values', () => {
    expect(sql).toMatch(
      /frequency IN \('weekly', 'biweekly', 'monthly', 'annual'\)/,
    )
  })

  it('forbids the same source and destination on transfer rules', () => {
    expect(sql).toMatch(/chk_recurrences_transfer_different_accounts/)
  })

  it('requires category for income/expense rules (not for transfers)', () => {
    expect(sql).toMatch(/chk_recurrences_category_for_income_expense/)
  })
})
