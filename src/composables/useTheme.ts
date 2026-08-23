import { ref, watch } from 'vue'

const LS_THEME_KEY = 'md-editor-theme'

// 模块级单例：保证 MindMapView 与 EditorView 共享同一响应式主题状态
let _theme = ref<'light' | 'dark'>('light')
let _loaded = false

const applyTheme = (t: 'light' | 'dark') => {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', t)
}

export function useTheme() {
  const loadTheme = () => {
    if (_loaded) return
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem(LS_THEME_KEY) as 'light' | 'dark' | null
    if (saved === 'light' || saved === 'dark') {
      _theme.value = saved
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      _theme.value = prefersDark ? 'dark' : 'light'
    }
    applyTheme(_theme.value)
    _loaded = true
  }

  const toggleTheme = () => {
    _theme.value = _theme.value === 'light' ? 'dark' : 'light'
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_THEME_KEY, _theme.value)
    }
    applyTheme(_theme.value)
  }

  const setTheme = (t: 'light' | 'dark') => {
    _theme.value = t
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_THEME_KEY, _theme.value)
    }
    applyTheme(_theme.value)
  }

  watch(_theme, (newVal) => applyTheme(newVal))

  // 模块加载后首次可用时立刻尝试加载，避免首屏闪白
  if (typeof window !== 'undefined' && !_loaded) loadTheme()

  return {
    theme: _theme,
    loadTheme,
    toggleTheme,
    setTheme
  }
}
