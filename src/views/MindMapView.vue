<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import NoteNode from '@/components/mindmap/NoteNode.vue'
import { useNotes, type Note } from '@/composables/useNotes'
import { useTheme } from '@/composables/useTheme'
import { useConnections, HUB_ID, type Connection } from '@/composables/useConnections'

const router = useRouter()
const { notesList, bootstrap: bootstrapNotes, migrateFromLegacy, createNote, deleteNote, touchNote } = useNotes()
const { theme, loadTheme, toggleTheme } = useTheme()
const {
  connections,
  bootstrap: bootstrapConnections,
  addConnection,
  hasConnection,
  removeConnectionById,
  removeConnectionByPair,
  getNeighbors,
  clearConnectionsOfNode
} = useConnections()

const viewport = ref({ w: 1280, h: 800 })
/** 连接模式：当前已选中的「起点节点 id」，null 表示未进入连接模式 */
const pendingConnectFrom = ref<string | null>(null)

interface PlacedNote {
  note: Note
  x: number
  y: number
  delay: number
  ring: number
  ringIndex: number
}

// 连通分量内同心环配置（单分量内部围绕"度最大核心节点"）
const COMPONENT_RING_CONFIG = [
  { capacity: 6, radius: 160 },
  { capacity: 12, radius: 300 },
  { capacity: 20, radius: 440 },
]
// 每个连通分量之间的距离（分量中心与全局中心之间）
const COMPONENT_SPACING = 560
// 扇区之间留白角度（度）
const COMPONENT_GAP_DEG = 18
// 画布四周统一留白（代替之前 canvas-wrap 的 padding，避免盒模型混乱）
const CANVAS_PADDING = 320
// 固定顶栏/底栏高度（和样式保持一致，用于"滚到正中"的垂直偏移）
const TOP_BAR_HEIGHT = 80
const BOTTOM_TIP_HEIGHT = 60

const layoutVersion = ref(0)
const flashChip = ref(false)
let _flashTimer: number | null = null
let _centerTimer: number | null = null

const triggerRelayoutFeedback = () => {
  flashChip.value = false
  requestAnimationFrame(() => {
    flashChip.value = true
    if (_flashTimer) window.clearTimeout(_flashTimer)
    _flashTimer = window.setTimeout(() => { flashChip.value = false }, 900)
  })
}

// 连接改变 → 重排 + 反馈
watch(
  connections,
  () => {
    layoutVersion.value += 1
    triggerRelayoutFeedback()
  },
  { deep: true }
)

const handleRelayout = () => {
  layoutVersion.value += 1
  triggerRelayoutFeedback()
  window.requestAnimationFrame(() => autoCenterToLayout({ smooth: true, delay: 120 }))
}

// layoutVersion 或 viewport 变化 → 自动回滚到中心
watch(layoutVersion, () => window.requestAnimationFrame(() => autoCenterToLayout({ smooth: true, delay: 220 })))
watch(viewport, () => autoCenterToLayout({ smooth: false, delay: 0 }))

const canvasSize = computed(() => {
  // 保证画布能装下：分量距中心最远 560 + 最大环半径 440 + 四周留白 320
  // = 中心到最远节点边缘约 1000，所以单侧需要 ~1320，两侧约 2640。再翻倍做 buffer。
  const halfSize = COMPONENT_SPACING + COMPONENT_RING_CONFIG[COMPONENT_RING_CONFIG.length - 1].radius + CANVAS_PADDING
  const w = Math.max(viewport.value.w + CANVAS_PADDING * 2, halfSize * 2)
  const h = Math.max(viewport.value.h + CANVAS_PADDING * 2, halfSize * 2)
  return { w, h }
})

const center = computed(() => ({
  cx: canvasSize.value.w / 2,
  cy: canvasSize.value.h / 2
}))

/**
 * 连接感知排版（无中心 hub）：
 * - 所有笔记按「笔记↔笔记」的连接划分连通分量
 * - 真实连通分量：均分 360° 外围扇区，各分量中心等距落在全局中心外围的圆上
 * - 分量内部：度最大节点作为核心放分量中心，其余按 BFS 距离分层，每层节点**在整环上均匀分布**
 * - 完全孤立的节点（度=0）：集中在画布最中心的同心环，独立处理、不占用任何外围扇区
 */
