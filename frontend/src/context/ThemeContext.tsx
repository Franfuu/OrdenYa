import { createContext, use, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

function getThemeCookie(): Theme {
  const match = document.cookie.split('; ').find(row => row.startsWith('pgs-theme='));
  return match?.split('=')[1] === 'dark' ? 'dark' : 'light';
}

function setThemeCookie(theme: Theme) {
  const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
  document.cookie = `pgs-theme=${theme}; expires=${expires}; path=/; SameSite=Lax`;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getThemeCookie);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    setThemeCookie(theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => use(ThemeContext)
