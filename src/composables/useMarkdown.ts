// 容错式 Markdown 渲染：即使 marked/dompurify/highlight.js 未安装，也不会抛异常导致白屏
import type { Ref } from 'vue'

let markedModule: any = null
let dompurifyModule: any = null
let hljsModule: any = null
let triedImport = false
let importFailed = false

async function lazyLoadDeps() {
  if (triedImport) return
  triedImport = true
  try {
    // 先尝试静态导入（用户 npm install 过的常规路径）
    markedModule = await import('marked')
    dompurifyModule = await import('dompurify')
    hljsModule = await import('highlight.js')
  } catch (e) {
    console.warn('[useMarkdown] 第三方依赖缺失，回退到纯文本渲染模式：', (e as Error).message)
    importFailed = true
  }
}

// 启动时立即尝试预加载
if (typeof window !== 'undefined') {
  lazyLoadDeps()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 最小化 Markdown 渲染（回退方案：仅换行和段落）
function renderMarkdownFallback(text: string): string {
  const escaped = escapeHtml(text)
  const withBreaks = escaped
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br/>')
  return `<pre style="white-space:pre-wrap;word-break:break-word;font-family:inherit;padding:4px 8px;border-radius:6px;background:rgba(127,127,127,0.06);">${escaped}</pre>`
}

export function useMarkdown() {
  const renderMarkdown = (text: string): string => {
    // 依赖未就绪 → 用 fallback
    if (importFailed || !markedModule || !dompurifyModule) {
      return renderMarkdownFallback(text)
    }
    try {
      const marked = markedModule.marked ?? markedModule.default ?? markedModule
      if (typeof marked?.setOptions === 'function') {
        marked.setOptions({
          gfm: true,
          breaks: true,
          highlight: (code: string, lang: string) => {
            const hljs = hljsModule?.default ?? hljsModule
            if (!hljs) return code
            try {
              if (lang && typeof hljs.getLanguage === 'function' && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value
              }
              return hljs.highlightAuto?.(code)?.value ?? code
            } catch {
              return code
            }
          }
        })
      }
      const rawHtml = typeof marked?.parse === 'function'
        ? (marked.parse(text) as string)
        : renderMarkdownFallback(text)
      const DOMPurify = dompurifyModule.default ?? dompurifyModule
      const cleanHtml = typeof DOMPurify?.sanitize === 'function'
        ? DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } })
        : rawHtml
      return cleanHtml
    } catch (err) {
      console.warn('[useMarkdown] 渲染失败，回退到纯文本：', err)
      return renderMarkdownFallback(text)
    }
  }

  return {
    renderMarkdown
  }
}

export type { Ref }
