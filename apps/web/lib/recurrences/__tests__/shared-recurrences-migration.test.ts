import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * SQL-level invariants for the shared-recurrences migration. The repo is
 * online-only (see AGENTS.md), so these assert the migration declares the
 * structural guarantees rather than exercising a live DB. If you restructure
 * the schema, update these AND apply the migration to the Supabase dashboard.
 */

const sql = readFileSync(
  resolve(__dirname, '../../../../../supabase/migrations/0045_shared_recurrences.sql'),
  'utf-8',
)

describe('migration 0045 — shared recurrences', () => {
  it('adds household_id + default_split to recurrences', () => {
    expect(sql).toMatch(/ALTER TABLE public\.recurrences[\s\S]*?household_id/)
    expect(sql).toMatch(/ALTER TABLE public\.recurrences[\s\S]*?default_split\s+JSONB/)
  })

  it('adds household_id + split to recurrence_instances', () => {
    expect(sql).toMatch(/ALTER TABLE public\.recurrence_instances[\s\S]*?household_id/)
    expect(sql).toMatch(/ALTER TABLE public\.recurrence_instances[\s\S]*?split\s+JSONB/)
  })

  it('pairs household_id with its split on both tables (set both or neither)', () => {
    expect(sql).toMatch(/chk_recurrences_shared_has_split/)
    expect(sql).toMatch(/chk_recurrence_instances_shared_has_split/)
  })

  it('restricts shared recurrences to expense rules only', () => {
    expect(sql).toMatch(/chk_recurrences_shared_expense_only/)
    expect(sql).toMatch(/movement_type = 'expense'/)
  })

  it('keeps the FK to household nullable with ON DELETE SET NULL', () => {
    expect(sql).toMatch(/REFERENCES public\.household\(id\) ON DELETE SET NULL/)
  })
})
