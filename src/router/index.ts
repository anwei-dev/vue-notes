import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
// 静态导入路由组件，避免动态 import 加载失败导致白屏
import MindMapView from '@/views/MindMapView.vue'
import EditorView from '@/views/EditorView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'mindmap',
    component: MindMapView,
    meta: { title: '笔记星系' }
  },
  {
    path: '/editor/:id',
    name: 'editor',
    component: EditorView,
    props: true,
    meta: { title: '笔记编辑器' }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
