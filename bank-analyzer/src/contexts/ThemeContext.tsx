import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type ThemeName = 'dark' | 'light' | 'ocean' | 'sunset'

interface ThemeColors {
  bgPrimary: string
  bgSecondary: string
  bgTertiary: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accentPrimary: string
  accentGreen: string
  accentRed: string
  accentAmber: string
  border: string
  borderSubtle: string
}

const THEME_DEFINITIONS: Record<ThemeName, ThemeColors> = {
  dark: {
    bgPrimary: '#0d0f14',
    bgSecondary: '#13161e',
    bgTertiary: '#1a1e29',
    textPrimary: '#f0f2f7',
    textSecondary: '#8891a8',
    textMuted: '#4a5168',
    accentPrimary: '#4f7fff',
    accentGreen: '#22c55e',
    accentRed: '#ef4444',
    accentAmber: '#f59e0b',
    border: '#1e2333',
    borderSubtle: '#252b3d',
  },
  light: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f5f5f7',
    bgTertiary: '#ececf0',
    textPrimary: '#1d1d1f',
    textSecondary: '#666666',
    textMuted: '#999999',
    accentPrimary: '#0071e3',
    accentGreen: '#34c759',
    accentRed: '#ff3b30',
    accentAmber: '#ff9500',
    border: '#d2d2d7',
    borderSubtle: '#e5e5ea',
  },
  ocean: {
    bgPrimary: '#0f1419',
    bgSecondary: '#1a1f2e',
    bgTertiary: '#232d3d',
    textPrimary: '#e8ecf1',
    textSecondary: '#72a1d9',
    textMuted: '#4d6a8f',
    accentPrimary: '#00d4ff',
    accentGreen: '#1abc9c',
    accentRed: '#e74c3c',
    accentAmber: '#f39c12',
    border: '#1f2937',
    borderSubtle: '#2a3847',
  },
  sunset: {
    bgPrimary: '#0f0a08',
    bgSecondary: '#1a1410',
    bgTertiary: '#261c17',
    textPrimary: '#f5f1ec',
    textSecondary: '#c8956d',
    textMuted: '#7a5c42',
    accentPrimary: '#ff6b35',
    accentGreen: '#f4a261',
    accentRed: '#e63946',
    accentAmber: '#f77f00',
    border: '#2d2018',
    borderSubtle: '#3d2a20',
  },
}

interface ThemeContextValue {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
  colors: ThemeColors
  availableThemes: Array<{ id: ThemeName; label: string; description: string }>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('bank-analyzer-theme')
    return (saved as ThemeName) || 'dark'
  })

  useEffect(() => {
    localStorage.setItem('bank-analyzer-theme', theme)
    const colors = THEME_DEFINITIONS[theme]
    const root = document.documentElement
    Object.entries(colors).forEach(([key, value]) => {
      const cssVarName = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      root.style.setProperty(`--${cssVarName}`, value)
    })
  }, [theme])

  const setTheme = (t: ThemeName) => {
    setThemeState(t)
  }

  const availableThemes = [
    { id: 'dark' as const, label: 'Dark', description: 'Classic dark theme' },
    { id: 'light' as const, label: 'Light', description: 'Clean light theme' },
    { id: 'ocean' as const, label: 'Ocean', description: 'Modern cyan theme' },
    { id: 'sunset' as const, label: 'Sunset', description: 'Warm orange theme' },
  ]

  return (
    <ThemeContext.Provider value={{ theme, setTheme, colors: THEME_DEFINITIONS[theme], availableThemes }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
