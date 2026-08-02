import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { getAllCategories } from '../queries'
import type { DbClient } from '@/lib/supabase/db-client'

// ── PostgREST fake ───────────────────────────────────────────────────────────
// Applies the filters the query actually sends, and THROWS on any predicate it
// doesn't know. That second half is the point: a fake that silently ignores an
// unknown `.eq()` would pass just as happily with the embed filter deleted,
// which is precisely the bug this test exists to catch.

type SubRow = { id: string; name: string; is_active: boolean }
type CatRow = {
  id: string
  name: string
  type: 'income' | 'expense' | 'both'
  is_active: boolean
  subcategories: SubRow[]
}

function makeSupabase(rows: CatRow[]) {
  const predicates: string[] = []

  function builder() {
    let categoryActive: boolean | null = null
    let subcategoryActive: boolean | null = null

    const run = () => {
      const data = rows
        .filter((c) => (categoryActive === null ? true : c.is_active === categoryActive))
        .map((c) => ({
          ...c,
          // An embedded filter narrows the EMBEDDED rows only — the parent is
          // still returned, with an empty array when nothing survives.
          subcategories:
            subcategoryActive === null
              ? c.subcategories
              : c.subcategories.filter((s) => s.is_active === subcategoryActive),
        }))
      return { data, error: null }
    }

    const b: Record<string, unknown> = {
      select: () => b,
      order: () => b,
      eq: (column: string, value: unknown) => {
        predicates.push(`${column}=eq.${String(value)}`)
        if (column === 'is_active') categoryActive = value as boolean
        else if (column === 'subcategories.is_active') subcategoryActive = value as boolean
        else throw new Error(`unexpected predicate on column "${column}"`)
        return b
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    }
    return b
  }

  return { client: { from: () => builder() } as unknown as DbClient, predicates }
}

const cat = (
  id: string,
  is_active: boolean,
  subcategories: SubRow[] = [],
): CatRow => ({ id, name: id, type: 'expense', is_active, subcategories })

const sub = (id: string, is_active: boolean): SubRow => ({ id, name: id, is_active })

describe('getAllCategories — the catalog serves active rows only', () => {
  it('sends both filters, naming the embedded column explicitly', async () => {
    const { client, predicates } = makeSupabase([])
    await getAllCategories(client)
    // The exact strings matter: `subcategories.is_active` is what makes
    // PostgREST filter the embedded rows. A typo there is a 400 in production,
    // and dropping it altogether is the original bug.
    expect(predicates).toEqual(['is_active=eq.true', 'subcategories.is_active=eq.true'])
  })

  it('excludes archived subcategories from an active category', async () => {
    const { client } = makeSupabase([
      cat('comida', true, [sub('almuerzo', true), sub('delivery', false)]),
    ])
    const [comida] = await getAllCategories(client)
    expect(comida.subcategories.map((s) => s.id)).toEqual(['almuerzo'])
  })

  it('keeps an active category whose subcategories are ALL archived, with an empty array', async () => {
    // This is what `subcategories!inner(*)` would break: the category would
    // vanish from the picker instead of merely becoming non-drillable.
    const { client } = makeSupabase([cat('hogar', true, [sub('muebles', false)])])
    const result = await getAllCategories(client)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('hogar')
    expect(result[0].subcategories).toEqual([])
  })

  it('keeps an active category that never had subcategories', async () => {
    const { client } = makeSupabase([cat('otros', true)])
    const result = await getAllCategories(client)
    expect(result.map((c) => c.id)).toEqual(['otros'])
  })

  it('excludes archived categories', async () => {
    const { client } = makeSupabase([
      cat('viva', true, [sub('s1', true)]),
      cat('archivada', false, [sub('s2', true)]),
    ])
    const result = await getAllCategories(client)
    expect(result.map((c) => c.id)).toEqual(['viva'])
  })
})

// ── Cross-platform parity ────────────────────────────────────────────────────
// `getAllCategories` is duplicated per platform and mobile has no test runner,
// so this asserts on mobile's SOURCE. It proves the filter is written, not that
// it runs — a coarse guard, but it's what makes fixing only one platform fail
// in CI, which is how archived subcategories reached the form in the first
// place. Delete it the day the two reads are extracted into one package.

describe('mobile parity', () => {
  it('mobile getAllCategories filters the embedded subcategories too', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../../../mobile/lib/categories.ts'),
      'utf8',
    )
    const start = source.indexOf('export async function getAllCategories')
    const end = source.indexOf('export async function getCategoryById')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    // Comments are stripped so the assertions read the query, not the prose
    // explaining it (which names `!inner` precisely to say why it's wrong).
    const body = source
      .slice(start, end)
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n')
    expect(body).toContain(".eq('subcategories.is_active', true)")
    expect(body).toContain(".eq('is_active', true)")
    expect(body).not.toContain('subcategories!inner')
  })
})
