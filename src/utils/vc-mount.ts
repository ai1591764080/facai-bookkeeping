/**
 * H5 DOM injector for VoiceCommander
 * Creates a container in <body> and mounts the VoiceCommander component
 * using a separate Vue app that shares the main app's Pinia stores.
 */
import { createApp, h } from 'vue' // Vue 核心：createApp 创建独立应用实例，h 创建虚拟节点
import VoiceCommander from '../components/VoiceCommander.vue' // 语音记账组件（DOM 注入）
import { getSharedPinia } from './shared-pinia' // 共享 Pinia：让独立应用复用主应用的 store

let mounted = false

export function mountVoiceCommander() {
  // #ifdef H5
  if (mounted) return
  if (typeof document === 'undefined') return

  const doMount = () => {
    if (mounted) return
    console.log('[VC] Mounting VoiceCommander...')

    const container = document.createElement('div')
    container.id = 'vc-root'
    container.style.cssText = 'position:fixed;z-index:99999;top:0;left:0;right:0;bottom:0;pointer-events:none;'
    document.body.appendChild(container)
    console.log('[VC] Container appended to body')

    const pinia = getSharedPinia()
    console.log('[VC] Shared Pinia:', pinia ? 'found' : 'NOT FOUND')

    const app = createApp({
      render() {
        return h(VoiceCommander)
      },
    })

    if (pinia) app.use(pinia)
    app.mount(container)
    mounted = true
    console.log('[VC] VoiceCommander mounted successfully')
  }

  if (document.body) {
    setTimeout(doMount, 200)
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(doMount, 200))
  }
  // #endif
}
