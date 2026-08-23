import { ref, watch, type WatchStopHandle } from 'vue'
import { useConnections } from './useConnections'

export interface Note {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  color: string
}

const LS_NOTES_KEY = 'md-notes'
const LS_NOTES_ORDER_KEY = 'md-notes-order'

const COLOR_PALETTE = [
  '#2C5F4D',
  '#B8860B',
  '#8A5A44',
  '#4A6FA5',
  '#A0522D',
  '#5F6A6A',
  '#7B4B94',
  '#C06A4E',
]

const WELCOME_NOTE_CONTENT = `# 欢迎使用 Markdown 编辑器 ✨

这是一款**优雅精致**的在线 Markdown 编辑器，为你提供沉浸式的写作体验。

---

## 📖 快速入门

### 文本样式

你可以使用常规的 Markdown 语法来格式化文本：

- **粗体文字** 使用 \`**文字**\`
- *斜体文字* 使用 \`*文字*\`
- ~~删除线~~ 使用 \`~~文字~~\`
- \`行内代码\` 使用反引号包裹

### 列表示例

无序列表：
- 🎯 功能一：实时预览
- 🎨 功能二：主题切换
- 💾 功能三：自动保存

### 引用与代码

> "写作是思想的最佳表达方式。"

代码块示例：

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return { success: true, timestamp: Date.now() };
}
greet('Markdown');
\`\`\`

---

## 💡 小提示

1. 使用顶部工具栏快速插入格式
2. 切换到「仅预览」模式专注阅读
3. 你的所有改动都会自动保存到浏览器
4. 点击左上角 ← 返回思维导图首页，创建更多的笔记！
`

const SECOND_NOTE_CONTENT = `# 项目任务清单 📋

## 本周目标
1. 完成产品原型设计
2. 整理需求文档
3. 梳理技术方案

## 灵感碎片
> 把复杂的事情做到简单，才是真正的功力。

### 待办
- [ ] 阅读参考资料
- [x] 搭建开发环境
- [ ] 完成第一版 UI

### 备注
随时返回思维导图首页，新建更多的笔记页面，构建你的「知识星系」。
`

const generateId = (): string => {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${ts}${rand}`
}

export const extractTitle = (content: string): string => {
  const trimmed = content.trim()
  if (!trimmed) return '未命名笔记'
  const lines = trimmed.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line) continue
    const m = line.match(/^#{1,6}\s+(.+)$/)
    if (m) {
      return m[1].trim().slice(0, 40) || '未命名笔记'
    }
    const t = line.trim()
    if (t) {
      return t.replace(/[#*_`~>\-]/g, '').slice(0, 40) || '未命名笔记'
    }
  }
  return '未命名笔记'
}

const pickColor = (index: number): string => {
  return COLOR_PALETTE[index % COLOR_PALETTE.length]
}

interface NotesMap {
  [id: string]: Note
}

// ========== 模块级单例状态 ==========
const notesMap = ref<NotesMap>({})
const order = ref<string[]>([])
const notesList = ref<Note[]>([])
let _bootstrapped = false
let _watchStop: WatchStopHandle | null = null

const rebuildList = () => {
  const seen = new Set<string>()
  const list: Note[] = []
  for (const id of order.value) {
    if (notesMap.value[id]) {
      list.push(notesMap.value[id])
      seen.add(id)
    }
  }
  const remaining = Object.values(notesMap.value)
    .filter(n => !seen.has(n.id))
    .sort((a, b) => b.updatedAt - a.updatedAt)
  list.push(...remaining)
  notesList.value = list
}

const persist = () => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LS_NOTES_KEY, JSON.stringify(notesMap.value))
    localStorage.setItem(LS_NOTES_ORDER_KEY, JSON.stringify(order.value))
  } catch (_) { /* ignore */ }
}

