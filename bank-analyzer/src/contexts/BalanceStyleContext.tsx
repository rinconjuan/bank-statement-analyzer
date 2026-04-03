import { createContext, useContext, useState, ReactNode } from 'react'

export const BALANCE_STYLE_KEY = 'bank-analyzer:balanceStyle'

interface BalanceStyleContextValue {
  balanceStyle: 0 | 3
  setBalanceStyle: (v: 0 | 3) => void
}

const BalanceStyleContext = createContext<BalanceStyleContextValue | null>(null)

export function BalanceStyleProvider({ children }: { children: ReactNode }) {
  const [balanceStyle, setBalanceStyleRaw] = useState<0 | 3>(() => {
    const v = localStorage.getItem(BALANCE_STYLE_KEY)
    return v === '3' ? 3 : 0
  })

  const setBalanceStyle = (v: 0 | 3) => {
    setBalanceStyleRaw(v)
    localStorage.setItem(BALANCE_STYLE_KEY, String(v))
  }

  return (
    <BalanceStyleContext.Provider value={{ balanceStyle, setBalanceStyle }}>
      {children}
    </BalanceStyleContext.Provider>
  )
}

export function useBalanceStyle(): BalanceStyleContextValue {
  const ctx = useContext(BalanceStyleContext)
  if (!ctx) throw new Error('useBalanceStyle must be used inside <BalanceStyleProvider>')
  return ctx
}
