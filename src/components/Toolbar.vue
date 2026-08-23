<script setup lang="ts">
import { ref } from 'vue'
import type { FormatAction } from '@/composables/useEditor'
import type { ViewMode } from '@/composables/useViewMode'

defineProps<{
  viewMode: ViewMode
  theme: 'light' | 'dark'
  showHome?: boolean
  noteTitle?: string
}>()

const emit = defineEmits<{
  format: [action: FormatAction]
  'change-mode': [mode: ViewMode]
  'toggle-theme': []
  'import-click': []
  'export-type': [type: 'md' | 'html']
  'go-home': []
}>()

const showExportMenu = ref(false)

interface ToolButton {
  action: FormatAction
  label: string
  icon: string
}

const headings: ToolButton[] = [
  { action: 'h1', label: '一级标题', icon: 'H1' },
  { action: 'h2', label: '二级标题', icon: 'H2' },
  { action: 'h3', label: '三级标题', icon: 'H3' },
]

const formatButtons: ToolButton[] = [
  { action: 'bold', label: '粗体', icon: 'B' },
  { action: 'italic', label: '斜体', icon: 'I' },
  { action: 'strikethrough', label: '删除线', icon: 'S' },
]

const insertButtons: ToolButton[] = [
  { action: 'link', label: '链接', icon: '🔗' },
  { action: 'image', label: '图片', icon: '🖼' },
  { action: 'quote', label: '引用', icon: '❝' },
  { action: 'code', label: '行内代码', icon: '</>' },
  { action: 'codeblock', label: '代码块', icon: '{ }' },
]

const listButtons: ToolButton[] = [
  { action: 'ul', label: '无序列表', icon: '•' },
  { action: 'ol', label: '有序列表', icon: '1.' },
  { action: 'table', label: '表格', icon: '▦' },
  { action: 'hr', label: '分割线', icon: '—' },
]

const handleFormat = (action: FormatAction) => {
  emit('format', action)
}

const handleExport = (type: 'md' | 'html') => {
  emit('export-type', type)
  showExportMenu.value = false
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <button
        v-if="showHome"
        class="home-btn"
        title="返回笔记星系首页"
        @click="$emit('go-home')"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        <span>返回首页</span>
      </button>
      <div class="brand" v-else>
        <span class="brand-mark">✒︎</span>
        <span class="brand-name">Markdown Editor</span>
      </div>
      <div v-if="showHome && noteTitle" class="note-title-block" :title="noteTitle">
        <span class="title-sep">/</span>
        <span class="note-title-text">{{ noteTitle }}</span>
      </div>
    </div>

    <div class="toolbar-middle">
      <div class="btn-group" title="标题">
        <button
          v-for="btn in headings"
          :key="btn.action"
          class="tool-btn"
          :title="btn.label"
          @click="handleFormat(btn.action)"
        >
          <span class="icon-label">{{ btn.icon }}</span>
        </button>
      </div>

      <div class="divider" />

      <div class="btn-group" title="文本格式">
        <button
          v-for="btn in formatButtons"
          :key="btn.action"
          class="tool-btn"
          :title="btn.label"
          @click="handleFormat(btn.action)"
        >
          <span :class="{ 'bold-icon': btn.action === 'bold', 'italic-icon': btn.action === 'italic', 'strike-icon': btn.action === 'strikethrough' }">{{ btn.icon }}</span>
        </button>
      </div>

      <div class="divider" />

      <div class="btn-group" title="插入">
        <button
          v-for="btn in insertButtons"
          :key="btn.action"
          class="tool-btn"
          :title="btn.label"
          @click="handleFormat(btn.action)"
        >
          <span class="icon-glyph">{{ btn.icon }}</span>
        </button>
      </div>

      <div class="divider" />

      <div class="btn-group" title="列表与其他">
        <button
          v-for="btn in listButtons"
          :key="btn.action"
          class="tool-btn"
          :title="btn.label"
          @click="handleFormat(btn.action)"
        >
          <span class="icon-glyph">{{ btn.icon }}</span>
        </button>
      </div>
    </div>

    <div class="toolbar-right">
      <div class="btn-group">
        <button
          class="tool-btn view-btn"
          :class="{ active: viewMode === 'edit' }"
          title="仅编辑"
          @click="$emit('change-mode', 'edit')"
        >✎</button>
        <button
          class="tool-btn view-btn"
          :class="{ active: viewMode === 'split' }"
          title="分屏"
          @click="$emit('change-mode', 'split')"
        >⬌</button>
        <button
          class="tool-btn view-btn"
          :class="{ active: viewMode === 'preview' }"
          title="仅预览"
          @click="$emit('change-mode', 'preview')"
        >👁</button>
      </div>

      <div class="divider" />

      <div class="btn-group">
        <button
          class="tool-btn action-btn"
          title="导入 Markdown 文件"
          @click="$emit('import-click')"
        >导入</button>

        <div class="export-wrapper" @click.stop>
          <button
            class="tool-btn action-btn export-btn"
            title="导出"
            @click="showExportMenu = !showExportMenu"
          >
            导出
            <span class="caret">▾</span>
          </button>
          <div v-if="showExportMenu" class="export-menu">
            <button class="menu-item" @click="handleExport('md')">
              <span>📄</span> 导出为 Markdown
            </button>
            <button class="menu-item" @click="handleExport('html')">
              <span>🌐</span> 导出为 HTML
            </button>
          </div>
        </div>

        <button
          class="tool-btn theme-btn"
          :title="theme === 'light' ? '切换深色主题' : '切换浅色主题'"
          @click="$emit('toggle-theme')"
        >
          <span v-if="theme === 'light'">🌙</span>
          <span v-else>☀</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  height: var(--toolbar-height);
  background: var(--bg-toolbar);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 16px;
  position: relative;
  z-index: 10;
}