const placed = computed<PlacedNote[]>(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = layoutVersion.value
  const notes = notesList.value
  if (notes.length === 0) return []
  const { cx, cy } = center.value
  const N = notes.length

  const idToIndex = new Map<string, number>()
  notes.forEach((n, i) => idToIndex.set(n.id, i))

  // 1) 邻接表 + 度（仅笔记↔笔记）
  const adj: number[][] = Array.from({ length: N }, () => [])
  const degree = new Array(N).fill(0)
  for (const conn of connections.value) {
    if (conn.from === HUB_ID || conn.to === HUB_ID) continue
    const fi = idToIndex.get(conn.from)
    const ti = idToIndex.get(conn.to)
    if (fi !== undefined && ti !== undefined) {
      adj[fi].push(ti)
      adj[ti].push(fi)
      degree[fi] += 1
      degree[ti] += 1
    }
  }

  // 2) BFS 连通分量划分
  const componentOf = new Array(N).fill(-1)
  const components: number[][] = []
  for (let s = 0; s < N; s++) {
    if (componentOf[s] !== -1) continue
    const queue = [s]
    componentOf[s] = components.length
    const members: number[] = []
    while (queue.length) {
      const u = queue.shift()!
      members.push(u)
      for (const v of adj[u]) {
        if (componentOf[v] === -1) {
          componentOf[v] = componentOf[s]
          queue.push(v)
        }
      }
    }
    components.push(members)
  }

  // 3) 分离：孤立分量（只有 1 个节点且 degree=0）单独处理
  const aloneIndexes: number[] = []
  const realComponents: { members: number[]; size: number; maxDegree: number }[] = []
  for (const m of components) {
    if (m.length === 1 && degree[m[0]] === 0) aloneIndexes.push(m[0])
    else {
      const maxDeg = m.reduce((mx, i) => Math.max(mx, degree[i]), 0)
      realComponents.push({ members: m, size: m.length, maxDegree: maxDeg })
    }
  }
  // 真实分量按 size → maxDegree 降序：保证大图占据"更好"的起始扇区位置（上方正中附近）
  realComponents.sort((a, b) => (b.size - a.size) || (b.maxDegree - a.maxDegree))
  aloneIndexes.sort((a, b) => a - b)

  const result: PlacedNote[] = new Array(N)
  const out: Map<number, PlacedNote> = new Map()

  if (realComponents.length > 0 || aloneIndexes.length > 0) {
    const nComp = realComponents.length
    let delayBase = 0

    // ===== A. 处理真实连通分量：均分 360° 扇区 =====
    if (nComp > 0) {
      // 每个分量的扇区角度：均分 360°，扇区间留固定 gap
      const gapRad = COMPONENT_GAP_DEG * Math.PI / 180
      // 若只有 1 个分量 → 整圆 360°，无 gap；否则等分
      const eachArc = nComp === 1
        ? Math.PI * 2
        : (Math.PI * 2 - gapRad * nComp) / nComp
      // 起始角度：让第 0 个（最大）分量的扇区中心位于 -π/2（正上方）
      let cursorAngle = nComp === 1
        ? -Math.PI / 2 - Math.PI   // 整圆时 cursor 从"起点"开始，后面 sectorCenter = cursor + eachArc/2 = -π/2 ✓
        : -Math.PI / 2 - (eachArc / 2 + gapRad / 2)

      for (let i = 0; i < nComp; i++) {
        const rc = realComponents[i]
        // 扇区中心 = 该段的中心角（用于决定分量中心落在哪）
        const sectorCenter = cursorAngle + eachArc / 2
        // 分量中心距离全局中心的距离：随序号微调避免完全对称的死板
        // 大小为 1 的真实分量（只连 hub 或历史遗留）距离稍远避免与中心孤立群重叠
        const dist = COMPONENT_SPACING
          + (i % 2 === 0 ? 0 : -70)
          + (rc.size === 1 ? 120 : 0)
        const compCx = cx + Math.cos(sectorCenter) * dist
        const compCy = cy + Math.sin(sectorCenter) * dist

        // 找分量核心：度最大的节点（BFS 起点）
        const coreIdx = rc.members.reduce(
          (best, idx) => (degree[idx] > degree[best] ? idx : best),
          rc.members[0]
        )
        const rest = rc.members.filter(i => i !== coreIdx)

        // BFS：计算每个节点离核心的"层距离"
        const distanceFromCoreMap = new Map<number, number>()
        distanceFromCoreMap.set(coreIdx, 0)
        const q = [coreIdx]; let head = 0
        while (head < q.length) {
          const u = q[head++]
          for (const v of adj[u]) {
            if (!distanceFromCoreMap.has(v) && rc.members.includes(v)) {
              distanceFromCoreMap.set(v, (distanceFromCoreMap.get(u) ?? 0) + 1)
              q.push(v)
            }
          }
        }

        // 排序：先按层距离，再按原索引（稳定）
        rest.sort((a, b) => {
          const da = distanceFromCoreMap.get(a) ?? 99
          const db = distanceFromCoreMap.get(b) ?? 99
          return da !== db ? da - db : a - b
        })

        // 放核心节点
        out.set(coreIdx, {
          note: notes[coreIdx], x: compCx, y: compCy,
          delay: delayBase, ring: 0, ringIndex: 0
        })

        // 将 rest 按"层"分组：相同距离的节点放在同一环，保证几何层级感
        const layers: number[][] = []
        for (const idx of rest) {
          const d = (distanceFromCoreMap.get(idx) ?? 1) - 1  // layer 从 0 开始
          if (!layers[d]) layers[d] = []
          layers[d].push(idx)
        }

        // 环配置：给每层映射一个半径（层越远半径越大）
        const getRadiusForLayer = (layerIdx: number): number => {
          const cfg = COMPONENT_RING_CONFIG
          if (layerIdx < cfg.length) return cfg[layerIdx].radius
          // 超出预设层：线性外推，每层 +140
          return cfg[cfg.length - 1].radius + (layerIdx - cfg.length + 1) * 140
        }

        // 逐层放置：**每层节点在整环上按实际数量均匀分布**
        let layerDelayAcc = 0
        for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
          const inLayer = layers[layerIdx]
          if (!inLayer || inLayer.length === 0) continue
          const radius = getRadiusForLayer(layerIdx)
          const n = inLayer.length
          // 关键修复：步长 = 2π / 实际节点数，而不是 / capacity，保证整圈均匀分布
          const step = (Math.PI * 2) / n
          // 起始角：让首个节点方向稍微"对齐扇区中心"，避免与核心节点、相邻分量的节点重叠
          const startOffset = -Math.PI / 2 + sectorCenter * 0.15
          inLayer.forEach((idx, i) => {
            const angle = startOffset + step * i
            const wobble = (i % 2 === 0 ? 1 : -1) * 4
            const r = radius + wobble
            out.set(idx, {
              note: notes[idx],
              x: compCx + Math.cos(angle) * r,
              y: compCy + Math.sin(angle) * r,
              delay: delayBase + 60 + layerIdx * 50 + i * 18,
              ring: layerIdx + 1,
              ringIndex: i
            })
            layerDelayAcc += 18
          })
        }
        delayBase += 40 + rc.size * 6 + layerDelayAcc
        cursorAngle += eachArc + gapRad
      }
    }

    // ===== B. 孤立节点 → 画布中心的同心环（独立于分量扇区） =====
    if (aloneIndexes.length > 0) {
      const RINGS = [
        { capacity: 8,  radius: 140 },
        { capacity: 16, radius: 260 },
        { capacity: 24, radius: 380 },
        { capacity: 32, radius: 500 },
      ]
      let ringStart = 0
      for (let ring = 0; ring < RINGS.length; ring++) {
        const { capacity, radius } = RINGS[ring]
        const inRing = aloneIndexes.slice(ringStart, ringStart + capacity)
        if (inRing.length === 0) break
        const n = inRing.length
        // 关键修复：按实际节点数 n 均分 360°，不是 / capacity
        const step = (Math.PI * 2) / n
        // 起点从正上方开始（视觉舒适）
        const startAngle = -Math.PI / 2
        inRing.forEach((idx, i) => {
          const angle = startAngle + step * i
          const wobble = (i % 2 === 0 ? 1 : -1) * 5
          const r = radius + wobble
          out.set(idx, {
            note: notes[idx],
            x: cx + Math.cos(angle) * r,
            y: cy + Math.sin(angle) * r,
            delay: 200 + ring * 40 + i * 12,
            ring: ring + 1,
            ringIndex: i
          })
        })
        ringStart += capacity
        if (ringStart >= aloneIndexes.length) break
      }
    }
  }

  for (const [idx, val] of out) result[idx] = val
  // 兜底：任何未命中的节点放螺旋形（极不可能触发）
  for (let i = 0; i < N; i++) {
    if (!result[i]) {
      result[i] = {
        note: notes[i],
        x: cx + Math.cos(i * 1.1) * (200 + i * 12),
        y: cy + Math.sin(i * 1.3) * (200 + i * 12),
        delay: 0, ring: 0, ringIndex: 0
      }
    }
  }
  return result
})

