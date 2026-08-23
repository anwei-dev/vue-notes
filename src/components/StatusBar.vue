<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  wordCount: number
  charCount: number
  lastSaved: number
  isSaving: boolean
}>()

const formattedTime = computed(() => {
  if (!props.lastSaved) return '尚未保存'
  const d = new Date(props.lastSaved)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})

const saveText = computed(() => {
  if (props.isSaving) return '保存中...'
  if (!props.lastSaved) return '未保存'
  return `已保存 ${formattedTime.value}`
})
</script>

<template>
  <div class="status-bar">
    <div class="status-left">
      <span class="status-indicator" :class="{ saving: isSaving }"></span>
      <span class="status-text">{{ saveText }}</span>
    </div>
    <div class="status-right">
      <span class="stat-item">
        <span class="stat-label">字数</span>
        <span class="stat-value">{{ wordCount }}</span>
      </span>
      <span class="stat-sep"></span>
      <span class="stat-item">
        <span class="stat-label">字符</span>
        <span class="stat-value">{{ charCount }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  height: var(--statusbar-height);
  background: var(--bg-toolbar);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  font-size: 12px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-primary);
  transition: all var(--transition-fast);
}

.status-indicator.saving {
  background: var(--accent-secondary);
  animation: pulse 1s ease infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.15); }
}

.status-text {
  letter-spacing: 0.2px;
}

.status-right {
  display: flex;
  align-items: center;
  gap: 0;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
}

.stat-label {
  font-size: 11px;
  color: var(--text-tertiary);
  opacity: 0.8;
}

.stat-value {
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 12px;
  min-width: 24px;
  text-align: right;
}

.stat-sep {
  width: 1px;
  height: 14px;
  background: var(--border-color);
}

@media (max-width: 640px) {
  .status-bar {
    padding: 0 14px;
  }
  .stat-label {
    display: none;
  }
}
</style>
