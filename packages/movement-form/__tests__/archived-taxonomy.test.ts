import { describe, expect, it } from 'vitest'
import {
  archivedTaxonomyFrom,
  graftArchivedTaxonomy,
  selectableSubcategories,
} from '../src/archived-taxonomy'
import type { ArchivedTaxonomy, CategoryWithSubcategories } from '../src/types'

const sub = (id: string) => ({
  id,
  name: id,
  canonical_name: id,
  user_id: null,
})

const comida: CategoryWithSubcategories = {
  id: 'comida',
  name: 'Comida',
  type: 'expense',
  subcategories: [sub('almuerzo')],
}

// The catalog never contains archived rows — that's the fix in the read layer.
const catalog: CategoryWithSubcategories[] = [comida]

const archivedSub: ArchivedTaxonomy = {
  category: null,
  subcategory: { ...sub('delivery'), is_active: false },
}

const archivedCat: ArchivedTaxonomy = {
  category: {
    id: 'mascotas',
    name: 'Mascotas',
    type: 'expense',
    subcategories: [],
    is_active: false,
  },
  subcategory: null,
}

describe('graftArchivedTaxonomy', () => {
  it('is a no-op on create (no archived taxonomy at all)', () => {
    const result = graftArchivedTaxonomy(catalog, null, {
      categoryId: 'comida',
      subcategoryId: '',
    })
    expect(result).toBe(catalog) // same reference: nothing was rebuilt
  })

  it('grafts an archived subcategory under the category the form holds', () => {
    const result = graftArchivedTaxonomy(catalog, archivedSub, {
      categoryId: 'comida',
      subcategoryId: 'delivery',
    })
    const found = result.find((c) => c.id === 'comida')!
    expect(found.subcategories.map((s) => s.id)).toEqual(['almuerzo', 'delivery'])
    expect(found.subcategories.find((s) => s.id === 'delivery')?.is_active).toBe(false)
  })

  it('grafts an archived category the catalog no longer serves', () => {
    const result = graftArchivedTaxonomy(catalog, archivedCat, {
      categoryId: 'mascotas',
      subcategoryId: '',
    })
    expect(result.map((c) => c.id)).toEqual(['comida', 'mascotas'])
    expect(result.find((c) => c.id === 'mascotas')?.is_active).toBe(false)
  })

  it('drops the graft as soon as the user picks something else', () => {
    // This is what keeps an archived row from becoming a reusable option: it is
    // grafted only while it IS the form's value.
    const result = graftArchivedTaxonomy(catalog, archivedSub, {
      categoryId: 'comida',
      subcategoryId: 'almuerzo',
    })
    expect(result).toBe(catalog)
    expect(result.find((c) => c.id === 'comida')!.subcategories.map((s) => s.id)).toEqual([
      'almuerzo',
    ])
  })

  it('drops an archived category graft once another category is chosen', () => {
    const result = graftArchivedTaxonomy(catalog, archivedCat, {
      categoryId: 'comida',
      subcategoryId: '',
    })
    expect(result.map((c) => c.id)).toEqual(['comida'])
  })

  it('does not duplicate a row the catalog already serves (reactivated elsewhere)', () => {
    const reactivated: ArchivedTaxonomy = {
      category: { ...comida, is_active: false },
      subcategory: null,
    }
    const result = graftArchivedTaxonomy(catalog, reactivated, {
      categoryId: 'comida',
      subcategoryId: '',
    })
    expect(result.map((c) => c.id)).toEqual(['comida'])
  })

  it('grafts category and subcategory together when both were archived', () => {
    const both: ArchivedTaxonomy = {
      category: archivedCat.category,
      subcategory: { ...sub('gato'), is_active: false },
    }
    const result = graftArchivedTaxonomy(catalog, both, {
      categoryId: 'mascotas',
      subcategoryId: 'gato',
    })
    const grafted = result.find((c) => c.id === 'mascotas')!
    expect(grafted.subcategories.map((s) => s.id)).toEqual(['gato'])
  })

  it('leaves the original catalog untouched', () => {
    graftArchivedTaxonomy(catalog, archivedSub, {
      categoryId: 'comida',
      subcategoryId: 'delivery',
    })
    expect(comida.subcategories.map((s) => s.id)).toEqual(['almuerzo'])
  })
})

describe('selectableSubcategories', () => {
  it('excludes a grafted archived row from the drillable count', () => {
    // Otherwise a category whose only child is the movement's archived
    // subcategory would open a second level holding nothing pickable.
    const grafted = graftArchivedTaxonomy(
      [{ id: 'hogar', name: 'Hogar', type: 'expense', subcategories: [] }],
      { category: null, subcategory: { ...sub('muebles'), is_active: false } },
      { categoryId: 'hogar', subcategoryId: 'muebles' },
    )
    const hogar = grafted[0]
    expect(hogar.subcategories).toHaveLength(1)
    expect(selectableSubcategories(hogar)).toHaveLength(0)
  })

  it('counts live subcategories', () => {
    expect(selectableSubcategories(comida)).toHaveLength(1)
  })
})

describe('archivedTaxonomyFrom', () => {
  const live = {
    id: 'comida',
    name: 'Comida',
    canonical_name: 'comida',
    user_id: null,
    is_active: true,
    type: 'expense' as const,
  }

  it('returns null when the classification is live', () => {
    expect(archivedTaxonomyFrom({ category: live, subcategory: null })).toBeNull()
  })

  it('returns null when the read did not select is_active', () => {
    // `undefined` must never read as archived — otherwise a read that forgot
    // the column would mark live categories as archived.
    const { is_active: _omitted, ...withoutFlag } = live
    expect(archivedTaxonomyFrom({ category: withoutFlag, subcategory: null })).toBeNull()
  })

  it('picks up an archived category and carries its display fields', () => {
    const result = archivedTaxonomyFrom({
      category: { ...live, is_active: false, icon: '🐶', color: '#abc' },
      subcategory: null,
    })
    expect(result?.category).toMatchObject({
      id: 'comida',
      type: 'expense',
      is_active: false,
      canonical_name: 'comida',
      icon: '🐶',
      color: '#abc',
      subcategories: [],
    })
    expect(result?.subcategory).toBeNull()
  })

  it('picks up an archived subcategory hanging off a live category', () => {
    const result = archivedTaxonomyFrom({
      category: live,
      subcategory: { ...sub('delivery'), is_active: false },
    })
    expect(result?.category).toBeNull()
    expect(result?.subcategory).toMatchObject({ id: 'delivery', is_active: false })
  })

  it('falls back to type `both` so an incomplete read cannot hide the row', () => {
    const { type: _omitted, ...withoutType } = live
    const result = archivedTaxonomyFrom({
      category: { ...withoutType, is_active: false },
      subcategory: null,
    })
    expect(result?.category?.type).toBe('both')
  })
})
