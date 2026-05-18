'use client'

import { createContext, useContext } from 'react'

const PreferencesContext = createContext({ showCents: false })

export const PreferencesProvider = ({
  showCents,
  children,
}: {
  showCents: boolean
  children: React.ReactNode
}) => (
  <PreferencesContext.Provider value={{ showCents }}>
    {children}
  </PreferencesContext.Provider>
)

export const useShowCents = () => useContext(PreferencesContext).showCents
