/// <reference types="vite/client" />

declare module '*.vue' {
  import { DefineComponent } from 'vue' // Vue 组件类型：让 TS 识别 .vue 导入的默认导出类型
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}
