import { describe, it, expect } from 'vitest'
import { filterInstitutions } from '../institution-search'

const catalog = [
  { name: 'Ualá' },
  { name: 'Nación' },
  { name: 'Brubank' },
  { name: 'IOL (InvertirOnline)' },
  { name: 'ARQ (ex DolarApp)' },
]

describe('filterInstitutions', () => {
  it('matches an accented name from an unaccented query', () => {
    expect(filterInstitutions(catalog, 'uala')).toEqual([{ name: 'Ualá' }])
    expect(filterInstitutions(catalog, 'nacion')).toEqual([{ name: 'Nación' }])
  })

  it('still matches when the query carries the accent', () => {
    expect(filterInstitutions(catalog, 'Ualá')).toEqual([{ name: 'Ualá' }])
  })

  it('ignores case', () => {
    expect(filterInstitutions(catalog, 'BRUBANK')).toEqual([{ name: 'Brubank' }])
  })

  it('matches either spelling of a dual-name row', () => {
    expect(filterInstitutions(catalog, 'iol')).toEqual([{ name: 'IOL (InvertirOnline)' }])
    expect(filterInstitutions(catalog, 'invertironline')).toEqual([
      { name: 'IOL (InvertirOnline)' },
    ])
    expect(filterInstitutions(catalog, 'dolarapp')).toEqual([{ name: 'ARQ (ex DolarApp)' }])
  })

  it('returns the same array reference for an empty or blank query', () => {
    expect(filterInstitutions(catalog, '')).toBe(catalog)
    expect(filterInstitutions(catalog, '   ')).toBe(catalog)
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterInstitutions(catalog, 'zzz')).toEqual([])
  })
})
