'use client'

import { useEffect, useState } from 'react'

/**
 * True on a mobile-web viewport (below Tailwind's `md` = 768px). Used to gate
 * the movement-form redesign to the phone layout without touching desktop:
 * callers render `isMobile ? <mobile> : <desktop-untouched>`.
 *
 * SSR-safe: returns `false` until mounted. The movement drawer is client-only
 * and opened on interaction, so there's no meaningful hydration flash.
 */
export function useIsMobile(query = '(max-width: 767px)'): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [query])
  return isMobile
}
