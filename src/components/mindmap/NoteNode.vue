<script setup lang="ts">
import { computed } from 'vue'
import type { Note } from '@/composables/useNotes'

const props = defineProps<{
  note: Note
  x: number
  y: number
  delay?: number
  pendingConnectSource?: boolean
  inConnectMode?: boolean
  /** 当前节点在其所在连通分量中的度（邻居数）。用于决定是否给加号按钮外描边 */
  neighborCount?: number
}>()

const emit = defineEmits<{
  click: [id: string]
  delete: [id: string]
  connect: [id: string]
  addConnected: [id: string]
}>()

const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  animationDelay: `${props.delay ?? 0}ms`,
  '--node-accent': props.note.color,
  '--node-accent-soft': props.note.color + '22',
  outline: props.pendingConnectSource ? `3px solid ${props.note.color}` : 'none',
  outlineOffset: props.pendingConnectSource ? '4px' : '0px'
}))

const handleDelete = (e: MouseEvent) => {
  e.stopPropagation()
  const ok = confirm(`确定删除笔记「${props.note.title}」吗？此操作无法撤销。`)
  if (ok) emit('delete', props.note.id)
}

const handleConnect = (e: MouseEvent) => {
  e.stopPropagation()
  emit('connect', props.note.id)
}

const handleAddConnected = (e: MouseEvent) => {
  e.stopPropagation()
  emit('addConnected', props.note.id)
}
</script>

<template>
  <div
    class="note-node"
    :class="{
      'pending-source': pendingConnectSource,
      'pending-target-candidate': inConnectMode && !pendingConnectSource
    }"
    :style="style"
    @click="emit('click', note.id)"
  >
    <div class="node-accent-bar"></div>
    <div class="node-body">
      <div class="node-title" :title="note.title">{{ note.title }}</div>
    </div>

    <!-- 悬浮操作：右上角小工具栏，不占主体视觉 -->
    <div class="hover-actions">
      <button
        class="icon-btn add-btn"
        title="新建连接笔记：创建一篇新笔记并立即与当前笔记连接"
        @click="handleAddConnected"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <button
        class="icon-btn connect-btn"
        :title="pendingConnectSource ? '取消发起连接' : '与另一篇已存在的笔记建立/断开连接'"
        @click="handleConnect"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
      </button>
      <button class="icon-btn delete-btn" title="删除笔记" @click="handleDelete">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6M14 11v6"></path>
        </svg>
      </button>
    </div>

    <!-- 度指示小徽章：组件右下角 -->
    <div v-if="neighborCount && neighborCount > 0" class="degree-badge" :title="`已连接 ${neighborCount} 篇笔记`">
      {{ neighborCount }}
    </div>
  </div>
</template>

<style scoped>
.note-node {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 180px;
  min-height: 54px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
  border: 1px solid var(--border-color);
  cursor: pointer;
  display: flex;
  overflow: visible;  /* 允许 hover 工具栏/徽章伸出卡片 */
  animation: node-pop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.3) both;
  transition:
    left 0.7s cubic-bezier(0.22, 1, 0.36, 1),
    top 0.7s cubic-bezier(0.22, 1, 0.36, 1),
    transform var(--transition-normal),
    box-shadow var(--transition-normal),
    border-color var(--transition-fast);
  z-index: 2;
  user-select: none;
  will-change: left, top;
}

.note-node:hover {
  transform: translate(-50%, -50%) translateY(-3px) scale(1.03);
  box-shadow: var(--shadow-hover);
  border-color: var(--node-accent);
  z-index: 5;
}

.note-node.pending-source {
  z-index: 6;
  border-color: var(--node-accent);
  box-shadow: 0 0 0 4px var(--node-accent-soft), var(--shadow-hover);
  animation: pending-pulse 1.2s ease-in-out infinite alternate;
}

.note-node.pending-target-candidate {
  border-color: var(--accent-primary);
}

@keyframes pending-pulse {
  from { box-shadow: 0 0 0 2px var(--node-accent-soft), var(--shadow-soft); }
  to   { box-shadow: 0 0 0 8px var(--node-accent-soft), var(--shadow-hover); }
}

.node-accent-bar {
  flex-shrink: 0;
  width: 4px;
  background: var(--node-accent);
}

.node-body {
  flex: 1;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  min-width: 0;
  padding-right: 4px;
}

.node-title {
  flex: 1;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-primary);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.hover-actions {
  position: absolute;
  top: -34px;
  right: 0;
  display: flex;
  gap: 4px;
  opacity: 0;
  transform: translateY(-2px);
  transition: all var(--transition-fast);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 4px;
  box-shadow: var(--shadow-soft);
}

.note-node:hover .hover-actions,
.note-node.pending-source .hover-actions {
  opacity: 1;
  transform: translateY(0);
}

.icon-btn {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  transition: all var(--transition-fast);
}

.add-btn:hover {
  background: var(--accent-primary-alpha-08);
  color: var(--accent-primary);
  transform: scale(1.05);
}

.connect-btn:hover {
  color: var(--accent-primary);
  background: rgba(44, 95, 77, 0.08);
}

.delete-btn:hover {
  background: rgba(200, 60, 60, 0.12);
  color: #c93838;
}

/* 度徽章：右下角一个小圆点数字，显示节点当前连接了多少其他笔记 */
.degree-badge {
  position: absolute;
  right: -6px;
  bottom: -6px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--node-accent);
  color: #FFF8F1;
  font-size: 11px;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  transition: transform var(--transition-fast);
}
.note-node:hover .degree-badge { transform: scale(1.08); }

@keyframes node-pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.3);
  }
  70% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.04);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
</style>
