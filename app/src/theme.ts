export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'theme'

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** 套用到 <html data-theme>；「跟隨系統」時移除屬性，交給 prefers-color-scheme */
export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // 無痕模式等情況存不了，只影響這次開啟
  }
}
