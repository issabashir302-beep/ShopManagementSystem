const THEME_KEY = 'dukani.theme'

export function getTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // Fall back to the default light theme when storage is unavailable.
  }
  return 'light'
}

export function applyTheme(theme = getTheme()) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  return theme
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // The active page can still use the selected theme.
  }
  return applyTheme(theme)
}
