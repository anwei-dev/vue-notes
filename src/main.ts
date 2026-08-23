import { createApp } from 'vue'
import { router } from '@/router'
import App from './App.vue'
import './styles/variables.css'
import './styles/global.css'

async function bootstrap() {
  try {
    // 正确顺序：1) 创建 app；2) use(router) 注入；3) 等 isReady；4) mount
    const app = createApp(App)
    app.use(router)
    // isReady 必须在 use(router) 之后执行；设置短超时兜底，避免极端情况下仍挂起
    await Promise.race([
      router.isReady(),
      new Promise<void>((resolve) => setTimeout(resolve, 3000))
    ])
    app.mount('#app')
    console.info('[Markdown Editor] 应用挂载成功')
  } catch (err) {
    console.error('[Markdown Editor] 启动失败：', err)
    const mount = document.getElementById('app')
    if (mount) {
      mount.innerHTML = `
        <div style="padding:40px;font-family:system-ui,sans-serif;color:#a33;background:#fee;">
          <h2 style="margin:0 0 12px;">应用启动失败</h2>
          <pre style="background:#fff;border:1px solid #fdd;padding:12px;border-radius:6px;white-space:pre-wrap;">${
            (err as Error).stack ?? String(err)
          }</pre>
        </div>`
    }
  }
}

bootstrap()