const posById = computed<Record<string, { x: number; y: number }>>(() => {
  const map: Record<string, { x: number; y: number }> = {}
  for (const p of placed.value) {
    map[p.note.id] = { x: p.x, y: p.y }
  }
  return map
})

interface ConnectionView {
  conn: Connection
  d: string
  midX: number
  midY: number
  color: string
  label: string
}

const connectionsView = computed<ConnectionView[]>(() => {
  const pos = posById.value
  const colorOf = (nodeId: string): string => {
    const found = placed.value.find(p => p.note.id === nodeId)
    return found?.note.color ?? 'var(--accent-primary)'
  }
  const nameOf = (nodeId: string): string => {
    const found = placed.value.find(p => p.note.id === nodeId)
    return found?.note.title ?? '笔记'
  }
  return connections.value.flatMap(conn => {
    if (conn.from === HUB_ID || conn.to === HUB_ID) return []
    const a = pos[conn.from]
    const b = pos[conn.to]
    if (!a || !b) return []
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = dx / len
    const ny = dy / len
    // 节点卡片宽 180，半宽 90；连线起点/终点从卡片边缘附近开始/结束
    const padFrom = 94
    const padTo = 94
    const fx = a.x + nx * padFrom
    const fy = a.y + ny * padFrom
    const tx = b.x - nx * padTo
    const ty = b.y - ny * padTo
    const midX = (fx + tx) / 2
    const midY = (fy + ty) / 2
    const ctrlX = (a.x + b.x) / 2
    const ctrlY = (a.y + b.y) / 2
    const d = `M ${fx} ${fy} Q ${ctrlX} ${ctrlY} ${tx} ${ty}`
    return [{
      conn,
      d,
      midX,
      midY,
      color: colorOf(conn.from),
      label: `${nameOf(conn.from)}  ↔  ${nameOf(conn.to)}`
    }]
  })
})

