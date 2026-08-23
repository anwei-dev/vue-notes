import { ref } from 'vue'

const LS_VIEW_KEY = 'md-editor-view-mode'

export type ViewMode = 'split' | 'edit' | 'preview'

export function useViewMode() {
  const viewMode = ref<ViewMode>('split')

  const loadViewMode = () => {
    const saved = localStorage.getItem(LS_VIEW_KEY) as ViewMode | null
    if (saved === 'split' || saved === 'edit' || saved === 'preview') {
      viewMode.value = saved
    } else {
      viewMode.value = 'split'
    }
  }

  const setViewMode = (mode: ViewMode) => {
    viewMode.value = mode
    localStorage.setItem(LS_VIEW_KEY, mode)
  }

  return {
    viewMode,
    loadViewMode,
    setViewMode
  }
}
