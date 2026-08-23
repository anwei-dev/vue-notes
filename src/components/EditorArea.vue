<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'cursor-change': []
}>()

const textareaEl = ref<HTMLTextAreaElement | null>(null)

const handleInput = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
}

defineExpose({
  getTextarea: () => textareaEl.value,
  focus: () => textareaEl.value?.focus(),
  setSelection: (start: number, end: number) => {
    const el = textareaEl.value
    if (!el) return
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start, end)
    })
  }
})
</script>

<template>
  <div class="editor-wrapper">
    <div class="editor-header">
      <span class="header-dot"></span>
      <span class="header-title">编辑区</span>
      <span class="header-suffix">Markdown</span>
    </div>
    <div class="editor-body">
      <textarea
        ref="textareaEl"
        :value="modelValue"
        class="editor-textarea"
        placeholder="在这里输入 Markdown 内容..."
        spellcheck="false"
        @input="handleInput"
        @select="$emit('cursor-change')"
        @keyup="$emit('cursor-change')"
        @click="$emit('cursor-change')"
      />
    </div>
  </div>
</template>

<style scoped>
.editor-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-tertiary);
  border-right: 1px solid var(--border-color);
  overflow: hidden;
}

.editor-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.header-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-secondary);
  box-shadow: 0 0 0 3px rgba(184, 134, 11, 0.12);
}

.header-title {
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.header-suffix {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  opacity: 0.8;
}

.editor-body {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.editor-textarea {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  padding: 28px 32px;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  tab-size: 2;
  overflow-y: auto;
  transition: background var(--transition-normal), color var(--transition-normal);
}

.editor-textarea::placeholder {
  color: var(--text-tertiary);
  font-style: italic;
}
</style>
