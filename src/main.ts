import { createSSRApp } from 'vue' // Vue 核心：createSSRApp 创建支持服务端渲染的应用实例
import { createPinia } from 'pinia' // Pinia 状态管理：createPinia 创建全局 store 实例
import App from './App.vue' // 应用根组件
import { setSharedPinia } from './utils/shared-pinia' // 共享 Pinia：让 DOM 注入的独立组件复用同一份状态

export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  app.use(pinia)
  setSharedPinia(pinia)
  return { app }
}
