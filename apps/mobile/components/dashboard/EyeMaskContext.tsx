import { createContext, useContext, useState, type ReactNode } from 'react'

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
  const [masked, setMasked] = useState(initialMasked)
  return (
    <EyeMaskContext.Provider
      value={{ masked, toggle: () => setMasked((m) => !m) }}
    >
      {children}
    </EyeMaskContext.Provider>
  )
}

export const useEyeMask = () => useContext(EyeMaskContext)
