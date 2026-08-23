<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Toolbar from '@/components/Toolbar.vue'
import EditorArea from '@/components/EditorArea.vue'
import PreviewArea from '@/components/PreviewArea.vue'
import StatusBar from '@/components/StatusBar.vue'
import { useTheme } from '@/composables/useTheme'
import { useViewMode } from '@/composables/useViewMode'
import { useEditor, captureSelection, type FormatAction } from '@/composables/useEditor'
import { useFileIO } from '@/composables/useFileIO'
import { useNotes } from '@/composables/useNotes'

const route = useRoute()
const router = useRouter()
const noteId = computed(() => String(route.params.id ?? ''))

const { theme, loadTheme, toggleTheme } = useTheme()
const { viewMode, loadViewMode, setViewMode } = useViewMode()
const { applyFormat, countStats } = useEditor()
const { importFile, triggerFileInput, exportMarkdown, exportHTML } = useFileIO()
const { bootstrap, migrateFromLegacy, getNote, updateNote, touchNote, createNote } = useNotes()

const content = ref('')
const lastSaved = ref(0)
const isSaving = ref(false)
const editorAreaRef = ref<InstanceType<typeof EditorArea> | null>(null)

const currentNote = computed(() => getNote(noteId.value))
const noteTitle = computed(() => currentNote.value?.title ?? '加载中…')

const stats = computed(() => countStats(content.value))
const wordCount = computed(() => stats.value.wordCount)
const charCount = computed(() => stats.value.charCount)

const fileInputId = 'md-file-input-editor'
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const ensureOrRedirect = () => {
  const id = noteId.value
  if (!id) {
    const fresh = createNote('')
    router.replace({ name: 'editor', params: { id: fresh.id } })
    return false
  }
  const n = getNote(id)
  if (!n) {
    router.replace({ name: 'mindmap' })
    return false
  }
  return true
}

const loadNote = () => {
  const n = getNote(noteId.value)
  if (!n) return
  content.value = n.content
  lastSaved.value = n.updatedAt
  touchNote(n.id)
}

watch(content, (newVal) => {
  if (!noteId.value) return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (!getNote(noteId.value)) return
    isSaving.value = true
    updateNote(noteId.value, { content: newVal })
    const n = getNote(noteId.value)
    if (n) lastSaved.value = n.updatedAt
    setTimeout(() => {
      isSaving.value = false
    }, 280)
  }, 600)
})

watch(() => route.params.id, () => {
  const ok = ensureOrRedirect()
  if (ok) loadNote()
})

const handleFormat = (action: FormatAction) => {
  const textareaEl = editorAreaRef.value?.getTextarea?.()
  const sel = captureSelection(textareaEl)
  const result = applyFormat(action, content.value, sel)
  content.value = result.value
  // 下一轮 DOM 更新后设置选区
  requestAnimationFrame(() => {
    editorAreaRef.value?.setSelection(result.selectStart, result.selectEnd)
  })
}

const handleImportClick = () => {
  triggerFileInput(fileInputId)
}

const handleFileChange = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  try {
    const imported = await importFile(file)
    content.value = imported
    updateNote(noteId.value, { content: imported })
  } catch (err) {
    alert((err as Error).message)
  }
  target.value = ''
}

const handleExport = (type: 'md' | 'html') => {
  if (type === 'md') {
    exportMarkdown(content.value)
  } else {
    exportHTML(content.value, noteTitle.value)
  }
}

const goHome = () => {
  router.push({ name: 'mindmap' })
}

onMounted(() => {
  loadTheme()
  loadViewMode()
  bootstrap()
  migrateFromLegacy()
  requestAnimationFrame(() => {
    const ok = ensureOrRedirect()
    if (ok) loadNote()
  })
})
</script>

<template>
  <div class="app-container">
    <Toolbar
      :viewMode="viewMode"
      :theme="theme"
      :show-home="true"
      :note-title="noteTitle"
      @format="handleFormat"
      @change-mode="setViewMode"
      @toggle-theme="toggleTheme"
      @import-click="handleImportClick"
      @export-type="handleExport"
      @go-home="goHome"
    />

    <div class="main-content">
      <div
        class="pane editor-pane"
        :class="{ hidden: viewMode === 'preview' }"
        :style="{ flexGrow: viewMode === 'split' ? 1 : 1, flexBasis: viewMode === 'split' ? '50%' : '100%' }"
      >
        <EditorArea
          ref="editorAreaRef"
          v-model="content"
        />
      </div>
      <div
        class="pane preview-pane"
        :class="{ hidden: viewMode === 'edit' }"
        :style="{ flexGrow: viewMode === 'split' ? 1 : 1, flexBasis: viewMode === 'split' ? '50%' : '100%' }"
      >
        <PreviewArea :content="content" />
      </div>
    </div>

    <StatusBar
      :wordCount="wordCount"
      :charCount="charCount"
      :lastSaved="lastSaved"
      :isSaving="isSaving"
    />

    <input
      :id="fileInputId"
      type="file"
      accept=".md,.txt,text/markdown,text/plain"
      @change="handleFileChange"
    />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: var(--bg-primary);
  transition: background var(--transition-normal);
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.pane {
  min-height: 0;
  min-width: 0;
  transition: all var(--transition-normal);
  overflow: hidden;
}

.pane.hidden {
  display: none;
  flex-basis: 0% !important;
  flex-grow: 0 !important;
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }

  .pane {
    flex-basis: auto !important;
  }

  .editor-pane,
  .preview-pane {
    flex: 1 1 50%;
  }
}
</style>