const inConnectMode = computed(() => pendingConnectFrom.value !== null)

const connectHint = computed(() => {
  if (!pendingConnectFrom.value) return null
  const src = placed.value.find(p => p.note.id === pendingConnectFrom.value)?.note.title
  return `已选中「${src ?? '起点笔记'}」，请点另一张卡片的 🔗 建立/断开连接（或点此提示取消）`
})

const updateViewport = () => {
  if (typeof window === 'undefined') return
  viewport.value = { w: window.innerWidth, h: window.innerHeight }
}

/**
 * 把所有节点的「几何重心」滚到视口内容区正中。
 * 内容区 = 视口扣除 fixed 顶栏(80px) 与 fixed 底栏(60px)。
 * 因为我们把滚动还给 window，所以用 window.scrollTo。
 */
const autoCenterToLayout = (options?: { smooth?: boolean; delay?: number }) => {
  const { smooth = true, delay = 0 } = options ?? {}
  if (typeof window === 'undefined') return
  const run = () => {
    const { w, h } = viewport.value
    let tx: number, ty: number
    if (placed.value.length === 0) {
      tx = 0
      ty = 0
    } else {
      let sx = 0, sy = 0
      for (const p of placed.value) { sx += p.x; sy += p.y }
      const gx = sx / placed.value.length
      const gy = sy / placed.value.length
      // 几何重心 → 内容区正中（内容区顶部=TOP_BAR_HEIGHT=80，内容区高度=h-80-60）
      const contentAreaCenterY = TOP_BAR_HEIGHT + (h - TOP_BAR_HEIGHT - BOTTOM_TIP_HEIGHT) / 2
      tx = Math.max(0, Math.round(gx - w / 2))
      ty = Math.max(0, Math.round(gy - contentAreaCenterY))
    }
    try {
      window.scrollTo({ left: tx, top: ty, behavior: smooth ? 'smooth' : 'auto' })
    } catch {
      window.scrollTo(tx, ty)
    }
  }
  if (_centerTimer) window.clearTimeout(_centerTimer)
  _centerTimer = window.setTimeout(run, delay)
}

