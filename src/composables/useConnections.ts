import { ref, watch, type WatchStopHandle } from 'vue'

export interface Connection {
  id: string
  from: string  // 源节点 id（可以是笔记 id 或虚拟中心 hub 的 __hub__）
  to: string    // 目标节点 id
}

const LS_CONNECTIONS_KEY = 'md-notes-connections'
export const HUB_ID = '__hub__'

const generateId = (): string => {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `c-${ts}${rand}`
}

// ========== 模块级单例 ==========
const connections = ref<Connection[]>([])
let _bootstrapped = false
let _watchStop: WatchStopHandle | null = null

const persist = () => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LS_CONNECTIONS_KEY, JSON.stringify(connections.value))
  } catch (_) { /* ignore */ }
}

/**
 * 节点连接关系 composable（模块级单例，与 useNotes 共享生命周期）。
 * 连接是无向的：A→B 与 B→A 会合并成一条（按 from/to 排序后规范化存储）
 * 支持虚拟中心节点 HUB_ID，用于让笔记"挂回主图"。
 */
export function useConnections() {
  const normalizePair = (a: string, b: string): [string, string] => {
    return a < b ? [a, b] : [b, a]
  }

  const bootstrap = (noteIds: string[]) => {
    if (_bootstrapped) return
    _bootstrapped = true
    if (typeof localStorage === 'undefined') return

    try {
      const raw = localStorage.getItem(LS_CONNECTIONS_KEY)
      if (raw) {
        connections.value = JSON.parse(raw) as Connection[]
        // 简单去重：同 from/to 规范化后只保留一条
        const seen = new Set<string>()
        connections.value = connections.value.filter(c => {
          const [a, b] = normalizePair(c.from, c.to)
          const key = `${a}||${b}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      }
    } catch (_) {
      connections.value = []
    }

    persist()
    if (!_watchStop) {
      _watchStop = watch(connections, persist, { deep: true })
    }
  }

  /** 两个节点之间是否已连接（无向） */
  const hasConnection = (a: string, b: string): boolean => {
    const [x, y] = normalizePair(a, b)
    return connections.value.some(c => {
      const [cx, cy] = normalizePair(c.from, c.to)
      return cx === x && cy === y
    })
  }

  const getConnectionId = (a: string, b: string): string | undefined => {
    const [x, y] = normalizePair(a, b)
    return connections.value.find(c => {
      const [cx, cy] = normalizePair(c.from, c.to)
      return cx === x && cy === y
    })?.id
  }

  /** 建立连接（已连接则不重复创建）。返回新建的 connection id，或已存在的 id。 */
  const addConnection = (from: string, to: string): string | null => {
    if (!from || !to || from === to) return null
    const existing = getConnectionId(from, to)
    if (existing) return existing
    const [f, t] = normalizePair(from, to)
    const conn: Connection = { id: generateId(), from: f, to: t }
    connections.value = [...connections.value, conn]
    return conn.id
  }

  /** 断开连接（通过两端节点查找） */
  const removeConnectionByPair = (a: string, b: string): boolean => {
    const [x, y] = normalizePair(a, b)
    const before = connections.value.length
    connections.value = connections.value.filter(c => {
      const [cx, cy] = normalizePair(c.from, c.to)
      return !(cx === x && cy === y)
    })
    return connections.value.length !== before
  }

  /** 断开连接（通过连接 id） */
  const removeConnectionById = (connId: string): boolean => {
    const before = connections.value.length
    connections.value = connections.value.filter(c => c.id !== connId)
    return connections.value.length !== before
  }

  /** 切换连接（已连接→断开，未连接→建立） */
  const toggleConnection = (a: string, b: string): { connected: boolean; id?: string } => {
    if (hasConnection(a, b)) {
      removeConnectionByPair(a, b)
      return { connected: false }
    }
    const id = addConnection(a, b)
    return { connected: true, id: id ?? undefined }
  }

  /** 删除某节点参与的所有连接（删除笔记时调用） */
  const clearConnectionsOfNode = (nodeId: string): number => {
    const before = connections.value.length
    connections.value = connections.value.filter(c => c.from !== nodeId && c.to !== nodeId)
    return before - connections.value.length
  }

  /** 获取某节点的所有邻居（包含 __hub__） */
  const getNeighbors = (nodeId: string): string[] => {
    return connections.value
      .flatMap(c => (c.from === nodeId ? [c.to] : c.to === nodeId ? [c.from] : []))
  }

  return {
    HUB_ID,
    connections,
    bootstrap,
    hasConnection,
    getConnectionId,
    addConnection,
    removeConnectionByPair,
    removeConnectionById,
    toggleConnection,
    clearConnectionsOfNode,
    getNeighbors
  }
}
