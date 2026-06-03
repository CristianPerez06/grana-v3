'use client'

import { createContext, useContext, useState, useTransition, type ReactNode } from 'react'
import { setEyeMasked } from '@/app/_actions/preferences'

type EyeMaskContextValue = {
  masked: boolean
  toggle: () => void
}

const EyeMaskContext = createContext<EyeMaskContextValue>({
  masked: false,
  toggle: () => {},
})

export const EyeMaskProvider = ({
  children,
  initialMasked = false,
}: {
  children: ReactNode
  initialMasked?: boolean
}) => {
  // Optimistic local state seeded from the cookie (read server-side). Persisting
  // as a per-device cookie means the choice survives navigation + reload, and the
  // server renders the right state with no flash of real amounts. Mirrors the
  // sidebar-collapsed preference.
  const [masked, setMasked] = useState(initialMasked)
  const [, startTransition] = useTransition()

  const toggle = () => {
    const next = !masked
    setMasked(next)
    startTransition(() => {
      void setEyeMasked(next)
    })
  }

  return (
    <EyeMaskContext.Provider value={{ masked, toggle }}>{children}</EyeMaskContext.Provider>
  )
}

export const useEyeMask = () => useContext(EyeMaskContext)