const handleCenterNow = () => autoCenterToLayout({ smooth: true, delay: 0 })

/** 顶栏通用新建笔记（独立，不连任何节点） */
const handleCreate = () => {
  const note = createNote('未命名笔记')
  layoutVersion.value += 1
  triggerRelayoutFeedback()
  window.requestAnimationFrame(() => autoCenterToLayout({ smooth: true, delay: 150 }))
  router.push({ name: 'editor', params: { id: note.id } })
}

/** 节点 hover 工具栏的 ➕：创建 + 立即与该笔记连接 */
const handleAddConnected = (sourceId: string) => {
  const newNote = createNote('未命名笔记')
  addConnection(sourceId, newNote.id)
  window.setTimeout(() => router.push({ name: 'editor', params: { id: newNote.id } }), 650)
}

const handleNodeClick = (id: string) => {
  if (pendingConnectFrom.value) { pendingConnectFrom.value = null; return }
  touchNote(id)
  router.push({ name: 'editor', params: { id } })
}

const handleDelete = (id: string) => {
  deleteNote(id)
  clearConnectionsOfNode(id)
}

const handleConnect = (id: string) => {
  const from = pendingConnectFrom.value
  if (from === null) { pendingConnectFrom.value = id; return }
  if (from === id) { pendingConnectFrom.value = null; return }
  if (hasConnection(from, id)) removeConnectionByPair(from, id)
  else addConnection(from, id)
  pendingConnectFrom.value = null
}

const handleDisconnectBtn = (connId: string) => {
  removeConnectionById(connId)
}

const handleCancelConnectHint = () => { pendingConnectFrom.value = null }
/** 点击画布空白区域（不落在任何节点/连线上）取消连接模式 */
const handleCanvasWrapClick = () => { if (pendingConnectFrom.value) pendingConnectFrom.value = null }

/** 计算节点邻居数（右下角度徽章），排除 hub */
const neighborCountOf = (noteId: string): number => getNeighbors(noteId).filter(id => id !== HUB_ID).length

/** 旧版迁移：一次性移除 storage 里遗留的「一端是中心 hub」的连接 */
const removeAllHubConnections = () => {
  const hubConnIds = connections.value
    .filter(c => c.from === HUB_ID || c.to === HUB_ID)
    .map(c => c.id)
  let removed = 0
  for (const id of hubConnIds) if (removeConnectionById(id)) removed += 1
  if (removed > 0) console.info(`[MindMapView] 迁移完成：移除了 ${removed} 条遗留的中心 hub 连接`)
}

onMounted(() => {
  loadTheme()
  bootstrapNotes()
  migrateFromLegacy()
  bootstrapConnections(notesList.value.map(n => n.id))
  removeAllHubConnections()
  updateViewport()
  window.addEventListener('resize', updateViewport, { passive: true })
  // 首屏先瞬间跳到位（避免用户看到空白角落），再平滑做二次滚动兜底
  autoCenterToLayout({ smooth: false, delay: 30 })
  autoCenterToLayout({ smooth: true, delay: 500 })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport)
  if (_flashTimer) window.clearTimeout(_flashTimer)
  if (_centerTimer) window.clearTimeout(_centerTimer)
})
</script>

