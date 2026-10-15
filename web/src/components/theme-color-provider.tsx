import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'zinc' | 'slate' | 'rose' | 'blue' | 'green' | 'orange' | 'purple'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeColorContext = createContext<ThemeProviderState | undefined>(undefined)

export function ThemeColorProvider({
  children,
  defaultTheme = 'zinc',
  storageKey = 'theme-color',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme
    if (stored) {
      setThemeState(stored)
    }
  }, [storageKey])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove(
      'theme-zinc',
      'theme-slate',
      'theme-rose',
      'theme-blue',
      'theme-green',
      'theme-orange',
      'theme-purple'
    )
    root.classList.add(`theme-${theme}`)
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme)
    setThemeState(newTheme)
  }

  return (
    <ThemeColorContext.Provider value={{ theme, setTheme }}>{children}</ThemeColorContext.Provider>
  )
}

export const useThemeColor = () => {
  const context = useContext(ThemeColorContext)
  if (context === undefined) {
    throw new Error('useThemeColor must be used within a ThemeColorProvider')
  }
  return context
}
