import { ref } from 'vue'

const LS_CONTENT_KEY = 'md-editor-content'
const LS_LAST_SAVED_KEY = 'md-editor-last-saved'

const DEFAULT_CONTENT = `# 欢迎使用 Markdown 编辑器 ✨

这是一款**优雅精致**的在线 Markdown 编辑器，为你提供沉浸式的写作体验。

---

## 📖 快速入门

### 文本样式

你可以使用常规的 Markdown 语法来格式化文本：

- **粗体文字** 使用 \`**文字**\`
- *斜体文字* 使用 \`*文字*\`
- ~~删除线~~ 使用 \`~~文字~~\`
- \`行内代码\` 使用反引号包裹

### 标题层级

# H1 - 一级标题
## H2 - 二级标题
### H3 - 三级标题
#### H4 - 四级标题

### 列表示例

无序列表：
- 🎯 功能一：实时预览
- 🎨 功能二：主题切换
- 💾 功能三：自动保存

有序列表：
1. 在左侧编辑区输入 Markdown
2. 右侧会自动渲染预览效果
3. 内容自动保存到本地

### 引用与代码

> "写作是思想的最佳表达方式。"
> — 某位智者

代码块示例：

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return { success: true, timestamp: Date.now() };
}

greet('Markdown');
\`\`\`

### 表格与链接

| 功能 | 说明 | 快捷键 |
|------|------|--------|
| 实时预览 | 编辑即刻渲染 | 自动 |
| 主题切换 | 浅色 / 深色 | 点击按钮 |
| 导入导出 | md / html 格式 | 工具栏菜单 |

访问 [Markdown 语法指南](https://www.markdownguide.org/) 了解更多。

---

## 💡 小提示

1. 使用顶部工具栏快速插入格式
2. 切换到「仅预览」模式专注阅读
3. 你的所有改动都会自动保存到浏览器
4. 可以通过「导出」功能保存到本地文件

---

**开始写作吧！** 清空这段内容，记录你的灵感与思绪 🚀
`

export function useStorage() {
  const content = ref<string>('')
  const lastSaved = ref<number>(0)
  const isSaving = ref<boolean>(false)

  const loadContent = () => {
    const saved = localStorage.getItem(LS_CONTENT_KEY)
    const savedTime = localStorage.getItem(LS_LAST_SAVED_KEY)
    if (saved !== null) {
      content.value = saved
      lastSaved.value = savedTime ? parseInt(savedTime, 10) : 0
    } else {
      content.value = DEFAULT_CONTENT
      saveContent(DEFAULT_CONTENT)
    }
  }

  const saveContent = (text: string) => {
    isSaving.value = true
    localStorage.setItem(LS_CONTENT_KEY, text)
    const now = Date.now()
    localStorage.setItem(LS_LAST_SAVED_KEY, String(now))
    content.value = text
    lastSaved.value = now
    setTimeout(() => {
      isSaving.value = false
    }, 300)
  }

  const clearContent = () => {
    content.value = ''
    localStorage.removeItem(LS_CONTENT_KEY)
    localStorage.removeItem(LS_LAST_SAVED_KEY)
    lastSaved.value = 0
  }

  return {
    content,
    lastSaved,
    isSaving,
    loadContent,
    saveContent,
    clearContent
  }
}
