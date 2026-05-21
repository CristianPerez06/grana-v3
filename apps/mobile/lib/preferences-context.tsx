import { createContext, useContext, useEffect, useState } from 'react'
import { getShowCents } from './preferences'

type PreferencesValue = { showCents: boolean }

const PreferencesContext = createContext<PreferencesValue>({ showCents: false })

export const PreferencesProvider = ({ children }: { children: React.ReactNode }) => {
  const [showCents, setShowCentsState] = useState(false)

  useEffect(() => {
    let cancelled = false
    getShowCents().then((value) => {
      if (!cancelled) setShowCentsState(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <PreferencesContext.Provider value={{ showCents }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export const useShowCents = () => useContext(PreferencesContext).showCents
