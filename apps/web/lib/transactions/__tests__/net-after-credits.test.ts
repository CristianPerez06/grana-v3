import { describe, expect, it } from 'vitest'
import { netAfterCredits } from '@grana/money-logic'

/**
 * The donut centre is the sum of the DRAWN slices: a category whose received
 * reimbursements outweigh its spend leaves the ring (no negative arc) and is
 * listed apart. So with credits present the centre is neither gross nor net,
 * and the card closes with this subtraction instead.
 */
describe('netAfterCredits', () => {
  it('subtracts the credits from the donut total — the August 2026 case', () => {
    // Centre 2.211.312,91 with Salud in credit for 146.985,07: the month cost
    // 2.064.327,84, the same figure the dashboard "Gastaste" tile shows.
    expect(netAfterCredits(2211312.91, [{ value: 146985.07 }])).toBe(2064327.84)
  })

  it('returns the total untouched when no category ended in credit', () => {
    expect(netAfterCredits(2078183.76, [])).toBe(2078183.76)
  })

  it('adds up several credits before subtracting', () => {
    expect(netAfterCredits(1000, [{ value: 100.1 }, { value: 200.2 }])).toBe(699.7)
  })

  it('keeps cents exact where plain float subtraction would drift', () => {
    // 0.3 - 0.1 - 0.1 is 0.09999999999999999 in floats.
    expect(netAfterCredits(0.3, [{ value: 0.1 }, { value: 0.1 }])).toBe(0.1)
  })

  it('can go negative: every category ended in credit', () => {
    expect(netAfterCredits(0, [{ value: 500 }])).toBe(-500)
  })
})