<template>
  <div class="mindmap-page">
    <!-- 顶栏：fixed 固定在视口顶部，不随画布横向滚动飞出边界 -->
    <header class="top-bar">
      <div class="brand-block">
        <span class="brand-logo">✒︎</span>
        <div class="brand-text">
          <h1 class="brand-title">笔记网络</h1>
          <p class="brand-subtitle">Note Graph · 每篇笔记地位平等：hover 点 ➕ 新建连接笔记 · 🔗 链接已有笔记</p>
        </div>
      </div>
      <div class="top-actions">
        <button
          class="new-note-btn-top"
          title="新建一篇独立笔记（默认不连任何其他笔记，之后可随时连接）"
          @click="handleCreate"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>新建笔记</span>
        </button>
        <div
          class="stat-chip"
          :class="{ flash: flashChip }"
          :title="'共 ' + notesList.length + ' 篇笔记 · ' + connections.filter(c => c.from !== '__hub__' && c.to !== '__hub__').length + ' 条有效连接'"
        >
          <span class="chip-dot"></span>
          <span class="chip-text">
            共 {{ notesList.length }} 篇 · {{ connections.filter(c => c.from !== '__hub__' && c.to !== '__hub__').length }} 条连接
          </span>
          <span class="chip-flash-halo"></span>
        </div>
        <button
          class="icon-only-btn center-btn"
          title="回到视图中心：将所有笔记的重心滚动到屏幕正中"
          @click="handleCenterNow"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6M12 17v6M1 12h6M17 12h6"></path>
          </svg>
        </button>
        <button
          class="relayout-btn"
          title="立即重新排版（也会在连接/笔记改变后自动触发）"
          @click="handleRelayout"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span class="relayout-label">重新排版</span>
        </button>
        <button class="theme-toggle" :title="theme === 'light' ? '切换深色主题' : '切换浅色主题'" @click="toggleTheme">
          <span v-if="theme === 'light'">🌙</span>
          <span v-else>☀️</span>
        </button>
      </div>
    </header>

    <!-- 连接模式提示条：fixed 在顶栏正下方 -->
    <transition name="fade-slide">
      <div v-if="connectHint" class="connect-hint" @click="handleCancelConnectHint">
        <span class="hint-pulse"></span>
        <span class="hint-text">{{ connectHint }}</span>
        <span class="hint-close">✕ 取消</span>
      </div>
    </transition>

    <!-- 画布本体：居中的大尺寸相对定位容器，绝对定位放 SVG 连线 + 笔记节点 -->
    <main
      class="canvas-wrap"
      :style="{ width: canvasSize.w + 'px', height: canvasSize.h + 'px' }"
      @click.self="handleCanvasWrapClick"
    >
      <div class="bg-decoration">
        <div class="grid-layer"></div>
        <div class="radial-glow"></div>
      </div>

      <svg
        class="connections"
        :viewBox="`0 0 ${canvasSize.w} ${canvasSize.h}`"
        :width="canvasSize.w"
        :height="canvasSize.h"
      >
        <defs>
          <filter id="soft-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>
        <g v-for="cv in connectionsView" :key="cv.conn.id" class="conn-group">
          <path :d="cv.d" stroke="transparent" stroke-width="14" fill="none" />
          <path
            :d="cv.d"
            fill="none"
            :stroke="cv.color"
            stroke-width="2"
            stroke-linecap="round"
            stroke-dasharray="2 5"
            opacity="0.55"
            class="conn-path"
          />
          <g class="conn-cutoff" :transform="`translate(${cv.midX}, ${cv.midY})`">
            <circle r="14" :fill="cv.color" opacity="0.08" class="conn-btn-bg" />
            <circle r="11" fill="var(--bg-tertiary)" :stroke="cv.color" stroke-width="1.5" class="conn-btn" />
            <text text-anchor="middle" dominant-baseline="central" :fill="cv.color" font-size="14" font-weight="700" style="pointer-events:none;">✕</text>
            <title>断开连接：{{ cv.label }}（点击即断开）</title>
            <circle r="18" fill="transparent" @click.stop="handleDisconnectBtn(cv.conn.id)" style="cursor:pointer;" />
          </g>
        </g>
      </svg>

      <NoteNode
        v-for="p in placed"
        :key="p.note.id"
        :note="p.note"
        :x="p.x"
        :y="p.y"
        :delay="p.delay"
        :pending-connect-source="pendingConnectFrom === p.note.id"
        :in-connect-mode="inConnectMode"
        :neighbor-count="neighborCountOf(p.note.id)"
        @click="handleNodeClick"
        @delete="handleDelete"
        @connect="handleConnect"
        @add-connected="handleAddConnected"
      />

      <div v-if="notesList.length === 0" class="empty-hint">
        <div class="empty-emoji">🕸️</div>
        <div class="empty-title">笔记网络还是空的</div>
        <div class="empty-sub">
          点击右上角的 <strong>「+ 新建笔记」</strong> 创建第一篇；<br/>
          之后悬停任意笔记卡片，点 ➕ 创建一篇与其连接的新笔记，或点 🔗 连接两篇已存在的笔记。
        </div>
      </div>
    </main>

    <!-- 底栏操作提示：fixed 在视口底部 -->
    <footer class="bottom-tip">
      <span class="tip-key">操作</span>
      悬停卡片 → 点 <strong>➕</strong> 创建并连接新笔记；点 <strong>🔗</strong> 与已有笔记连接/断开；点连线中点 <strong>✕</strong> 断开。
      共 <span class="tip-count">{{ connectionsView.length }}</span> 条有效连线。
    </footer>
  </div>
