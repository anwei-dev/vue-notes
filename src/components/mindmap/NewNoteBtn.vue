<script setup lang="ts">
defineEmits<{
  create: []
}>()
</script>

<template>
  <button class="new-note-btn" title="新建笔记" @click="$emit('create')">
    <div class="hub-ring"></div>
    <div class="hub-core">
      <span class="plus">+</span>
      <span class="label">新建笔记</span>
    </div>
    <div class="halo"></div>
  </button>
</template>

<style scoped>
.new-note-btn {
  position: relative;
  width: 148px;
  height: 148px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
  z-index: 3;
}

.halo {
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(44, 95, 77, 0.18) 0%, transparent 65%);
  opacity: 0.7;
  animation: halo-pulse 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes halo-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.12); opacity: 0.9; }
}

.hub-ring {
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  border: 1.5px dashed var(--accent-primary);
  opacity: 0.55;
  animation: ring-rotate 22s linear infinite;
}

@keyframes ring-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.hub-core {
  position: relative;
  width: 116px;
  height: 116px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent-primary) 0%, #3d8368 100%);
  color: #FFF8F1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  box-shadow: 0 10px 32px rgba(44, 95, 77, 0.38),
              inset 0 2px 4px rgba(255, 255, 255, 0.25);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.new-note-btn:hover .hub-core {
  transform: scale(1.05);
  box-shadow: 0 14px 40px rgba(44, 95, 77, 0.5),
              inset 0 2px 4px rgba(255, 255, 255, 0.3);
}

.new-note-btn:active .hub-core {
  transform: scale(0.98);
}

.plus {
  font-size: 36px;
  font-weight: 300;
  line-height: 1;
  margin-bottom: 2px;
}

.label {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.4px;
}
</style>
