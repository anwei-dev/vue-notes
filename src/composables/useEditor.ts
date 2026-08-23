import type { Ref } from 'vue'
import { useMarkdown } from './useMarkdown'

export type FormatAction =
  | 'h1' | 'h2' | 'h3' | 'bold' | 'italic' | 'strikethrough'
  | 'link' | 'image' | 'ul' | 'ol' | 'quote' | 'code' | 'codeblock'
  | 'table' | 'hr'

export interface EditorSelection {
  start: number
  end: number
  text: string
}

export interface FormatResult {
  value: string
  selectStart: number
  selectEnd: number
}

export function useEditor() {
  const { renderMarkdown } = useMarkdown()

  const applyFormat = (
    action: FormatAction,
    currentContent: string,
    sel: EditorSelection
  ): FormatResult => {
    let before = ''
    let after = ''

    switch (action) {
      case 'h1': before = '# '; break
      case 'h2': before = '## '; break
      case 'h3': before = '### '; break
      case 'bold': before = '**'; after = '**'; break
      case 'italic': before = '*'; after = '*'; break
      case 'strikethrough': before = '~~'; after = '~~'; break
      case 'link': before = '['; after = '](https://example.com)'; break
      case 'image': before = '![描述]('; after = 'https://example.com/image.png)'; break
      case 'ul': before = '- '; break
      case 'ol': before = '1. '; break
      case 'quote': before = '> '; break
      case 'code': before = '`'; after = '`'; break
      case 'codeblock': before = '\n```javascript\n'; after = '\n```\n'; break
      case 'table':
        before = '\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| A   | B   | C   |\n| D   | E   | F   |\n'
        break
      case 'hr':
        before = '\n\n---\n\n'
        break
    }

    // 若选中为空，填入占位文本并选中这段文字
    if (sel.text === '' && ['bold', 'italic', 'strikethrough', 'code'].includes(action)) {
      const placeholders: Record<string, string> = {
        'bold': '粗体文字',
        'italic': '斜体文字',
        'strikethrough': '删除线文字',
        'code': 'code'
      }
      const placeholder = placeholders[action] ?? '文字'
      const prefix = currentContent.substring(0, sel.start)
      const suffix = currentContent.substring(sel.end)
      const inserted = before + placeholder + after
      const newValue = prefix + inserted + suffix
      const sStart = sel.start + before.length
      const sEnd = sStart + placeholder.length
      return { value: newValue, selectStart: sStart, selectEnd: sEnd }
    }

    const prefix = currentContent.substring(0, sel.start)
    const suffix = currentContent.substring(sel.end)
    const inserted = before + sel.text + after
    const newValue = prefix + inserted + suffix
    const caret = sel.start + before.length + sel.text.length
    return { value: newValue, selectStart: caret, selectEnd: caret }
  }

  const countStats = (text: string) => {
    const charCount = text.length
    const stripped = text.replace(/[#*_`~\[\]()>+\-!/\\|]/g, '')
    const words = stripped.match(/[\u4e00-\u9fa5]|[a-zA-Z0-9]+/g) || []
    const wordCount = words.length
    return { charCount, wordCount }
  }

  return {
    renderMarkdown,
    applyFormat,
    countStats
  }
}

// 便捷函数：从 HTMLTextAreaElement 上读取选区
export function captureSelection(el: HTMLTextAreaElement | null | undefined): EditorSelection {
  if (!el) return { start: 0, end: 0, text: '' }
  const start = el.selectionStart
  const end = el.selectionEnd
  return {
    start,
    end,
    text: el.value.substring(start, end)
  }
}

// 保留一个 Ref 形式的 textareaRef 便于老代码（未使用）：
// 这里我们不再需要，选区统一由视图层捕获。
export type { Ref }
