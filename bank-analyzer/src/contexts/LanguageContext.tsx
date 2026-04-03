import { createContext, useContext, useState, ReactNode } from 'react'
import { Lang, getDict } from '../i18n/translations'

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  /** Look up a translation key; supports {key} placeholder interpolation. */
  t: (key: string, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const STORAGE_KEY = 'bank-analyzer-lang'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return (saved === 'es' || saved === 'en') ? saved : 'es'
  })

  function handleSetLang(l: Lang) {
    localStorage.setItem(STORAGE_KEY, l)
    setLang(l)
  }

  function t(key: string, params?: Record<string, string | number>): string {
    const dict = getDict(lang)
    let value = dict[key] ?? key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replaceAll(`{${k}}`, String(v))
      })
    }
    return value
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return ctx
}
