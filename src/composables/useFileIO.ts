import { useMarkdown } from './useMarkdown'

export function useFileIO() {
  const { renderMarkdown } = useMarkdown()

  const importFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
        reject(new Error('仅支持导入 .md 或 .txt 文件'))
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        resolve(content || '')
      }
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsText(file, 'UTF-8')
    })
  }

  const triggerFileInput = (inputId: string) => {
    const input = document.getElementById(inputId) as HTMLInputElement | null
    if (input) input.click()
  }

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportMarkdown = (content: string) => {
    const date = new Date().toISOString().slice(0, 10)
    downloadFile(content, `markdown-${date}.md`, 'text/markdown;charset=utf-8')
  }

  const exportHTML = (content: string, title: string = 'Markdown 导出文档') => {
    const rendered = renderMarkdown(content)
    const date = new Date().toISOString().slice(0, 10)
    const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+Pro:wght@400;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
  body { max-width: 820px; margin: 40px auto; padding: 0 24px; font-family: 'Source Serif Pro', Georgia, serif; color: #2B2B2B; line-height: 1.7; }
  h1,h2,h3,h4,h5,h6 { font-weight: 600; margin-top: 1.6em; margin-bottom: 0.6em; line-height: 1.3; }
  h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }
  p { margin: 1em 0; }
  a { color: #2C5F4D; }
  blockquote { border-left: 4px solid #B8860B; padding: 0.6em 1em; margin: 1em 0; background: #FDF8F3; color: #5A5A5A; }
  code { font-family: 'JetBrains Mono', Consolas, monospace; background: #F5F1EC; padding: 2px 6px; border-radius: 4px; font-size: 0.92em; }
  pre { background: #F5F1EC; padding: 16px; border-radius: 8px; overflow-x: auto; }
  pre code { background: transparent; padding: 0; }
  table { border-collapse: collapse; margin: 1em 0; width: 100%; }
  th, td { border: 1px solid #E8DDD1; padding: 10px 14px; text-align: left; }
  th { background: #FBF3EA; font-weight: 600; }
  ul, ol { padding-left: 1.6em; margin: 1em 0; }
  li { margin: 0.3em 0; }
  hr { border: none; border-top: 1px solid #E8DDD1; margin: 2em 0; }
  img { max-width: 100%; border-radius: 6px; }
</style>
</head>
<body>
${rendered}
</body>
</html>`
    downloadFile(fullHtml, `markdown-${date}.html`, 'text/html;charset=utf-8')
  }

  return {
    importFile,
    triggerFileInput,
    exportMarkdown,
    exportHTML
  }
}