export function useNotes() {
  const bootstrap = () => {
    if (_bootstrapped) return
    if (typeof localStorage === 'undefined') return
    _bootstrapped = true
    try {
      const raw = localStorage.getItem(LS_NOTES_KEY)
      const rawOrder = localStorage.getItem(LS_NOTES_ORDER_KEY)
      if (raw) notesMap.value = JSON.parse(raw) as NotesMap
      if (rawOrder) order.value = JSON.parse(rawOrder) as string[]
    } catch (_) {
      notesMap.value = {}
      order.value = []
    }

    if (Object.keys(notesMap.value).length === 0) {
      const id1 = generateId()
      const id2 = generateId()
      const now = Date.now()
      notesMap.value = {
        [id1]: {
          id: id1,
          title: extractTitle(WELCOME_NOTE_CONTENT),
          content: WELCOME_NOTE_CONTENT,
          createdAt: now - 60000,
          updatedAt: now - 60000,
          color: pickColor(0)
        },
        [id2]: {
          id: id2,
          title: extractTitle(SECOND_NOTE_CONTENT),
          content: SECOND_NOTE_CONTENT,
          createdAt: now - 30000,
          updatedAt: now - 30000,
          color: pickColor(1)
        }
      }
      order.value = [id1, id2]
    }

    rebuildList()
    persist()

    // 启动之后再注册 watcher，避免 bootstrap 中的多次赋值反复写磁盘
    if (!_watchStop) {
      _watchStop = watch([notesMap, order], persist, { deep: true })
    }
  }

  const migrateFromLegacy = () => {
    if (typeof localStorage === 'undefined') return
    const legacyContent = localStorage.getItem('md-editor-content')
    if (!legacyContent) return
    // 首次 bootstrap 时 notesList 已经初始化（空则有示例），所以迁移条件保持简单：
    if (notesList.value.length > 0) {
      localStorage.removeItem('md-editor-content')
      localStorage.removeItem('md-editor-last-saved')
      return
    }
    const note = createNote(legacyContent)
    order.value = [note.id]
    persist()
    rebuildList()
    localStorage.removeItem('md-editor-content')
    localStorage.removeItem('md-editor-last-saved')
  }

  const getNote = (id: string): Note | undefined => notesMap.value[id]

  const createNote = (initialContent = ''): Note => {
    const id = generateId()
    const now = Date.now()
    const existingCount = Object.keys(notesMap.value).length
    const note: Note = {
      id,
      title: extractTitle(initialContent),
      content: initialContent,
      createdAt: now,
      updatedAt: now,
      color: pickColor(existingCount)
    }
    notesMap.value = { ...notesMap.value, [id]: note }
    order.value = [id, ...order.value.filter(x => x !== id)]
    persist()
    rebuildList()
    return note
  }

  const updateNote = (id: string, patch: Partial<Pick<Note, 'content' | 'title'>>) => {
    const note = notesMap.value[id]
    if (!note) return
    const newContent = patch.content !== undefined ? patch.content : note.content
    const newTitle = patch.title !== undefined ? patch.title : extractTitle(newContent)
    const updated: Note = {
      ...note,
      content: newContent,
      title: newTitle,
      updatedAt: Date.now()
    }
    notesMap.value = { ...notesMap.value, [id]: updated }
    persist()
    rebuildList()
  }

  const deleteNote = (id: string) => {
    const nextMap = { ...notesMap.value }
    delete nextMap[id]
    notesMap.value = nextMap
    order.value = order.value.filter(x => x !== id)
    // 同步清理该节点参与的所有连接，避免连接表留下悬挂 id
    const { clearConnectionsOfNode } = useConnections()
    clearConnectionsOfNode(id)
    persist()
    rebuildList()
  }

  const touchNote = (id: string) => {
    const note = notesMap.value[id]
    if (!note) return
    note.updatedAt = Date.now()
    notesMap.value = { ...notesMap.value, [id]: { ...note } }
    order.value = [id, ...order.value.filter(x => x !== id)]
    persist()
    rebuildList()
  }

  return {
    notesMap,
    order,
    notesList,
    bootstrap,
    migrateFromLegacy,
    getNote,
    createNote,
    updateNote,
    deleteNote,
    touchNote
  }
}