.toolbar-left {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.home-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px 0 10px;
  border-radius: var(--radius-sm);
  color: var(--accent-primary);
  font-size: 12.5px;
  font-weight: 600;
  transition: all var(--transition-fast);
}

.home-btn:hover {
  background: var(--bg-secondary);
  color: var(--accent-primary-hover);
}

.home-btn:active {
  transform: scale(0.97);
}

.note-title-block {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding-left: 4px;
  min-width: 0;
}

.title-sep {
  color: var(--text-tertiary);
  opacity: 0.6;
  font-weight: 300;
}

.note-title-text {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--accent-primary-alpha-08);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  color: var(--accent-primary);
  font-size: 24px;
  transform: translateY(-1px);
}

.brand-name {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: 0.3px;
}

.toolbar-middle {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.toolbar-middle::-webkit-scrollbar {
  display: none;
}

.toolbar-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-sm);
}

.divider {
  width: 1px;
  height: 24px;
  background: var(--border-color);
  margin: 0 6px;
}

.tool-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  font-family: var(--font-body);
  user-select: none;
}

.tool-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.tool-btn:active {
  transform: scale(0.96);
}

.tool-btn.active {
  background: var(--accent-primary);
  color: var(--bg-tertiary);
}

.tool-btn.active:hover {
  background: var(--accent-primary-hover);
}

.icon-label {
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-display);
}

.bold-icon {
  font-weight: 700;
}

.italic-icon {
  font-style: italic;
}

.strike-icon {
  text-decoration: line-through;
}

.icon-glyph {
  font-size: 13px;
  line-height: 1;
}

.view-btn {
  font-size: 15px;
}

.action-btn {
  font-size: 12px;
  font-weight: 600;
  padding: 0 12px;
  color: var(--accent-primary);
}

.action-btn:hover {
  background: var(--bg-secondary);
  color: var(--accent-primary-hover);
}

.export-btn {
  gap: 4px;
}

.caret {
  font-size: 10px;
  opacity: 0.7;
}

.export-wrapper {
  position: relative;
}

.export-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-hover);
  min-width: 180px;
  padding: 6px;
  z-index: 100;
  animation: fadeIn 0.15s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--text-primary);
  transition: background var(--transition-fast);
}

.menu-item:hover {
  background: var(--bg-secondary);
}

.theme-btn {
  font-size: 17px;
  padding: 0 10px;
}

@media (max-width: 1024px) {
  .toolbar {
    padding: 0 12px;
    gap: 8px;
  }
  .brand-name {
    font-size: 15px;
  }
  .toolbar-middle {
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .brand-mark {
    font-size: 20px;
  }
  .brand-name {
    display: none;
  }
}
</style>
