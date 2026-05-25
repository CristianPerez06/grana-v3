import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getShowCents, setShowCents as persistShowCents } from './preferences'

type PreferencesValue = {
  showCents: boolean
  setShowCents: (value: boolean) => Promise<void>
}

const PreferencesContext = createContext<PreferencesValue>({
  showCents: false,
  setShowCents: async () => {},
})

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

  const setShowCents = useCallback(async (value: boolean) => {
    await persistShowCents(value)
    setShowCentsState(value)
  }, [])

  const value = useMemo(
    () => ({ showCents, setShowCents }),
    [showCents, setShowCents],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export const usePreferences = () => useContext(PreferencesContext)
export const useShowCents = () => useContext(PreferencesContext).showCents
export const useSetShowCents = () => useContext(PreferencesContext).setShowCents