</template>

<style scoped>
.mindmap-page {
  position: relative;
  min-width: 100%;
  min-height: 100vh;
  padding-top: 80px;       /* 为 fixed 顶栏留位 */
  padding-bottom: 60px;    /* 为 fixed 底栏留位 */
  background: var(--bg-primary);
  transition: background var(--transition-normal), color var(--transition-normal);
}

/* ========== 顶栏：fixed 固定在视口顶部 ========== */
.top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 36px;
  height: 80px;
  box-sizing: border-box;
  background: var(--bg-primary-alpha-85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-color);
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.brand-logo {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--accent-primary), #3d8368);
  color: #FFF8F1;
  font-size: 22px;
  box-shadow: 0 4px 14px rgba(44, 95, 77, 0.3);
}

.brand-text {
  min-width: 0;
}

.brand-title {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--text-primary);
  letter-spacing: 0.5px;
  margin: 0;
}

.brand-subtitle {
  margin: 3px 0 0 0;
  font-size: 12px;
  color: var(--text-tertiary);
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 560px;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
  flex-wrap: nowrap;
  justify-content: flex-end;
}

.new-note-btn-top {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px 0 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent-primary), #3d8368);
  color: #FFF8F1;
  font-size: 12.5px;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 2px 10px rgba(44, 95, 77, 0.22);
  flex-shrink: 0;
}
.new-note-btn-top:hover {
  transform: translateY(-1px);
  box-shadow: 0 5px 16px rgba(44, 95, 77, 0.28);
  filter: brightness(1.05);
}
.new-note-btn-top:active { transform: translateY(0) scale(0.97); }

.stat-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  font-size: 12.5px;
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}
.stat-chip.flash {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 4px var(--accent-primary-alpha-08), var(--shadow-soft);
  animation: chip-pop 0.55s cubic-bezier(0.2, 0.9, 0.3, 1.3);
}
@keyframes chip-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.06); }
  100% { transform: scale(1); }
}

.chip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-primary-alpha-18);
  flex-shrink: 0;
}

.chip-text {
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.chip-flash-halo {
  position: absolute;
  inset: -3px;
  border-radius: 999px;
  border: 2px solid var(--accent-primary);
  opacity: 0;
  pointer-events: none;
}
.stat-chip.flash .chip-flash-halo {
  animation: halo-ping 0.9s cubic-bezier(0, 0, 0.2, 1) 1;
}
@keyframes halo-ping {
  0%   { opacity: 0.8; transform: scale(1); }
  80%  { opacity: 0;   transform: scale(1.35); }
  100% { opacity: 0;   transform: scale(1.4); }
}

.icon-only-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}
.icon-only-btn.center-btn {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}
.icon-only-btn.center-btn:hover {
  color: var(--accent-primary);
  border-color: var(--accent-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}
.icon-only-btn.center-btn:active {
  transform: translateY(0) scale(0.94);
}

.relayout-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px 0 12px;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}
.relayout-btn:hover {
  color: var(--accent-primary);
  border-color: var(--accent-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}
.relayout-btn:active { transform: translateY(0) scale(0.97); }

.theme-toggle {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}
.theme-toggle:hover {
  transform: translateY(-1px);
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-soft);
}

