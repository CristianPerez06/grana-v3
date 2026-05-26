import { describe, expect, it } from 'vitest'
import { normalizeDescription, categoryTypeMatches } from '../category-suggestion'

describe('normalizeDescription', () => {
  it('trims and lowercases', () => {
    expect(normalizeDescription('  Coto  ')).toBe('coto')
    expect(normalizeDescription('NAFTA YPF')).toBe('nafta ypf')
  })

  it('returns null when shorter than 2 chars after trimming', () => {
    expect(normalizeDescription('')).toBeNull()
    expect(normalizeDescription('  ')).toBeNull()
    expect(normalizeDescription('a')).toBeNull()
    expect(normalizeDescription(' x ')).toBeNull()
  })

  it('keeps two-char descriptions', () => {
    expect(normalizeDescription('AA')).toBe('aa')
  })
})

describe('categoryTypeMatches', () => {
  it('matches when the category type equals the movement type', () => {
    expect(categoryTypeMatches('expense', 'expense')).toBe(true)
    expect(categoryTypeMatches('income', 'income')).toBe(true)
  })

  it("rejects when the category type is the opposite", () => {
    expect(categoryTypeMatches('income', 'expense')).toBe(false)
    expect(categoryTypeMatches('expense', 'income')).toBe(false)
  })

  it("accepts a 'both' category for either movement type", () => {
    expect(categoryTypeMatches('both', 'expense')).toBe(true)
    expect(categoryTypeMatches('both', 'income')).toBe(true)
  })
})
