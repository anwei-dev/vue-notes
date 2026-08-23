<script setup lang="ts">
import { computed } from 'vue'
import { useMarkdown } from '@/composables/useMarkdown'

const props = defineProps<{
  content: string
}>()

const { renderMarkdown } = useMarkdown()

const renderedHtml = computed(() => renderMarkdown(props.content))
</script>

<template>
  <div class="preview-wrapper">
    <div class="preview-header">
      <span class="header-dot"></span>
      <span class="header-title">预览区</span>
      <span class="header-suffix">Live Preview</span>
    </div>
    <div class="preview-body">
      <div
        class="preview-content markdown-body"
        v-html="renderedHtml"
      />
    </div>
  </div>
</template>

<style scoped>
.preview-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  overflow: hidden;
}

.preview-header {
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
  background: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(44, 95, 77, 0.12);
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

.preview-body {
  flex: 1;
  overflow-y: auto;
  padding: 32px 48px 64px;
}

.preview-content {
  max-width: 760px;
  margin: 0 auto;
  color: var(--text-primary);
}

.preview-content :deep(h1),
.preview-content :deep(h2),
.preview-content :deep(h3),
.preview-content :deep(h4),
.preview-content :deep(h5),
.preview-content :deep(h6) {
  font-family: var(--font-display);
  font-weight: 600;
  line-height: 1.3;
  margin-top: 1.6em;
  margin-bottom: 0.6em;
  color: var(--text-primary);
}

.preview-content :deep(h1) {
  font-size: 2.1em;
  padding-bottom: 0.4em;
  border-bottom: 1px solid var(--border-color);
  margin-top: 0;
}

.preview-content :deep(h2) {
  font-size: 1.55em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border-color);
}

.preview-content :deep(h3) {
  font-size: 1.25em;
}

.preview-content :deep(h4) {
  font-size: 1.08em;
}

.preview-content :deep(p) {
  margin: 1em 0;
  line-height: 1.8;
}

.preview-content :deep(a) {
  color: var(--accent-primary);
  text-decoration: none;
  border-bottom: 1px solid rgba(44, 95, 77, 0.25);
  transition: all var(--transition-fast);
}

.preview-content :deep(a:hover) {
  color: var(--accent-primary-hover);
  border-bottom-color: var(--accent-primary-hover);
}

.preview-content :deep(strong) {
  color: var(--text-primary);
  font-weight: 700;
}

.preview-content :deep(em) {
  font-style: italic;
}

.preview-content :deep(blockquote) {
  margin: 1.4em 0;
  padding: 0.6em 1.2em;
  border-left: 4px solid var(--accent-secondary);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.preview-content :deep(blockquote p) {
  margin: 0.4em 0;
}

.preview-content :deep(ul),
.preview-content :deep(ol) {
  margin: 1em 0;
  padding-left: 1.8em;
}

.preview-content :deep(li) {
  margin: 0.4em 0;
  line-height: 1.7;
}

.preview-content :deep(ul li::marker) {
  color: var(--accent-primary);
}

.preview-content :deep(ol li::marker) {
  color: var(--accent-secondary);
  font-weight: 600;
}

.preview-content :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.88em;
  background: var(--code-bg);
  color: var(--code-text);
  padding: 2px 7px;
  border-radius: 5px;
}

.preview-content :deep(pre) {
  margin: 1.4em 0;
  padding: 18px 20px;
  background: var(--code-bg);
  border-radius: var(--radius-md);
  overflow-x: auto;
  border: 1px solid var(--border-color);
}

.preview-content :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 0.85em;
  line-height: 1.7;
  border: none;
}

.preview-content :deep(table) {
  margin: 1.4em 0;
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95em;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.preview-content :deep(th),
.preview-content :deep(td) {
  padding: 10px 16px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.preview-content :deep(th) {
  background: var(--bg-secondary);
  font-weight: 600;
  color: var(--text-primary);
}

.preview-content :deep(tr:last-child td) {
  border-bottom: none;
}

.preview-content :deep(hr) {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 2.2em 0;
}

.preview-content :deep(img) {
  max-width: 100%;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
}

@media (max-width: 640px) {
  .preview-body {
    padding: 20px 20px 40px;
  }
}
</style>
