import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { defaultLocale, getLocale, setLocale as persistLocale, type Locale } from './locale'
import { translate } from './i18n'

type Params = Record<string, string | number>
type TFn = (path: string, params?: Params) => string

type LocaleContextValue = {
  locale: Locale
  setLocale: (next: Locale) => Promise<void>
  ready: boolean
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: async () => {},
  ready: false,
})

export const LocaleProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    getLocale().then((value) => {
      if (cancelled) return
      setLocaleState(value)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setLocale = useCallback(async (next: Locale) => {
    await persistLocale(next)
    setLocaleState(next)
  }, [])

  const value = useMemo(
    () => ({ locale, setLocale, ready }),
    [locale, setLocale, ready],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export const useLocale = (): Locale => useContext(LocaleContext).locale

export const useSetLocale = (): ((next: Locale) => Promise<void>) =>
  useContext(LocaleContext).setLocale

export const useT = (): TFn => {
  const locale = useLocale()
  return useCallback((path: string, params?: Params) => translate(locale, path, params), [locale])
}
