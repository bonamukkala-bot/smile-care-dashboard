import { useState, useEffect, useCallback } from 'react'

const THEME_STORAGE_KEY = 'smilecare_theme'

export function getStoredTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') {
      return saved
    }
  } catch {
    // LocalStorage might be disabled or restricted
  }
  return 'dark'
}

export function applyTheme(theme) {
  try {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
  } catch {
    // Ignore in non-browser context
  }
}

// Initial application immediately
applyTheme(getStoredTheme())

export function useTheme() {
  const [theme, setThemeState] = useState(() => getStoredTheme())

  const setTheme = useCallback((newTheme) => {
    const next = newTheme === 'light' ? 'light' : 'dark'
    setThemeState(next)
    applyTheme(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // LocalStorage error ignored
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' }
}