/* ========== 连接模式提示条：fixed 在顶栏下方 ========== */
.connect-hint {
  position: fixed;
  top: 88px;
  left: 36px;
  right: 36px;
  z-index: 49;
  padding: 10px 16px;
  border-radius: 12px;
  background: linear-gradient(90deg, var(--accent-primary-alpha-10), var(--bg-secondary));
  border: 1px dashed var(--accent-primary);
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  box-shadow: var(--shadow-soft);
  max-width: calc(100vw - 72px);
  margin: 0 auto;
  box-sizing: border-box;
}
.hint-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-primary);
  animation: blink 1s ease-in-out infinite alternate;
  flex-shrink: 0;
}
@keyframes blink { from { opacity: 0.3; } to { opacity: 1; } }
.hint-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hint-close {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-tertiary);
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
}
.fade-slide-enter-active, .fade-slide-leave-active { transition: all 0.25s ease; }
.fade-slide-enter-from, .fade-slide-leave-to { transform: translateY(-8px); opacity: 0; }

/* ========== 画布本体 ========== */
.canvas-wrap {
  position: relative;
  margin: 0 auto;              /* 画布在水平方向居中于 body，首屏 scrollLeft=0 时画布中心自然居中 */
  box-sizing: border-box;      /* 去掉 padding 盒模型混乱：直接用 canvasSize 留白 */
  width: 100%;                 /* 被 :style="width:W" 覆盖 */
  height: 100%;
}

.bg-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.grid-layer {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 1px 1px, var(--text-tertiary-alpha-22) 1px, transparent 0);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse at center, #000 30%, transparent 78%);
  -webkit-mask-image: radial-gradient(ellipse at center, #000 30%, transparent 78%);
  opacity: 0.55;
}

.radial-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1200px;
  height: 1200px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, var(--accent-primary-alpha-10) 0%, transparent 65%);
}

.connections {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
  overflow: visible;
}

.conn-group { pointer-events: auto; }
.conn-path {
  transition:
    stroke-width 0.18s ease,
    opacity 0.18s ease,
    d 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}
.conn-group:hover .conn-path {
  stroke-width: 3.5;
  opacity: 0.95;
}
.conn-cutoff { pointer-events: auto; opacity: 0; transition: opacity 0.15s ease; }
.conn-group:hover .conn-cutoff { opacity: 1; }
.conn-btn-bg { transition: r 0.2s ease; }
.conn-group:hover .conn-btn-bg { r: 20; }
.conn-btn { transition: r 0.15s ease; }
.conn-group:hover .conn-btn { r: 13; }

.empty-hint {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  padding: 32px 24px;
  z-index: 3;
  background: var(--bg-tertiary);
  border: 1px dashed var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-soft);
  max-width: 460px;
  width: calc(100% - 64px);
  box-sizing: border-box;
}
.empty-emoji { font-size: 42px; margin-bottom: 8px; }
.empty-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.empty-sub {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
}
.empty-sub strong { color: var(--accent-primary); font-weight: 700; }

/* ========== 底栏：fixed 在视口底部 ========== */
.bottom-tip {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  height: 60px;
  box-sizing: border-box;
  padding: 0 36px;
  background: var(--bg-primary-alpha-85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-top: 1px solid var(--border-color);
  font-size: 12.5px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tip-key {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  background: var(--accent-primary);
  color: #FFF8F1;
  flex-shrink: 0;
}
.bottom-tip strong { color: var(--accent-primary); font-weight: 700; }
.tip-count {
  margin-left: auto;
  font-family: var(--font-mono);
  color: var(--accent-primary);
  font-weight: 700;
  flex-shrink: 0;
}
</style>
