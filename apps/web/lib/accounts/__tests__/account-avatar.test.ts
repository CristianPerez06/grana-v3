import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_COLOR_KEYS,
  ACCOUNT_ICON_KEYS,
  resolveAccountAvatar,
  type AccountAvatarInput,
} from '@grana/ui-contracts'

const base: AccountAvatarInput = {
  id: 'acc-1',
  name: 'Billetera',
  type: 'cash',
  color_key: null,
  icon_key: null,
}

describe('resolveAccountAvatar', () => {
  it('bank with no override inherits institution branding (live)', () => {
    const r = resolveAccountAvatar(
      { ...base, type: 'bank', name: 'Galicia sueldo' },
      { brand_color: '#FA5F0C', icon_type: 'bank' },
    )
    expect(r.colorOverride).toBe('#FA5F0C')
    expect(r.colorKey).toBeNull()
    expect(r.iconKey).toBe('landmark')
  })

  it("bank with icon_type 'wallet' derives the wallet icon", () => {
    const r = resolveAccountAvatar(
      { ...base, type: 'bank' },
      { brand_color: '#123456', icon_type: 'wallet' },
    )
    expect(r.iconKey).toBe('wallet')
  })

  it('explicit override stays fixed even when institution would inherit', () => {
    const r = resolveAccountAvatar(
      { ...base, type: 'bank', color_key: 'violet', icon_key: 'briefcase' },
      { brand_color: '#FA5F0C', icon_type: 'bank' },
    )
    expect(r.colorKey).toBe('violet')
    expect(r.colorOverride).toBeNull()
    expect(r.iconKey).toBe('briefcase')
  })

  it('cash with no choice gets a deterministic palette color + wallet icon', () => {
    const r = resolveAccountAvatar(base)
    expect(r.colorOverride).toBeNull()
    expect(ACCOUNT_COLOR_KEYS).toContain(r.colorKey)
    expect(r.iconKey).toBe('wallet')
  })

  it('deterministic color is stable for the same id', () => {
    const a = resolveAccountAvatar({ ...base, id: 'stable-id' })
    const b = resolveAccountAvatar({ ...base, id: 'stable-id', name: 'Otro nombre' })
    expect(a.colorKey).toBe(b.colorKey)
  })

  it('different ids spread across the palette', () => {
    const seen = new Set(
      Array.from({ length: 200 }, (_, i) =>
        resolveAccountAvatar({ ...base, id: `id-${i}` }).colorKey,
      ),
    )
    // Not asserting perfect uniformity, just that it is not collapsing to one color.
    expect(seen.size).toBeGreaterThan(1)
  })

  it('an unknown stored key is ignored (falls back to auto)', () => {
    const r = resolveAccountAvatar({ ...base, color_key: 'chartreuse', icon_key: 'spaceship' })
    expect(ACCOUNT_COLOR_KEYS).toContain(r.colorKey)
    expect(r.iconKey).toBe('wallet')
  })

  it('monogram is the uppercased first letter of the name', () => {
    expect(resolveAccountAvatar({ ...base, name: 'ahorros' }).monogram).toBe('A')
    expect(resolveAccountAvatar({ ...base, name: '  ' }).monogram).toBe('?')
  })
})

describe('token registry sync', () => {
  it('every AccountColorKey has a matching --account-<key> in theme.css', () => {
    const themePath = path.resolve(__dirname, '../../../../../packages/ui-tokens/src/theme.css')
    const css = readFileSync(themePath, 'utf8')
    for (const key of ACCOUNT_COLOR_KEYS) {
      expect(css).toContain(`--account-${key}:`)
    }
  })

  it('icon key set has no duplicates', () => {
    expect(new Set(ACCOUNT_ICON_KEYS).size).toBe(ACCOUNT_ICON_KEYS.length)
  })
})
